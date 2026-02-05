// Backend/services/rwuiService.js
// RWUI Analytics - Read from pharmacist_entries
// RWUI = Resistance Pressure Index = resistant_count / total_count

import { supabase } from '../lib/supabase.js';

const KNOWN_ANTIBIOTICS = [
  'Ciprofloxacin',
  'Amoxicillin',
  'Ampicillin',
  'Ceftriaxone',
  'Clarithromycin',
  'Vancomycin',
  'Meropenem',
  'Gentamicin',
  'Ampicillin/Sulbactam',
  'Piperacillin/Tazobactam',
  'Colistin',
  'Linezolid',
  'Imipenem',
  'Cefpodoxime',
  'Cefoxitin',
  'Tigecycline',
  'Metronidazole'
];

function normalizeText(value) {
  return (value || '').toString().toLowerCase();
}

function extractAntibiotics(text) {
  const hay = normalizeText(text);
  const found = [];
  for (const abx of KNOWN_ANTIBIOTICS) {
    const needle = abx.toLowerCase();
    if (hay.includes(needle)) {
      found.push(abx);
    }
  }
  return found;
}

async function fetchEntries(filters = {}) {
  const { organism, district, time_window = 30 } = filters;

  let query = supabase.from('pharmacist_entries').select('*');

  if (organism) {
    query = query.or(
      `species.ilike.%${organism}%,bacterial_species.ilike.%${organism}%`
    );
  }

  if (district) {
    query = query.eq('district', district);
  }

  if (time_window) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - time_window);
    query = query.gte('created_at', cutoff.toISOString());
  }

  const { data, error } = await query;
  return { data, error };
}

/**
 * Get RWUI metrics from pharmacist_entries
 * Computes Resistance Pressure Index by parsing antibiotic_results field
 */
export async function getRWUIMetrics(filters = {}) {
  try {
    const { organism, district, time_window = 30 } = filters;

    const { data, error } = await fetchEntries({ organism, district, time_window });

    if (error) throw error;

    if (!data || data.length === 0) {
      return [];
    }

    // Parse resistance from antibiotic_results
    const processed = data.map(entry => {
      const species =
        entry.species ||
        entry.bacterial_species ||
        entry.bacterialspecies ||
        'Unknown';
      const dist = entry.district || 'Unknown';
      const results = normalizeText(
        entry.antibiotic_results ||
        entry.antibioticresults ||
        entry.susceptibility ||
        entry.susceptibility_results ||
        ''
      );

      // Check for resistance keywords
      const isResistant = /resistant|resistance|not\s+sensitive|ineffective/i.test(results);

      return { species, dist, isResistant };
    });

    // Group by species + district
    const grouped = {};
    for (const row of processed) {
      const key = `${row.species}|||${row.dist}`;
      if (!grouped[key]) {
        grouped[key] = { total: 0, resistant: 0 };
      }
      grouped[key].total++;
      if (row.isResistant) {
        grouped[key].resistant++;
      }
    }

    // Calculate RWUI for each group
    const metrics = Object.entries(grouped).map(([key, counts]) => {
      const [species, dist] = key.split('|||');
      const rwui = counts.total > 0 ? counts.resistant / counts.total : 0;

      return {
        organism: species,
        district: dist,
        rwui_value: rwui,
        total_count: counts.total,
        resistant_count: counts.resistant,
        risk_level: getRiskLevel(rwui)
      };
    });

    return metrics.sort((a, b) => b.rwui_value - a.rwui_value);
  } catch (error) {
    console.error('RWUI metrics error:', error.message);
    throw error;
  }
}

function getRiskLevel(rwui) {
  if (rwui >= 0.7) return 'critical';
  if (rwui >= 0.5) return 'high';
  if (rwui >= 0.3) return 'medium';
  return 'low';
}

export async function getRWUISummary(filters = {}) {
  try {
    const metrics = await getRWUIMetrics(filters);
    const { data: entries, error } = await fetchEntries(filters);

    if (error) throw error;

    if (!metrics.length) {
      return {
        total_organisms: 0,
        total_districts: 0,
        average_rwui: 0,
        high_risk_count: 0,
        critical_risk_count: 0,
        total_entries: 0
      };
    }

    const uniqueOrganisms = new Set(metrics.map(m => m.organism)).size;
    const uniqueDistricts = new Set(metrics.map(m => m.district)).size;
    const avgRWUI = metrics.reduce((sum, m) => sum + m.rwui_value, 0) / metrics.length;
    const totalEntries = metrics.reduce((sum, m) => sum + m.total_count, 0);

    const antibioticStats = {};

    if (entries && entries.length) {
      for (const entry of entries) {
        const details =
          entry.prescription_details ||
          entry.prescriptiondetails ||
          entry.antibiotic_results ||
          entry.antibioticresults ||
          '';

        const results = normalizeText(
          entry.antibiotic_results ||
          entry.antibioticresults ||
          entry.susceptibility ||
          entry.susceptibility_results ||
          ''
        );

        const isResistant = /resistant|resistance|not\s+sensitive|ineffective/i.test(results);
        const antibiotics = extractAntibiotics(details);

        for (const abx of antibiotics) {
          if (!antibioticStats[abx]) {
            antibioticStats[abx] = { total: 0, resistant: 0 };
          }
          antibioticStats[abx].total += 1;
          if (isResistant) antibioticStats[abx].resistant += 1;
        }
      }
    }

    const topAntibiotics = Object.entries(antibioticStats)
      .map(([name, counts]) => ({
        antibiotic: name,
        total_count: counts.total,
        resistant_count: counts.resistant,
        rwui_value: counts.total > 0 ? counts.resistant / counts.total : 0
      }))
      .sort((a, b) => b.rwui_value - a.rwui_value || b.resistant_count - a.resistant_count)
      .slice(0, 10);

    return {
      total_organisms: uniqueOrganisms,
      total_districts: uniqueDistricts,
      average_rwui: avgRWUI,
      high_risk_count: metrics.filter(m => m.risk_level === 'high').length,
      critical_risk_count: metrics.filter(m => m.risk_level === 'critical').length,
      total_entries: totalEntries,
      top_antibiotics: topAntibiotics
    };
  } catch (error) {
    console.error('RWUI summary error:', error.message);
    throw error;
  }
}

// ========================================
// RWUI v2: RESISTANCE PRESSURE MODEL
// ========================================
// Uses ML baseline probability instead of confirmed R/S/I results
// Treats pharmacist entries as "usage events" with ML-derived pressure scores

/**
 * Calculate Resistance Pressure RWUI (HYBRID MODEL)
 * 
 * Core Pressure: Raw_Pressure = Σ(ml_resistance_probability)
 * Display RWUI: RWUI_display = Raw_Pressure / usage_count (normalized)
 * Trend: direction of pressure change
 * Confidence: based on sample size
 * 
 * This models PRESSURE (usage of risky antibiotics), not confirmed resistance
 * @param {object} filters - { organism, district, time_window }
 * @returns {Promise<Array>} Pressure-based metrics with trend and confidence
 */
export async function calculatePressureRWUI(filters = {}) {
  try {
    const { organism, district, time_window = 30 } = filters;

    const { data, error } = await fetchEntries({ organism, district, time_window });

    if (error) throw error;

    if (!data || data.length === 0) {
      return [];
    }

    // Group by organism + district (MODEL A: only valid ML entries)
    const grouped = {};
    
    for (const entry of data) {
      const species = 
        entry.species ||
        entry.bacterial_species ||
        entry.bacterialspecies ||
        'Unknown';
      const dist = entry.district || 'Unknown';
      const mlProb = parseFloat(entry.ml_resistance_probability);
      const createdAt = entry.created_at ? new Date(entry.created_at) : new Date();
      
      // MODEL A: Skip entries without valid ML baseline
      if (typeof mlProb !== 'number' || isNaN(mlProb) || mlProb <= 0) {
        continue;
      }
      
      const key = `${species}|||${dist}`;
      
      if (!grouped[key]) {
        grouped[key] = {
          species,
          district: dist,
          pressureScores: [],
          timestamps: []
        };
      }
      
      grouped[key].pressureScores.push(mlProb);
      grouped[key].timestamps.push(createdAt);
    }

    // Calculate pressure metrics for each group
    const metrics = Object.entries(grouped).map(([key, data]) => {
      const { species, district, pressureScores, timestamps } = data;
      
      // CORE: Raw pressure accumulation (Σ ml_prob)
      const rawPressure = pressureScores.reduce((sum, p) => sum + p, 0);
      
      // DISPLAY: Normalized RWUI (for human readability)
      const usageCount = pressureScores.length;
      const displayRWUI = usageCount > 0 ? rawPressure / usageCount : 0;
      
      // TREND: Compare current window to previous window
      const now = new Date();
      const currentWindowStart = new Date(now.getTime() - time_window * 24 * 60 * 60 * 1000);
      const previousWindowStart = new Date(currentWindowStart.getTime() - time_window * 24 * 60 * 60 * 1000);
      
      const currentPressure = pressureScores
        .filter((_, i) => timestamps[i] >= currentWindowStart)
        .reduce((sum, p) => sum + p, 0);
      
      const previousPressure = pressureScores
        .filter((_, i) => timestamps[i] >= previousWindowStart && timestamps[i] < currentWindowStart)
        .reduce((sum, p) => sum + p, 0);
      
      let trend = '→'; // stable
      if (currentPressure > previousPressure * 1.1) {
        trend = '↑'; // increasing (>10% growth)
      } else if (currentPressure < previousPressure * 0.9) {
        trend = '↓'; // decreasing (<10% drop)
      }
      
      // CONFIDENCE: Based on usage event count
      let confidence = 'low';
      let confidenceScore = usageCount;
      if (usageCount >= 10) {
        confidence = 'high';
      } else if (usageCount >= 3) {
        confidence = 'medium';
      }
      
      // RISK LEVEL: Based on displayRWUI
      const riskLevel = getRiskLevel(displayRWUI);
      
      return {
        organism: species,
        district: district,
        
        // Core metrics
        raw_pressure: parseFloat(rawPressure.toFixed(3)),
        pressure_rwui: parseFloat((displayRWUI * 100).toFixed(1)),
        usage_count: usageCount,
        
        // Signals
        trend: trend,
        trend_label: trend === '↑' ? 'increasing' : trend === '↓' ? 'decreasing' : 'stable',
        confidence: confidence,
        confidence_score: confidenceScore,
        
        // Risk assessment
        risk_level: riskLevel,
        
        // Supporting data
        baseline_avg: parseFloat(displayRWUI.toFixed(3))
      };
    });

    return metrics.sort((a, b) => b.raw_pressure - a.raw_pressure);
  } catch (error) {
    console.error('Pressure RWUI calculation error:', error.message);
    throw error;
  }
}

/**
 * Get Pressure RWUI Summary with trend and confidence insights
 */
export async function getPressureRWUISummary(filters = {}) {
  try {
    const metrics = await calculatePressureRWUI(filters);
    
    if (!metrics || metrics.length === 0) {
      return {
        total_usage_events: 0,
        average_pressure: 0,
        total_organisms: 0,
        critical_pressure: 0,
        high_pressure: 0,
        trending_up: 0,
        trending_down: 0,
        avg_confidence: 'low'
      };
    }
    
    const totalUsageEvents = metrics.reduce((sum, m) => sum + m.usage_count, 0);
    
    // Average pressure: metrics already have pressure_rwui in percentage (0-100)
    // So just average them directly
    const avgPressure = metrics.length > 0 
      ? metrics.reduce((sum, m) => sum + m.pressure_rwui, 0) / metrics.length 
      : 0;
    
    const uniqueOrganisms = new Set(metrics.map(m => m.organism)).size;
    const criticalCount = metrics.filter(m => m.risk_level === 'critical').length;
    const highCount = metrics.filter(m => m.risk_level === 'high').length;
    const trendingUp = metrics.filter(m => m.trend === '↑').length;
    const trendingDown = metrics.filter(m => m.trend === '↓').length;
    
    const avgConfidenceScore = metrics.reduce((sum, m) => sum + m.confidence_score, 0) / metrics.length;
    let avgConfidence = 'low';
    if (avgConfidenceScore >= 10) {
      avgConfidence = 'high';
    } else if (avgConfidenceScore >= 3) {
      avgConfidence = 'medium';
    }
    
    return {
      ok: true,
      model: 'pressure_hybrid',
      total_usage_events: totalUsageEvents,
      average_pressure: parseFloat(avgPressure.toFixed(1)),
      total_organisms: uniqueOrganisms,
      critical_pressure: criticalCount,
      high_pressure: highCount,
      trending_up: trendingUp,
      trending_down: trendingDown,
      avg_confidence: avgConfidence,
      metrics: metrics
    };
  } catch (error) {
    console.error('Pressure summary error:', error.message);
    throw error;
  }
}

/**
 * Calculate antibiotic-level pressure breakdown for a specific organism + district
 * Shows which antibiotics were used and how much pressure each contributes
 * 
 * MODEL A: Only count usage events with valid ML baseline
 * Entries without ml_resistance_probability are excluded to avoid artificial dilution
 * 
 * @param {object} filters - { organism, district, time_window }
 * @returns {Promise<Array>} Antibiotic breakdown with pressure contribution
 */
export async function getAntibioticPressureBreakdown(filters = {}) {
  try {
    const { organism, district, time_window = 30 } = filters;

    const { data, error } = await fetchEntries({ organism, district, time_window });

    if (error) throw error;

    if (!data || data.length === 0) {
      return [];
    }

    // MODEL A: Filter to only entries with valid ML baseline
    // This ensures we don't dilute pressure metrics with entries that have no ML data
    const validEntries = data.filter(entry => {
      const mlProb = parseFloat(entry.ml_resistance_probability);
      return typeof mlProb === 'number' && !isNaN(mlProb) && mlProb > 0;
    });

    if (validEntries.length === 0) {
      return [];
    }

    // Group by organism + district + antibiotic
    const antibioticGroups = {};

    for (const entry of validEntries) {
      const species =
        entry.species ||
        entry.bacterial_species ||
        entry.bacterialspecies ||
        'Unknown';

      // Skip if filtering by organism and this doesn't match
      if (organism && !species.toLowerCase().includes(organism.toLowerCase())) {
        continue;
      }

      const dist = entry.district || 'Unknown';

      // Skip if filtering by district and this doesn't match
      if (district && dist !== district) {
        continue;
      }

      const mlProb = parseFloat(entry.ml_resistance_probability);

      // Extract antibiotics from prescription details or antibiotic results
      const prescriptionText = entry.prescription_details || entry.prescriptiondetails || '';
      const resultsText = entry.antibiotic_results || entry.antibioticresults || entry.susceptibility || entry.susceptibility_results || '';
      const clinicalNotesText = entry.clinical_notes || '';
      const combinedText = `${prescriptionText} ${resultsText} ${clinicalNotesText}`;

      let antibiotics = extractAntibiotics(combinedText);

      // If no antibiotics found from extraction, manually search all known antibiotics
      if (antibiotics.length === 0) {
        const searchText = combinedText.toLowerCase();
        for (const abx of KNOWN_ANTIBIOTICS) {
          if (searchText.includes(abx.toLowerCase())) {
            antibiotics.push(abx);
          }
        }
      }

      // If STILL no antibiotics, mark as unspecified
      if (antibiotics.length === 0) {
        antibiotics = ['Baseline-Only'];
      }

      // If STILL no antibiotics, mark as unspecified
      if (antibiotics.length === 0) {
        antibiotics = ['Baseline-Only'];
      }

      // Record pressure contribution from this entry
      for (const abx of antibiotics) {
        const key = `${species}|||${dist}|||${abx}`;

        if (!antibioticGroups[key]) {
          antibioticGroups[key] = {
            organism: species,
            district: dist,
            antibiotic: abx,
            pressureScores: [],
            count: 0
          };
        }

        antibioticGroups[key].pressureScores.push(mlProb);
        antibioticGroups[key].count += 1;
      }
    }

    // Calculate metrics for each antibiotic (only those with valid ML data)
    const breakdown = Object.entries(antibioticGroups)
      .map(([key, group]) => {
        const totalPressure = group.pressureScores.reduce((sum, p) => sum + p, 0);
        const avgPressure = group.count > 0 ? totalPressure / group.count : 0;

        return {
          organism: group.organism,
          district: group.district,
          antibiotic: group.antibiotic,
          usage_count: group.count,
          total_pressure: parseFloat(totalPressure.toFixed(3)),
          average_pressure_percent: parseFloat((avgPressure * 100).toFixed(1)),
          contribution_percent: 0 // Will calculate after sorting
        };
      })
      .sort((a, b) => b.total_pressure - a.total_pressure); // Sort by pressure contribution

    // Calculate percentage contribution to total for this organism/district
    if (breakdown.length > 0) {
      const totalOrgPressure = breakdown.reduce((sum, item) => sum + item.total_pressure, 0);
      breakdown.forEach(item => {
        item.contribution_percent = totalOrgPressure > 0
          ? parseFloat(((item.total_pressure / totalOrgPressure) * 100).toFixed(1))
          : 0;
      });
    }

    return breakdown;
  } catch (error) {
    console.error('Antibiotic breakdown error:', error.message);
    throw error;
  }
}
