// scripts/pharma-supabase.js
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

// Dispatch event for backward compatibility with inline script
function dispatchPharmEntriesEvent(items) {
  try {
    // Convert to Firebase-like format for backward compatibility
    const firebaseLikeItems = items.map(item => ({
      species: item.species || item.bacterialSpecies || '',
      bacterialSpecies: item.bacterialSpecies || '',
      bacterial: item.bacterial || '',
      bacteria: item.bacteria || '',
      prescriptionDetails: item.prescriptionDetails || item.prescription || '',
      prescription: item.prescription || '',
      susceptibility: item.susceptibility || item.antibioticResults || '',
      antibioticResults: item.antibioticResults || '',
      clinicalNotes: item.clinicalNotes || item.notes || '',
      notes: item.notes || '',
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

// Normalization helpers
function getField(docObj, candidates) {
  if (!docObj) return undefined;
  for (const k of candidates) {
    if (Object.prototype.hasOwnProperty.call(docObj, k) && docObj[k] !== undefined) return docObj[k];
  }
  return undefined;
}

// Format timestamp
function formatTimestamp(ts) {
  if (!ts) return '-';
  try {
    return new Date(ts).toLocaleString();
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
  if (!items.length) {
    tbody.innerHTML = `<tr><td colspan="5">No pharmacist entries yet</td></tr>`;
    dispatchPharmEntriesEvent([]);
    return;
  }

  const rowsHtml = items.slice(0, 50).map(doc => {
    const species = getField(doc, ['species','bacterialSpecies','bacterial','bacteria']);
    const prescription = getField(doc, ['prescriptionDetails','prescription_details','prescription','prescriptionDetail']);
    const susceptibility = getField(doc, ['susceptibility','antibioticResults','antibioticSusceptibilityResults','susceptibilityResults']);
    const clinicalNotes = getField(doc, ['clinicalNotes','clinical_notes','notes','clinical']);
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
  for (const d of items) {
    const val = getField(d, ['species','bacterialSpecies','bacterial','bacteria']);
    if (!val) continue;
    const parts = String(val).split(',').map(s => s.trim()).filter(Boolean);
    for (const p of parts) {
      counts[p] = (counts[p] || 0) + 1;
    }
  }
  return Object.entries(counts).sort((a,b) => b[1] - a[1]);
}

// Build daily counts
function buildDailyCounts(items) {
  const daily = {};
  for (const d of items) {
    const createdAt = getField(d, ['created_at','createdAt','timestamp','time']) || d.created_at;
    const ts = createdAt ? new Date(createdAt).getTime() : Date.now();
    const key = new Date(ts).toISOString().slice(0,10);
    daily[key] = (daily[key] || 0) + 1;
  }
  const entries = Object.entries(daily).sort((a,b)=> new Date(a[0]) - new Date(b[0]));
  return entries;
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
  const speciesCounts = buildSpeciesCounts(items);
  if (speciesCounts.length) {
    const top = speciesCounts.slice(0,3).map(s => s[0]).join(', ');
    insights.push(`<strong>Top species:</strong> ${top}`);
  } else {
    insights.push(`<strong>Top species:</strong> none recorded`);
  }

  const susText = items.map(d => (getField(d, ['susceptibility','antibioticResults','antibiotic_susceptibility_results']) || '').toString().toLowerCase()).join(' || ');
  const hasResistant = susText.includes('resistant') || susText.includes('r:') || susText.includes('resist');
  const hasSensitive = susText.includes('sensitive') || susText.includes('s:') || susText.includes('sensit');
  if (hasResistant && !hasSensitive) insights.push('<strong>Note:</strong> Resistance mentions found — review antibiogram.');
  if (hasSensitive && !hasResistant) insights.push('<strong>Note:</strong> Mostly sensitive results recorded.');

  const notesText = items.map(d => (getField(d, ['clinicalNotes','clinical_notes','notes']) || '').toString().toLowerCase()).join(' || ');
  const flags = ['severe','allergic','reaction','worse','ineffective','no change','moderate'].filter(k => notesText.includes(k));
  if (flags.length) insights.push(`<strong>Clinical flags:</strong> ${[...new Set(flags)].join(', ')}`);

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
        datasets: [{ label: 'Count', data: values, backgroundColor: '#22c1c3' }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#e5edff' }, grid: { color: 'rgba(148,163,184,0.12)' } },
          y: { ticks: { color: '#e5edff' }, grid: { color: 'rgba(148,163,184,0.12)' }, beginAtZero: true }
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
          backgroundColor: 'rgba(34,193,195,0.08)',
          borderColor: '#22c1c3',
          pointRadius: 3
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { labels: { color: '#e5edff' } } },
        scales: {
          x: { ticks: { color: '#e5edff' }, grid: { color: 'rgba(148,163,184,0.08)' } },
          y: { ticks: { color: '#e5edff' }, grid: { color: 'rgba(148,163,184,0.08)' }, beginAtZero: true }
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
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('No user logged in');
      tbody.innerHTML = `<tr><td colspan="5">Please login to view data</td></tr>`;
      return;
    }

    console.log('✅ User found:', user.email);

    // Initial fetch
    const { data: initialData, error } = await supabase
      .from('pharmacist_entries')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      console.error('Error fetching data:', error);
      // Check if table exists
      if (error.code === '42P01') {
        console.error('Table pharmacist_entries does not exist. Please create it in Supabase.');
        tbody.innerHTML = `<tr><td colspan="5">Database table not set up. Please contact admin.</td></tr>`;
      }
      throw error;
    }

    console.log('📊 Data loaded:', initialData?.length || 0, 'entries');

    // Initial render
    renderTable(initialData || []);
    
    const speciesPairs = buildSpeciesCounts(initialData || []);
    if (speciesPairs.length) {
      const top = speciesPairs.slice(0, 8);
      drawSpeciesBar(top.map(p => p[0]), top.map(p => p[1]));
    } else {
      drawSpeciesBar(['No species yet'], [0]);
    }

    const dailyPairs = buildDailyCounts(initialData || []);
    const lineLabels = dailyPairs.map(p => p[0]);
    const lineValues = dailyPairs.map(p => p[1]);
    drawLineDaily(lineLabels, lineValues);

    const insights = generateInsights(initialData || []);
    if (insightsEl) insightsEl.innerHTML = insights.map(x => `<div style="margin-bottom:8px">${x}</div>`).join('');
    
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
          filter: `user_id=eq.${user.id}`
        },
        async (payload) => {
          console.log('🔄 Real-time update:', payload.eventType);
          
          // Refetch data on any change
          const { data: updatedData, error: fetchError } = await supabase
            .from('pharmacist_entries')
            .select('*')
            .eq('user_id', user.id)
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
            const lineLabels = dailyPairs.map(p => p[0]);
            const lineValues = dailyPairs.map(p => p[1]);
            drawLineDaily(lineLabels, lineValues);
            
            const insights = generateInsights(updatedData);
            if (insightsEl) insightsEl.innerHTML = insights.map(x => `<div style="margin-bottom:8px">${x}</div>`).join('');
            
            updateSummary(updatedData.length);
          }
        }
      )
      .subscribe();

    console.log('✅ Real-time subscription active');

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
      supabase.removeChannel(channel);
    });

  } catch (e) {
    console.error('pharma-supabase init error', e);
    if (tbody) tbody.innerHTML = `<tr><td colspan="5">Error loading data</td></tr>`;
    if (insightsEl) insightsEl.innerHTML = `<div style="color:#f97373">Error: ${e.message}</div>`;
  }
})();