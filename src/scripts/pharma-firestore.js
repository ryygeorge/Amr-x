// scripts/pharma-firestore.js
// Real-time listener for 'pharmacist_entries' to populate
// - #pharm-summary
// - #pharmTbody
// - Chart.js charts on #pharmBar and #pharmPie
//
// Requires:
//  - firebase-init.js exports `db` (Firestore instance)
//  - Chart.js is loaded on the page (you already include it in pharma.html)

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
const pharmPieCanvas = document.getElementById('pharmPie');

// Chart.js chart instances (we will create and update)
let barChart = null;
let pieChart = null;

// Utility: escape HTML
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}

// Normalization helpers: handle multiple possible field names
function getField(docObj, candidates) {
  for (const k of candidates) {
    if (k in docObj && docObj[k] !== undefined) return docObj[k];
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

// Build table rows for each doc
function renderTable(items) {
  if (!tbody) return;
  if (!items.length) {
    tbody.innerHTML = `<tr><td colspan="5">No pharmacist entries yet</td></tr>`;
    return;
  }

  // map docs to HTML rows. Show: Medicine(s) / Qty / Dosage / Cured (if exists) / Feedback / Timestamp
  tbody.innerHTML = items.slice(0, 30).map(doc => {
    const data = doc;
    // detect names
    const bacterial = getField(data, ['bacterialSpecies','bacterial_species','bacterial','bacteria','species']);
    const prescription = getField(data, ['prescriptionDetails','prescription_details','prescription','prescriptionDetail','prescription_details_text']);
    const susceptibility = getField(data, ['antibioticSusceptibilityResults','antibiotic_susceptibility_results','susceptibility','susceptibilityResults']);
    const clinicalNotes = getField(data, ['clinicalNotes','clinical_notes','notes','clinical']);
    const createdAt = getField(data, ['createdAt','created_at','timestamp','time']) ?? data.createdAt ?? data.timestamp;
    // quantity/dosage older names
    const quantity = getField(data, ['quantity','qty','amount']);
    const dosage = getField(data, ['dosage','dose']);

    // prefer showing prescription name (if present) else bacterial species
    const firstCol = prescription ? String(prescription) : (bacterial ? String(bacterial) : '-');

    return `
      <tr>
        <td>${escapeHtml(formatTimestamp(createdAt))}</td>
        <td>${escapeHtml(firstCol)}</td>
        <td>${(quantity === 0 || quantity) ? escapeHtml(quantity) : '-'}</td>
        <td>${escapeHtml(dosage ?? '-')}</td>
        <td>${escapeHtml(getField(data, ['cured','isCured','curedStatus']) ?? '-')}</td>
        <td>${escapeHtml((clinicalNotes) ? clinicalNotes : (susceptibility ? susceptibility : '-'))}</td>
      </tr>
    `;
  }).join('');
}

// Build bar chart dataset: count top bacterial species (splitting comma lists)
function buildSpeciesCounts(items) {
  const counts = {};
  for (const d of items) {
    const bacterial = getField(d, ['bacterialSpecies','bacterial_species','bacterial','bacteria','species']);
    if (!bacterial) continue;
    // bacterial could be a string like "E. coli, Klebsiella, Pseudomonas"
    const parts = String(bacterial).split(',').map(s => s.trim()).filter(Boolean);
    for (const p of parts) {
      const key = p;
      counts[key] = (counts[key] || 0) + 1;
    }
  }
  // return sorted entries (desc)
  return Object.entries(counts).sort((a,b)=>b[1]-a[1]);
}

// Build pie chart metrics: presence of prescription/susceptibility/notes/none
function buildCompletenessCounts(items) {
  const counts = { prescription: 0, susceptibility: 0, clinicalNotes: 0, none: 0 };
  for (const d of items) {
    const prescription = getField(d, ['prescriptionDetails','prescription_details','prescription','prescriptionDetail','prescription_details_text']);
    const susceptibility = getField(d, ['antibioticSusceptibilityResults','antibiotic_susceptibility_results','susceptibility','susceptibilityResults']);
    const clinicalNotes = getField(d, ['clinicalNotes','clinical_notes','notes','clinical']);
    if (prescription) counts.prescription++;
    if (susceptibility) counts.susceptibility++;
    if (clinicalNotes) counts.clinicalNotes++;
    if (!prescription && !susceptibility && !clinicalNotes) counts.none++;
  }
  return counts;
}

// Create / update Chart.js bar chart
function drawBarChart(labels, values) {
  if (!pharmBarCanvas) return;
  const data = {
    labels,
    datasets: [{
      label: 'Count',
      data: values,
      backgroundColor: '#22c1c3'
    }]
  };

  const options = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      x: {
        ticks: { color: '#e5edff' },
        grid: { color: 'rgba(148,163,184,0.25)' }
      },
      y: {
        ticks: { color: '#e5edff' },
        grid: { color: 'rgba(148,163,184,0.25)' },
        beginAtZero: true
      }
    }
  };

  // if chart exists, update
  if (barChart) {
    barChart.data = data;
    barChart.options = options;
    barChart.update();
  } else {
    barChart = new Chart(pharmBarCanvas.getContext('2d'), { type: 'bar', data, options });
  }
}

// Create / update Chart.js pie chart
function drawPieChart(labels, values) {
  if (!pharmPieCanvas) return;
  const palette = ['#3bc8d6','#475569','#64748b','#94a3b8'];
  const data = {
    labels,
    datasets: [{
      data: values,
      backgroundColor: palette.slice(0, labels.length),
      borderColor: "rgba(0,0,0,0.3)",
      borderWidth: 1
    }]
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        labels: { color: '#e5e7eb', font: { size: 12 } }
      }
    }
  };

  if (pieChart) {
    pieChart.data = data;
    pieChart.options = options;
    pieChart.update();
  } else {
    pieChart = new Chart(pharmPieCanvas.getContext('2d'), { type: 'pie', data, options });
  }
}

// Update summary line (counts)
function updateSummary(total, countsObj) {
  if (!summaryEl) return;
  const yes = countsObj.yes ?? 0;
  const no = countsObj.no ?? 0;
  summaryEl.innerHTML = `<strong>Total Logs:</strong> ${total} &nbsp;|&nbsp; <strong>Cured Yes:</strong> ${yes} &nbsp;|&nbsp; <strong>Cured No:</strong> ${no}`;
}

// Document -> plain data object
function docToObj(doc) {
  try { const d = doc.data(); return { id: doc.id, ...d }; }
  catch(e){ return { id: doc.id }; }
}

// Subscribe to the collection in real-time
(function initRealtime() {
  try {
    const col = collection(db, 'pharmacist_entries');
    const q = query(col, orderBy('createdAt', 'desc'), limit(500));
    onSnapshot(q, snapshot => {
      const items = [];
      snapshot.forEach(doc => items.push(docToObj(doc)));

      // Render table
      renderTable(items);

      // Build species counts -> bar chart
      const speciesEntries = buildSpeciesCounts(items);
      const topSpecies = speciesEntries.slice(0, 8);
      const labels = topSpecies.map(e => e[0]);
      const values = topSpecies.map(e => e[1]);
      if (labels.length) drawBarChart(labels, values);
      else drawBarChart(['No species yet'], [0]);

      // Build completeness pie
      const completeness = buildCompletenessCounts(items);
      const pieLabels = ['Prescription','Susceptibility','Clinical notes','None'];
      const pieValues = [completeness.prescription, completeness.susceptibility, completeness.clinicalNotes, completeness.none];
      drawPieChart(pieLabels, pieValues);

      // Try to compute cured yes/no if field exists
      const s = v => String(v || '').toLowerCase();
      const yes = items.filter(it => s(getField(it, ['cured','isCured','curedStatus'])) === 'yes').length;
      const no = items.filter(it => s(getField(it, ['cured','isCured','curedStatus'])) === 'no').length;
      updateSummary(items.length, { yes, no });
    }, err => {
      console.error('Firestore pharmacist_entries snapshot error:', err);
      if (tbody) tbody.innerHTML = `<tr><td colspan="5">Error loading data</td></tr>`;
    });
  } catch (e) {
    console.error('pharma-firestore init error', e);
    if (tbody) tbody.innerHTML = `<tr><td colspan="5">Initialization error</td></tr>`;
  }
})();
