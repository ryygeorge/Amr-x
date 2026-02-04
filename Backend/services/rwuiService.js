// Backend/services/rwuiService.js
// RWUI Analytics - Read from pharmacist_entries
// RWUI = Resistance Rate = resistant_count / total_count

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
      `species.ilike.%${organism}%,bacterial_species.ilike.%${organism}%,bacterialspecies.ilike.%${organism}%`
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
 * Computes resistance rates by parsing antibiotic_results field
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
