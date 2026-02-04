// src/scripts/analytics.js
// RWUI Analytics Dashboard

import { supabase } from './supabase-init.js';

let resistanceChart = null;
let riskChart = null;
let currentMetrics = [];

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  console.log('📊 Analytics Dashboard Loading...');

  // Apply pharmacist context (district) from login
  applyDistrictContext();

  // Load initial data
  await loadAnalytics();

  // Auto-refresh when time window changes
  document.getElementById('timeWindowFilter').addEventListener('change', loadAnalytics);
  document.getElementById('logoutBtn').addEventListener('click', handleLogout);
});

function applyDistrictContext() {
  const districtSelect = document.getElementById('districtFilter');
  const district = localStorage.getItem('district') || 'Unknown';

  districtSelect.innerHTML = '';
  const opt = document.createElement('option');
  opt.value = district;
  opt.textContent = district;
  districtSelect.appendChild(opt);
  districtSelect.value = district;

  if (!district || district === 'Unknown') {
    showError('District not set for this login. Please log in again so analytics can scope to your district.');
  }
}

/**
 * Load analytics data from backend
 * UPDATED: Uses Pressure RWUI (v2) endpoints
 */
async function loadAnalytics() {
  try {
    showLoading(true);
    hideError();

    // Get filter values
    const district = document.getElementById('districtFilter').value;
    const timeWindow = document.getElementById('timeWindowFilter').value;

    // Build query string - USE PRESSURE ENDPOINTS
    const BACKEND_URL = 'http://localhost:3001';
    let pressureUrl = BACKEND_URL + '/api/analytics/pressure?time_window=' + timeWindow;
    let summaryUrl = BACKEND_URL + '/api/analytics/pressure/summary?time_window=' + timeWindow;
    
    if (district) {
      pressureUrl += '&district=' + encodeURIComponent(district);
      summaryUrl += '&district=' + encodeURIComponent(district);
    }

    console.log('📡 Fetching Pressure RWUI from:', pressureUrl);

    // Fetch both endpoints
    const [pressureRes, summaryRes] = await Promise.all([
      fetch(pressureUrl),
      fetch(summaryUrl)
    ]);

    if (!pressureRes.ok || !summaryRes.ok) {
      throw new Error('Failed to fetch analytics data');
    }

    const pressureData = await pressureRes.json();
    const summaryData = await summaryRes.json();

    console.log('✅ Pressure data:', pressureData);
    console.log('✅ Summary data:', summaryData);

    if (!pressureData.ok || !summaryData.ok) {
      throw new Error(pressureData.error || summaryData.error || 'Unknown error');
    }

    // Store metrics for later use
    currentMetrics = pressureData.data || [];

    // Update UI - pass summaryData.data (the actual summary object)
    updateSummaryCards(summaryData.data || {});
    updateMetricsTable(currentMetrics);
    updateCharts(currentMetrics, summaryData.data || {});

    showLoading(false);

  } catch (error) {
    console.error('❌ Analytics error:', error);
    showError('Failed to load analytics: ' + error.message);
    showLoading(false);
  }
}

/**
 * Update summary cards with Pressure RWUI terminology
 */
function updateSummaryCards(summary) {
  // Safety checks for undefined fields
  const totalEvents = summary?.total_usage_events ?? 0;
  const avgPressure = summary?.average_pressure ?? 0;
  const criticalCount = summary?.critical_pressure ?? 0;
  const highCount = summary?.high_pressure ?? 0;

  document.getElementById('totalEntries').textContent = totalEvents;
  document.getElementById('averageRWUI').textContent = avgPressure + '%';
  document.getElementById('criticalCount').textContent = criticalCount;
  document.getElementById('highCount').textContent = highCount;
}

/**
 * Update metrics table with Pressure RWUI data + Trend + Confidence
 * UPDATED: Clicking organism shows antibiotic breakdown
 */
function updateMetricsTable(metrics) {
  const tbody = document.getElementById('metricsTableBody');

  if (!metrics || metrics.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 30px; color: #9ca3c9;">
          No usage events with ML probabilities found. Submit pharmacist entries to see resistance pressure data.
        </td>
      </tr>
    `;
    return;
  }

  const rows = metrics.map((metric, idx) => {
    // Safety checks for all fields
    const organism = metric?.organism ?? 'Unknown';
    const district = metric?.district ?? 'Unknown';
    const pressure = metric?.pressure_rwui ?? 0;
    const riskLevel = metric?.risk_level ?? 'low';
    const trend = metric?.trend ?? '→';
    const confidence = metric?.confidence ?? 'low';
    const usageCount = metric?.usage_count ?? 0;
    
    const riskColor = getRiskColor(riskLevel);
    const confidenceColor = confidence === 'high' ? '#10b981' : confidence === 'medium' ? '#f59e0b' : '#ef4444';

    return `
      <tr style="cursor: pointer; transition: background 0.2s;" 
          onmouseover="this.style.background='rgba(79,172,254,0.1)'" 
          onmouseout="this.style.background=''" 
          onclick="showAntibioticBreakdown('${escapeHtml(organism)}', '${escapeHtml(district)}', ${idx})">
        <td>
          <strong>${escapeHtml(organism)}</strong>
          <div style="font-size: 11px; opacity: 0.7; margin-top: 3px;">Click to see antibiotics →</div>
        </td>
        <td>${escapeHtml(district)}</td>
        <td><strong>${pressure}%</strong></td>
        <td>
          <span class="risk-badge" style="background: ${riskColor};">
            ${riskLevel.toUpperCase()}
          </span>
        </td>
        <td style="font-size: 18px; text-align: center;">${trend}</td>
        <td style="color: ${confidenceColor}; font-weight: 600; font-size: 12px;">
          ${confidence.toUpperCase()}<br><span style="font-size: 10px; opacity: 0.7;">(n=${usageCount})</span>
        </td>
        <td>${usageCount}</td>
      </tr>
    `;
  }).join('');

  tbody.innerHTML = rows;
}

/**
 * Update top antibiotics ranking table
 */
function updateAntibioticsTable(items) {
  const tbody = document.getElementById('antibioticsTableBody');
  if (!tbody) return;

  if (!items || items.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align: center; padding: 30px; color: #9ca3c9;">
          Not enough district-level data yet. Add more pharmacist entries.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = items.map(item => {
    const rwuiPercent = (item.rwui_value * 100).toFixed(1);
    return `
      <tr>
        <td>${escapeHtml(item.antibiotic)}</td>
        <td>${rwuiPercent}%</td>
        <td>${item.total_count}</td>
        <td>${item.resistant_count}</td>
      </tr>
    `;
  }).join('');
}

/**
 * Update charts with Pressure RWUI data
 */
function updateCharts(metrics, summary) {
  if (!metrics || metrics.length === 0) {
    return;
  }

  // Safety: provide defaults
  summary = summary || {};
  
  // Prepare data for resistance pressure chart
  const organisms = metrics.map(m => m?.organism ?? 'Unknown');
  const rwuiValues = metrics.map(m => {
    const pressure = m?.pressure_rwui ?? 0;
    return parseFloat(pressure);
  });
  const colors = metrics.map(m => getRiskColor(m?.risk_level ?? 'low'));

  // Destroy existing charts
  if (resistanceChart) resistanceChart.destroy();
  if (riskChart) riskChart.destroy();

  // Chart 1: Resistance Pressure by Organism
  const ctx1 = document.getElementById('resistanceChart');
  if (ctx1) {
    resistanceChart = new Chart(ctx1, {
      type: 'bar',
      data: {
        labels: organisms,
        datasets: [{
          label: 'Resistance Pressure (%)',
          data: rwuiValues,
          backgroundColor: colors,
          borderRadius: 8,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function(context) {
                return 'Baseline Pressure: ' + context.parsed.y.toFixed(1) + '%';
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: { callback: (v) => v + '%' },
            grid: { color: '#1e293b' }
          },
          x: { grid: { display: false } }
        }
      }
    });
  }

  // Chart 2: Risk Distribution (Pie)
  const riskCounts = {
    critical: summary?.critical_pressure ?? 0,
    high: summary?.high_pressure ?? 0,
    medium: 0,
    low: 0
  };

  // Count medium and low from metrics
  if (metrics && Array.isArray(metrics)) {
    metrics.forEach(m => {
      if (m?.risk_level === 'medium') riskCounts.medium++;
      else if (m?.risk_level === 'low') riskCounts.low++;
    });
  }

  const ctx2 = document.getElementById('riskChart');
  if (ctx2) {
    riskChart = new Chart(ctx2, {
      type: 'doughnut',
      data: {
        labels: ['Critical', 'High', 'Medium', 'Low'],
        datasets: [{
          data: [
            riskCounts.critical,
            riskCounts.high,
            riskCounts.medium,
            riskCounts.low
          ],
          backgroundColor: [
            '#ef4444', // red
            '#f59e0b', // amber
            '#fbbf24', // yellow (medium)
            '#10b981'  // green
          ],
          borderColor: '#0f172a',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#cbd5f5', padding: 20 }
          }
        }
      }
    });
  }
}

/**
 * Reset filters to defaults
 */

/**
 * Show/hide loading spinner
 */
function showLoading(show) {
  const spinner = document.getElementById('loadingSpinner');
  if (show) {
    spinner.classList.remove('hidden');
  } else {
    spinner.classList.add('hidden');
  }
}

/**
 * Show error message
 */
function showError(message) {
  const errorEl = document.getElementById('errorMessage');
  errorEl.textContent = message;
  errorEl.classList.remove('hidden');
}

/**
 * Hide error message
 */
function hideError() {
  document.getElementById('errorMessage').classList.add('hidden');
}

/**
 * Get risk level color
 */
function getRiskColor(level) {
  const colors = {
    critical: '#ef4444',  // red
    high: '#f59e0b',      // amber
    medium: '#eab308',    // yellow
    low: '#10b981'        // green
  };
  return colors[level] || '#cbd5f5';
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Handle logout
 */
async function handleLogout() {
  try {
    await supabase.auth.signOut();
    window.location.href = 'login.html';
  } catch (error) {
    console.error('Logout error:', error);
  }
}

/**
 * Show antibiotic breakdown for selected organism
 * Fetches antibiotic-level pressure contribution
 */
async function showAntibioticBreakdown(organism, district, rowIndex) {
  try {
    showLoading(true);

    const BACKEND_URL = 'http://localhost:3001';
    const timeWindow = document.getElementById('timeWindowFilter').value;
    
    let url = `${BACKEND_URL}/api/analytics/pressure/antibiotics?organism=${encodeURIComponent(organism)}&district=${encodeURIComponent(district)}&time_window=${timeWindow}`;

    console.log('📋 Fetching antibiotic breakdown from:', url);

    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch antibiotic breakdown');

    const result = await response.json();
    console.log('✅ Antibiotic breakdown:', result.data);

    showLoading(false);

    // Create and show modal
    displayAntibioticModal(organism, district, result.data || []);

  } catch (error) {
    console.error('❌ Antibiotic breakdown error:', error);
    showError('Failed to load antibiotic breakdown: ' + error.message);
    showLoading(false);
  }
}

/**
 * Display antibiotic breakdown in a modal/popup
 */
function displayAntibioticModal(organism, district, breakdown) {
  // Remove existing modal if any
  const existing = document.getElementById('antibioticModal');
  if (existing) existing.remove();

  // Create modal HTML
  const modal = document.createElement('div');
  modal.id = 'antibioticModal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  `;

  const content = document.createElement('div');
  content.style.cssText = `
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 12px;
    padding: 30px;
    max-width: 600px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
    color: #e2e8f0;
  `;

  // Title
  const title = document.createElement('h2');
  title.textContent = `Antibiotic Pressure Breakdown: ${organism}`;
  title.style.cssText = `
    margin: 0 0 10px 0;
    font-size: 18px;
    color: #f1f5f9;
  `;
  content.appendChild(title);

  const subtitle = document.createElement('p');
  subtitle.textContent = `District: ${district}`;
  subtitle.style.cssText = `
    margin: 0 0 20px 0;
    font-size: 14px;
    color: #94a3b8;
  `;
  content.appendChild(subtitle);

  // Add methodology note
  const methodNote = document.createElement('p');
  methodNote.style.cssText = `
    padding: 12px;
    background: rgba(79, 172, 254, 0.1);
    border-left: 3px solid #4fbafe;
    margin-bottom: 15px;
    font-size: 12px;
    color: #cbd5f5;
    border-radius: 4px;
  `;
  methodNote.innerHTML = `
    <strong>Methodology:</strong> Pressure metrics computed only from usage events with available ML baselines. 
    Entries without ML baselines are excluded to avoid artificial dilution of resistance pressure estimates.
  `;
  content.appendChild(methodNote);

  if (!breakdown || breakdown.length === 0) {
    const emptyMsg = document.createElement('p');
    emptyMsg.textContent = 'No antibiotic data available for this organism.';
    emptyMsg.style.color = '#94a3b8';
    content.appendChild(emptyMsg);
  } else {
    // Create table
    const table = document.createElement('table');
    table.style.cssText = `
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
    `;

    // Header
    const thead = document.createElement('thead');
    thead.innerHTML = `
      <tr style="border-bottom: 2px solid #475569;">
        <th style="text-align: left; padding: 10px; color: #cbd5f5; font-weight: 600;">Antibiotic</th>
        <th style="text-align: center; padding: 10px; color: #cbd5f5; font-weight: 600;">Pressure %</th>
        <th style="text-align: center; padding: 10px; color: #cbd5f5; font-weight: 600;">Tests</th>
        <th style="text-align: right; padding: 10px; color: #cbd5f5; font-weight: 600;">Contribution</th>
      </tr>
    `;
    table.appendChild(thead);

    // Body
    const tbody = document.createElement('tbody');
    breakdown.forEach((item, idx) => {
      const row = document.createElement('tr');
      row.style.cssText = `
        border-bottom: 1px solid #334155;
        ${idx % 2 === 0 ? 'background: rgba(79, 172, 254, 0.05);' : ''}
      `;

      row.innerHTML = `
        <td style="padding: 12px; font-weight: 500;">${escapeHtml(item.antibiotic || 'Unknown')}</td>
        <td style="padding: 12px; text-align: center;">
          <strong style="color: #4fbafe;">${item.average_pressure_percent ?? 0}%</strong>
        </td>
        <td style="padding: 12px; text-align: center; color: #94a3b8;">${item.usage_count ?? 0}</td>
        <td style="padding: 12px; text-align: right; color: #10b981; font-weight: 600;">
          ${item.contribution_percent ?? 0}%
        </td>
      `;
      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    content.appendChild(table);

    // Summary
    const totalPressure = breakdown.reduce((sum, item) => sum + (item.total_pressure || 0), 0);
    const summary = document.createElement('p');
    summary.style.cssText = `
      margin-top: 20px;
      padding-top: 15px;
      border-top: 1px solid #475569;
      font-size: 13px;
      color: #94a3b8;
    `;
    summary.innerHTML = `
      <strong>Total Pressure Score: ${totalPressure.toFixed(3)}</strong><br>
      This shows how much each antibiotic contributes to the organism's overall resistance pressure.
    `;
    content.appendChild(summary);
  }

  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Close';
  closeBtn.style.cssText = `
    margin-top: 20px;
    padding: 10px 20px;
    background: #4fbafe;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
    width: 100%;
  `;
  closeBtn.onclick = () => modal.remove();
  content.appendChild(closeBtn);

  modal.appendChild(content);
  modal.onclick = (e) => {
    if (e.target === modal) modal.remove();
  };

  document.body.appendChild(modal);
}

// Make functions globally accessible for onclick handlers in HTML
window.showAntibioticBreakdown = showAntibioticBreakdown;
