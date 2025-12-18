// scripts/pharma-firestore.js
// Real-time listener for 'pharmacist_entries' to populate UI:
//  - #pharm-summary
//  - #pharmTbody
//  - Chart.js charts on #pharmBar and #pharmLine
//  - #pharmInsights text
//
// Requires:
//  - firebase-init.js exports `db` (Firestore instance)
//  - Chart.js is loaded on the page

import { db } from './firebase-init.js';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  limit
} from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';

// DOM refs
const summaryEl = document.getElementById('pharm-summary');
const tbody = document.getElementById('pharmTbody');
const pharmBarCanvas = document.getElementById('pharmBar');
const pharmLineCanvas = document.getElementById('pharmLine');
const insightsEl = document.getElementById('pharmInsights');

// Chart.js chart instances (we will create and update/destroy)
let barChart = null;
let lineChart = null;

// Utility: escape HTML
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}

// Normalization helpers: handle multiple possible field names (keeps it robust)
function getField(docObj, candidates) {
  if (!docObj) return undefined;
  for (const k of candidates) {
    if (Object.prototype.hasOwnProperty.call(docObj, k) && docObj[k] !== undefined) return docObj[k];
  }
  return undefined;
}

// Convert Firestore Timestamp to readable string (works if serverTimestamp used)
function formatTimestamp(ts) {
  if (!ts) return '-';
  try {
    if (typeof ts.toDate === 'function') return ts.toDate().toLocaleString();
    if (ts.seconds) return new Date(ts.seconds * 1000).toLocaleString();
    return new Date(ts).toLocaleString();
  } catch (e) {
    return String(ts);
  }
}

// Destroy existing Chart.js chart on a canvas element (safe)
function safeDestroyChartOnCanvas(canvasEl) {
  if (!canvasEl) return;
  try {
    const existing = Chart.getChart(canvasEl); // Chart.js 3+ helper
    if (existing) existing.destroy();
  } catch (err) {
    // fallback: if we have stored instances, destroy them
    try {
      if (canvasEl === pharmBarCanvas && barChart) { barChart.destroy(); barChart = null; }
      if (canvasEl === pharmLineCanvas && lineChart) { lineChart.destroy(); lineChart = null; }
    } catch (e) {
      console.warn('safeDestroy fallback failed', e);
    }
  }
}

// Build table rows for each doc (expected columns: Date/Time, Species, Prescription, Susceptibility, Clinical Notes)
function renderTable(items) {
  if (!tbody) return;
  if (!items.length) {
    tbody.innerHTML = `<tr><td colspan="5">No pharmacist entries yet</td></tr>`;
    return;
  }

  const rowsHtml = items.slice(0, 50).map(doc => {
    // prefer exact fields found in your screenshot: species, prescriptionDetails, susceptibility, clinicalNotes, createdAt
    const species = getField(doc, ['species','bacterialSpecies','bacterial','bacteria']);
    const prescription = getField(doc, ['prescriptionDetails','prescription_details','prescription','prescriptionDetail']);
    const susceptibility = getField(doc, ['susceptibility','antibioticResults','antibioticSusceptibilityResults','susceptibilityResults']);
    const clinicalNotes = getField(doc, ['clinicalNotes','clinical_notes','notes','clinical']);
    const createdAt = getField(doc, ['createdAt','created_at','timestamp','time']) ?? doc.createdAt ?? doc.timestamp;

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
}

// Build species counts (handles comma-separated species strings as in your example)
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
  // return sorted array of [species, count]
  return Object.entries(counts).sort((a,b) => b[1] - a[1]);
}

// Build daily counts for the line chart
function buildDailyCounts(items) {
  const daily = {};
  for (const d of items) {
    const createdAt = getField(d, ['createdAt','created_at','timestamp','time']) ?? d.createdAt ?? d.timestamp;
    let ts = null;
    if (!createdAt) ts = Date.now();
    else if (typeof createdAt.toDate === 'function') ts = createdAt.toDate().getTime();
    else if (createdAt.seconds) ts = createdAt.seconds * 1000;
    else ts = Number(createdAt) || Date.now();

    const key = new Date(ts).toISOString().slice(0,10); // yyyy-mm-dd
    daily[key] = (daily[key] || 0) + 1;
  }
  const entries = Object.entries(daily).sort((a,b)=> new Date(a[0]) - new Date(b[0]));
  return entries; // [ [date, count], ... ]
}

// Build simple completeness counts (prescription / susceptibility / clinicalNotes / none)
function buildCompletenessCounts(items) {
  const counts = { prescription: 0, susceptibility: 0, clinicalNotes: 0, none: 0 };
  for (const d of items) {
    const prescription = getField(d, ['prescriptionDetails','prescription','prescription_details']);
    const susceptibility = getField(d, ['susceptibility','antibioticResults','antibiotic_susceptibility_results']);
    const notes = getField(d, ['clinicalNotes','clinical_notes','notes']);
    if (prescription) counts.prescription++;
    if (susceptibility) counts.susceptibility++;
    if (notes) counts.clinicalNotes++;
    if (!prescription && !susceptibility && !notes) counts.none++;
  }
  return counts;
}

// Update summary line
function updateSummary(total, extraObj = {}) {
  if (!summaryEl) return;
  // extraObj kept for future (e.g. cured counts). For now show total and recent number
  const recent = Math.min(total, 10);
  summaryEl.innerHTML = `<strong>Total Logs:</strong> ${total} &nbsp;|&nbsp; <strong>Recent:</strong> ${recent}`;
}

// Insights generator (simple heuristics)
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

// Chart helpers: draw/destroy
function drawSpeciesBar(labels, values) {
  if (!pharmBarCanvas) return;
  // destroy any existing Chart on that canvas
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

// Convert Firestore QueryDocumentSnapshot to plain object safely
function snapshotDocToObj(doc) {
  try {
    const data = doc.data();
    // Keep createdAt and others intact for formatting later
    return { id: doc.id, ...data };
  } catch (e) {
    return { id: doc.id };
  }
}

// Initialization: attach Firestore listener
(function initRealtime() {
  try {
    const col = collection(db, 'pharmacist_entries');
    const q = query(col, orderBy('createdAt', 'desc'), limit(500));

    onSnapshot(q, snapshot => {
      const items = [];
      snapshot.forEach(doc => items.push(snapshotDocToObj(doc)));

      // Render table
      renderTable(items);

      // Species counts -> bar chart
      const speciesPairs = buildSpeciesCounts(items);
      if (speciesPairs.length) {
        const top = speciesPairs.slice(0, 8);
        drawSpeciesBar(top.map(p => p[0]), top.map(p => p[1]));
      } else {
        drawSpeciesBar(['No species yet'], [0]);
      }

      // Daily counts -> line chart
      const dailyPairs = buildDailyCounts(items);
      const lineLabels = dailyPairs.map(p => p[0]);
      const lineValues = dailyPairs.map(p => p[1]);
      drawLineDaily(lineLabels, lineValues);

      // Insights -> simple summary
      const insights = generateInsights(items);
      if (insightsEl) insightsEl.innerHTML = insights.map(x => `<div style="margin-bottom:8px">${x}</div>`).join('');
      // Update summary
      updateSummary(items.length);

    }, err => {
      console.error('Firestore pharmacist_entries snapshot error:', err);
      if (tbody) tbody.innerHTML = `<tr><td colspan="5">Error loading data</td></tr>`;
      if (insightsEl) insightsEl.innerHTML = `<div style="color:#f97373">Realtime listener error</div>`;
    });

  } catch (e) {
    console.error('pharma-firestore init error', e);
    if (tbody) tbody.innerHTML = `<tr><td colspan="5">Initialization error</td></tr>`;
    if (insightsEl) insightsEl.innerHTML = `<div style="color:#f97373">Initialization error</div>`;
  }
})();
