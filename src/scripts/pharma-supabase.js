// scripts/pharma-supabase.js - COMPLETE FIXED VERSION WITH ADMIN CHECK
import { supabase } from './supabase-init.js';

// DOM refs
const summaryEl = document.getElementById('pharm-summary');
const tbody = document.getElementById('pharmTbody');
const pharmBarCanvas = document.getElementById('pharmBar');
const pharmLineCanvas = document.getElementById('pharmLine');
const insightsEl = document.getElementById('pharmInsights');

// Chart.js chart instances
let barChart = null;
let lineChart = null;

// ============================================
// ADMIN CHECK - ADD THIS AT THE BEGINNING
// ============================================
const ADMIN_EMAILS = [
  "ryy@gmail.com",
  "admin@amrx.com"
];

function isAdminEmail(email) {
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

async function checkAndRedirectAdmins() {
  try {
    // Check if we just came from an admin redirect attempt
    const adminRedirectAttempted = localStorage.getItem('adminRedirectAttempted');
    if (adminRedirectAttempted === 'true') {
      console.log('Already attempted admin redirect, allowing access to pharmacist page');
      localStorage.removeItem('adminRedirectAttempted');
      return false; // Don't redirect, allow access to pharmacist page
    }
    
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      console.warn('Auth check error:', error);
      return false;
    }
    
    if (user && isAdminEmail(user.email)) {
      // Admin trying to access pharmacist page - redirect to admin
      console.log('Admin detected, redirecting to admin panel...');
      window.location.href = 'admin.html';
      return true; // Redirect happened
    }
    
    return false; // No redirect needed
  } catch (error) {
    console.warn('Admin redirect check error:', error);
    return false;
  }
}
// ============================================
// END OF ADMIN CHECK
// ============================================

// Check authentication and get pharmacist info
async function checkPharmacistAuth() {
  try {
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('Authentication error:', authError);
      window.location.href = 'login.html?role=pharma';
      return null;
    }

    // Get pharmacist profile
    const { data: pharmacist, error: profileError } = await supabase
      .from('pharmacists')
      .select('full_name, pharmacy_name, district, is_verified')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.warn('Could not fetch pharmacist profile:', profileError);
      // Continue with basic user info
      return {
        id: user.id,
        name: user.user_metadata?.name || user.email?.split('@')[0],
        email: user.email
      };
    }

    // Update welcome message on dashboard
    const welcomeText = document.getElementById('welcomeText');
    const greetingSubtitle = document.querySelector('.greeting-subtitle');
    
    if (welcomeText && pharmacist) {
      const firstName = pharmacist.full_name?.split(' ')[0] || pharmacist.pharmacy_name || 'Pharmacist';
      welcomeText.textContent = `Welcome, ${firstName}!`;
    }
    
    if (greetingSubtitle && pharmacist) {
      greetingSubtitle.textContent = `AMR-X Dashboard for ${pharmacist.pharmacy_name} in ${pharmacist.district} District, Kerala`;
    }

    return {
      id: user.id,
      name: pharmacist.full_name,
      pharmacy_name: pharmacist.pharmacy_name,
      district: pharmacist.district,
      email: user.email,
      is_verified: pharmacist.is_verified
    };

  } catch (error) {
    console.error('Auth check error:', error);
    return null;
  }
}

// Dispatch event for backward compatibility with inline script
function dispatchPharmEntriesEvent(items) {
  try {
    // Convert to Firebase-like format for backward compatibility
    const firebaseLikeItems = items.map(item => ({
      species: item.species || item.bacterialSpecies || item.bacterialspecies || '',
      bacterialSpecies: item.bacterialSpecies || item.bacterialspecies || '',
      bacterial: item.bacterial || '',
      bacteria: item.bacteria || '',
      prescriptionDetails: item.prescriptionDetails || item.prescriptiondetails || item.prescription || '',
      prescription: item.prescription || item.prescriptiondetails || '',
      susceptibility: item.susceptibility || item.antibioticResults || item.antibioticresults || '',
      antibioticResults: item.antibioticResults || item.antibioticresults || '',
      clinicalNotes: item.clinicalNotes || item.clinicalnotes || item.notes || '',
      notes: item.notes || item.clinicalnotes || '',
      createdAt: item.created_at ? {
        seconds: Math.floor(new Date(item.created_at).getTime() / 1000),
        nanoseconds: 0
      } : null,
      created_at: item.created_at
    }));
    
    // Dispatch custom event that the inline script listens for
    window.dispatchEvent(new CustomEvent('pharmEntries', {
      detail: firebaseLikeItems
    }));
    console.log('✅ Dispatched pharmEntries event with', items.length, 'items');
  } catch (error) {
    console.warn('Error dispatching pharmEntries event:', error);
  }
}

// Utility: escape HTML
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}

// Normalization helpers - UPDATED TO HANDLE LOWERCASE COLUMNS
function getField(docObj, candidates) {
  if (!docObj) return undefined;
  
  // First check the candidates as given (original case)
  for (const k of candidates) {
    if (Object.prototype.hasOwnProperty.call(docObj, k) && docObj[k] !== undefined && docObj[k] !== null && docObj[k] !== '') {
      return docObj[k];
    }
  }
  
  // Then check lowercase versions of candidates
  for (const k of candidates) {
    const lowerKey = k.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(docObj, lowerKey) && docObj[lowerKey] !== undefined && docObj[lowerKey] !== null && docObj[lowerKey] !== '') {
      return docObj[lowerKey];
    }
  }
  
  // Then check snake_case versions
  for (const k of candidates) {
    const snakeKey = k.replace(/([A-Z])/g, "_$1").toLowerCase();
    if (Object.prototype.hasOwnProperty.call(docObj, snakeKey) && docObj[snakeKey] !== undefined && docObj[snakeKey] !== null && docObj[snakeKey] !== '') {
      return docObj[snakeKey];
    }
  }
  
  return undefined;
}

// Format timestamp
function formatTimestamp(ts) {
  if (!ts) return '-';
  try {
    const date = new Date(ts);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  } catch (e) {
    return String(ts);
  }
}

// Destroy existing Chart.js chart
function safeDestroyChartOnCanvas(canvasEl) {
  if (!canvasEl) return;
  try {
    const existing = Chart.getChart(canvasEl);
    if (existing) existing.destroy();
  } catch (err) {
    console.warn('Chart destroy failed', err);
  }
}

// Build table rows
function renderTable(items) {
  if (!tbody) return;
  if (!items || items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5">No pharmacist entries yet</td></tr>`;
    dispatchPharmEntriesEvent([]);
    return;
  }

  const rowsHtml = items.slice(0, 50).map(doc => {
    // Check multiple possible column names (including lowercase)
    const species = getField(doc, ['species','bacterialSpecies','bacterialspecies','bacterial','bacteria']);
    const prescription = getField(doc, ['prescriptionDetails','prescriptiondetails','prescription','prescriptionDetail','prescription_detail']);
    const susceptibility = getField(doc, ['susceptibility','antibioticResults','antibioticresults','antibioticSusceptibilityResults','susceptibilityResults','antibiotic_susceptibility_results']);
    const clinicalNotes = getField(doc, ['clinicalNotes','clinicalnotes','notes','clinical','clinical_notes']);
    const createdAt = getField(doc, ['created_at','createdAt','timestamp','time']) || doc.created_at;

    const timeStr = formatTimestamp(createdAt);

    return `
      <tr>
        <td>${escapeHtml(timeStr)}</td>
        <td>${escapeHtml(species ?? '-')}</td>
        <td>${escapeHtml(prescription ?? '-')}</td>
        <td>${escapeHtml(susceptibility ?? '-')}</td>
        <td>${escapeHtml(clinicalNotes ?? '-')}</td>
      </tr>
    `;
  }).join('');

  tbody.innerHTML = rowsHtml;
  
  // Dispatch event for backward compatibility
  dispatchPharmEntriesEvent(items);
}

// Build species counts
function buildSpeciesCounts(items) {
  const counts = {};
  if (!items) return [];
  
  for (const d of items) {
    const val = getField(d, ['species','bacterialSpecies','bacterialspecies','bacterial','bacteria']);
    if (!val) continue;
    
    // Clean up the species name
    let speciesName = String(val).trim();
    
    // Extract first species if multiple are listed
    if (speciesName.includes(',')) {
      speciesName = speciesName.split(',')[0].trim();
    }
    
    // Clean common prefixes/suffixes
    speciesName = speciesName
      .replace(/^E\.?\s*coli$/i, 'E. coli')
      .replace(/^Klebsiella\s*pneumoniae$/i, 'Klebsiella pneumoniae')
      .replace(/^Pseudomonas\s*aeruginosa$/i, 'Pseudomonas aeruginosa')
      .replace(/^Staphylococcus\s*aureus$/i, 'Staphylococcus aureus');
    
    if (speciesName) {
      counts[speciesName] = (counts[speciesName] || 0) + 1;
    }
  }
  
  return Object.entries(counts).sort((a,b) => b[1] - a[1]);
}

// Build daily counts
function buildDailyCounts(items) {
  const daily = {};
  if (!items) return [];
  
  for (const d of items) {
    const createdAt = getField(d, ['created_at','createdAt','timestamp','time']) || d.created_at;
    const ts = createdAt ? new Date(createdAt).getTime() : Date.now();
    const key = new Date(ts).toISOString().slice(0,10);
    daily[key] = (daily[key] || 0) + 1;
  }
  
  const entries = Object.entries(daily).sort((a,b)=> new Date(a[0]) - new Date(b[0]));
  
  // Limit to last 30 days for better visualization
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  return entries.filter(([date]) => new Date(date) >= thirtyDaysAgo);
}

// Update summary
function updateSummary(total, extraObj = {}) {
  if (!summaryEl) return;
  const recent = Math.min(total, 10);
  summaryEl.innerHTML = `<strong>Total Logs:</strong> ${total} &nbsp;|&nbsp; <strong>Recent:</strong> ${recent}`;
}

// Insights generator
function generateInsights(items) {
  const insights = [];
  if (!items || items.length === 0) {
    insights.push('<strong>No data yet.</strong> Start by submitting your first entry.');
    return insights;
  }
  
  const speciesCounts = buildSpeciesCounts(items);
  if (speciesCounts.length) {
    const top = speciesCounts.slice(0,3).map(s => `${s[0]} (${s[1]})`).join(', ');
    insights.push(`<strong>Top species:</strong> ${top}`);
  } else {
    insights.push(`<strong>Top species:</strong> none recorded`);
  }

  // Check for resistance patterns
  const susText = items.map(d => 
    (getField(d, ['susceptibility','antibioticResults','antibioticresults','antibiotic_susceptibility_results']) || '')
    .toString()
    .toLowerCase()
  ).join(' || ');
  
  const hasResistant = /resistant|resistance|r:|r\s*$|not\s+sensitive|no\s+response/i.test(susText);
  const hasSensitive = /sensitive|susceptible|s:|s\s*$|effective|responds/i.test(susText);
  
  if (hasResistant && !hasSensitive) {
    insights.push('<strong>Alert:</strong> Multiple resistant cases detected — review antibiogram.');
  } else if (hasResistant && hasSensitive) {
    insights.push('<strong>Note:</strong> Mixed susceptibility patterns observed.');
  } else if (hasSensitive && !hasResistant) {
    insights.push('<strong>Note:</strong> Mostly sensitive results recorded.');
  }

  // Check clinical notes for flags
  const notesText = items.map(d => 
    (getField(d, ['clinicalNotes','clinicalnotes','notes','clinical_notes']) || '')
    .toString()
    .toLowerCase()
  ).join(' || ');
  
  const flags = ['severe','allergic','reaction','worse','ineffective','no change','moderate','critical','urgent','fever','pain'].filter(k => 
    notesText.includes(k.toLowerCase())
  );
  
  if (flags.length) {
    const uniqueFlags = [...new Set(flags)].slice(0, 5);
    insights.push(`<strong>Clinical flags:</strong> ${uniqueFlags.join(', ')}`);
  }

  // Add total entries insight
  if (items.length > 20) {
    insights.push(`<strong>Activity:</strong> ${items.length} entries logged — good tracking!`);
  }

  return insights;
}

// Chart helpers
function drawSpeciesBar(labels, values) {
  if (!pharmBarCanvas) return;
  safeDestroyChartOnCanvas(pharmBarCanvas);

  try {
    barChart = new Chart(pharmBarCanvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels,
        datasets: [{ 
          label: 'Count', 
          data: values, 
          backgroundColor: '#22c1c3',
          borderColor: '#1a9a9c',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        plugins: { 
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            titleColor: '#fff',
            bodyColor: '#fff'
          }
        },
        scales: {
          x: { 
            ticks: { color: '#e5edff', maxRotation: 45 },
            grid: { color: 'rgba(148,163,184,0.12)' } 
          },
          y: { 
            ticks: { color: '#e5edff' }, 
            grid: { color: 'rgba(148,163,184,0.12)' }, 
            beginAtZero: true 
          }
        }
      }
    });
  } catch (err) {
    console.warn('drawSpeciesBar failed', err);
  }
}

function drawLineDaily(labels, values) {
  if (!pharmLineCanvas) return;
  safeDestroyChartOnCanvas(pharmLineCanvas);

  try {
    lineChart = new Chart(pharmLineCanvas.getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Entries per day',
          data: values,
          fill: true,
          tension: 0.25,
          backgroundColor: 'rgba(34,193,195,0.15)',
          borderColor: '#22c1c3',
          pointBackgroundColor: '#22c1c3',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true,
        plugins: { 
          legend: { 
            labels: { 
              color: '#e5edff',
              font: { size: 12 }
            } 
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            titleColor: '#fff',
            bodyColor: '#fff'
          }
        },
        scales: {
          x: { 
            ticks: { 
              color: '#e5edff',
              maxTicksLimit: 10
            }, 
            grid: { color: 'rgba(148,163,184,0.08)' } 
          },
          y: { 
            ticks: { color: '#e5edff' }, 
            grid: { color: 'rgba(148,163,184,0.08)' }, 
            beginAtZero: true 
          }
        }
      }
    });
  } catch (err) {
    console.warn('drawLineDaily failed', err);
  }
}

// Initialize Supabase real-time subscription
(async function initRealtime() {
  try {
    console.log('🔄 Initializing pharma-supabase...');
    
    // ============================================
    // CHECK FOR ADMIN REDIRECT FIRST
    // ============================================
    const shouldRedirect = await checkAndRedirectAdmins();
    if (shouldRedirect) {
      console.log('Redirecting admin to admin panel...');
      return; // Stop execution if redirecting
    }
    // ============================================
    
    // Check authentication and get pharmacist info
    const pharmacist = await checkPharmacistAuth();
    if (!pharmacist) {
      console.log('No authenticated pharmacist');
      if (tbody) tbody.innerHTML = `<tr><td colspan="5">Please login to view data</td></tr>`;
      return;
    }

    console.log('✅ Pharmacist found:', pharmacist.name, 'from', pharmacist.district);

    // Initial fetch - filter by pharmacist's user_id
    const { data: initialData, error } = await supabase
      .from('pharmacist_entries')
      .select('*')
      .eq('user_id', pharmacist.id)
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      console.error('Error fetching data:', error);
      
      // Check specific error types
      if (error.code === '42P01') {
        console.error('Table pharmacist_entries does not exist. Please create it in Supabase.');
        if (tbody) tbody.innerHTML = `<tr><td colspan="5">Database table not set up. Please contact admin.</td></tr>`;
      } else if (error.code === '42703') {
        console.error('Column error - table structure mismatch:', error.message);
        if (tbody) tbody.innerHTML = `<tr><td colspan="5">Database column mismatch. Please update table.</td></tr>`;
      } else {
        if (tbody) tbody.innerHTML = `<tr><td colspan="5">Error loading data: ${error.message}</td></tr>`;
      }
      return;
    }

    console.log('📊 Data loaded:', initialData?.length || 0, 'entries');

    // Initial render
    renderTable(initialData || []);
    
    // Draw species chart
    const speciesPairs = buildSpeciesCounts(initialData || []);
    if (speciesPairs.length) {
      const top = speciesPairs.slice(0, 8);
      drawSpeciesBar(top.map(p => p[0]), top.map(p => p[1]));
    } else {
      drawSpeciesBar(['No species yet'], [0]);
    }

    // Draw timeline chart
    const dailyPairs = buildDailyCounts(initialData || []);
    if (dailyPairs.length) {
      const lineLabels = dailyPairs.map(p => {
        const date = new Date(p[0]);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      });
      const lineValues = dailyPairs.map(p => p[1]);
      drawLineDaily(lineLabels, lineValues);
    } else {
      const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      drawLineDaily([today], [0]);
    }

    // Generate insights
    const insights = generateInsights(initialData || []);
    if (insightsEl) {
      insightsEl.innerHTML = insights.map(x => `<div style="margin-bottom:8px">${x}</div>`).join('');
    }
    
    updateSummary((initialData || []).length);

    // Set up real-time subscription
    const channel = supabase
      .channel('pharmacist_entries_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pharmacist_entries',
          filter: `user_id=eq.${pharmacist.id}`
        },
        async (payload) => {
          console.log('🔄 Real-time update:', payload.eventType);
          
          // Refetch data on any change
          const { data: updatedData, error: fetchError } = await supabase
            .from('pharmacist_entries')
            .select('*')
            .eq('user_id', pharmacist.id)
            .order('created_at', { ascending: false })
            .limit(500);

          if (!fetchError && updatedData) {
            renderTable(updatedData);
            
            const speciesPairs = buildSpeciesCounts(updatedData);
            if (speciesPairs.length) {
              const top = speciesPairs.slice(0, 8);
              drawSpeciesBar(top.map(p => p[0]), top.map(p => p[1]));
            }
            
            const dailyPairs = buildDailyCounts(updatedData);
            if (dailyPairs.length) {
              const lineLabels = dailyPairs.map(p => {
                const date = new Date(p[0]);
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              });
              const lineValues = dailyPairs.map(p => p[1]);
              drawLineDaily(lineLabels, lineValues);
            }
            
            const insights = generateInsights(updatedData);
            if (insightsEl) insightsEl.innerHTML = insights.map(x => `<div style="margin-bottom:8px">${x}</div>`).join('');
            
            updateSummary(updatedData.length);
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Subscription status:', status);
      });

    console.log('✅ Real-time subscription active');

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
      supabase.removeChannel(channel);
    });

  } catch (e) {
    console.error('pharma-supabase init error', e);
    if (tbody) tbody.innerHTML = `<tr><td colspan="5">Error loading data: ${e.message}</td></tr>`;
    if (insightsEl) insightsEl.innerHTML = `<div style="color:#f97373">Error: ${e.message}</div>`;
  }
})();

// Export for potential use in other modules
export { renderTable, buildSpeciesCounts, buildDailyCounts, generateInsights };

// ===============================
// ML PREDICTION → SUPABASE SAVE
// ===============================
export async function saveMLPrediction(prediction) {
  try {
    const { data, error } = await supabase
      .from('ml_predictions')
      .insert([{
        organism: prediction.organism,
        antibiotic: prediction.antibiotic,
        resistance_probability: prediction.resistance_probability,
        risk_level: prediction.risk_level,
        confidence: prediction.confidence,
        recommendation: prediction.recommendation,
        model_version: prediction.model_version || 'AMR-Predict v2.1'
      }]);

    if (error) {
      console.error('Supabase insert error:', error);
    } else {
      console.log('ML prediction saved');
    }
  } catch (err) {
    console.error('Unexpected save error:', err);
  }
}
