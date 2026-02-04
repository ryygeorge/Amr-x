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
 */
async function loadAnalytics() {
  try {
    showLoading(true);
    hideError();

    // Get filter values
    const district = document.getElementById('districtFilter').value;
    const timeWindow = document.getElementById('timeWindowFilter').value;

    // Build query string - point to backend server
    const BACKEND_URL = 'http://localhost:3001';
    let rwuiUrl = BACKEND_URL + '/api/analytics/rwui?time_window=' + timeWindow;
    let summaryUrl = BACKEND_URL + '/api/analytics/summary?time_window=' + timeWindow;
    
    if (district) {
      rwuiUrl += '&district=' + encodeURIComponent(district);
      summaryUrl += '&district=' + encodeURIComponent(district);
    }

    console.log('📡 Fetching from:', rwuiUrl);

    // Fetch both endpoints
    const [rwuiRes, summaryRes] = await Promise.all([
      fetch(rwuiUrl),
      fetch(summaryUrl)
    ]);

    if (!rwuiRes.ok || !summaryRes.ok) {
      throw new Error('Failed to fetch analytics data');
    }

    const rwuiData = await rwuiRes.json();
    const summaryData = await summaryRes.json();

    if (!rwuiData.ok || !summaryData.ok) {
      throw new Error(rwuiData.error || summaryData.error || 'Unknown error');
    }

    // Store metrics for later use
    currentMetrics = rwuiData.data || [];

    // Update UI
    updateSummaryCards(summaryData.summary);
    updateMetricsTable(currentMetrics);
    updateAntibioticsTable(summaryData.summary?.top_antibiotics || []);
    updateCharts(currentMetrics, summaryData.summary);

    showLoading(false);

  } catch (error) {
    console.error('❌ Analytics error:', error);
    showError('Failed to load analytics: ' + error.message);
    showLoading(false);
  }
}

/**
 * Update summary cards
 */
function updateSummaryCards(summary) {
  document.getElementById('totalEntries').textContent = 
    summary.total_entries || '0';
  
  document.getElementById('averageRWUI').textContent = 
    summary.average_rwui ? (summary.average_rwui * 100).toFixed(1) + '%' : '0%';
  
  document.getElementById('criticalCount').textContent = 
    summary.critical_risk_count || '0';
  
  document.getElementById('highCount').textContent = 
    summary.high_risk_count || '0';
}

/**
 * Update metrics table
 */
function updateMetricsTable(metrics) {
  const tbody = document.getElementById('metricsTableBody');

  if (!metrics || metrics.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 30px; color: #9ca3c9;">
          No data available for selected filters
        </td>
      </tr>
    `;
    return;
  }

  const rows = metrics.map(metric => {
    const rwuiPercent = (metric.rwui_value * 100).toFixed(1);
    const riskColor = getRiskColor(metric.risk_level);

    return `
      <tr>
        <td>${escapeHtml(metric.organism)}</td>
        <td>${escapeHtml(metric.district)}</td>
        <td><strong>${rwuiPercent}%</strong></td>
        <td>
          <span class="risk-badge" style="background: ${riskColor};">
            ${metric.risk_level.toUpperCase()}
          </span>
        </td>
        <td>${metric.total_count}</td>
        <td>${metric.resistant_count}</td>
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
 * Update charts
 */
function updateCharts(metrics, summary) {
  if (!metrics || metrics.length === 0) {
    return;
  }

  // Prepare data for resistance chart
  const organisms = metrics.map(m => m.organism);
  const rwuiValues = metrics.map(m => (m.rwui_value * 100).toFixed(1));
  const colors = metrics.map(m => getRiskColor(m.risk_level));

  // Destroy existing charts
  if (resistanceChart) resistanceChart.destroy();
  if (riskChart) riskChart.destroy();

  // Chart 1: Resistance Rate by Organism
  const ctx1 = document.getElementById('resistanceChart').getContext('2d');
  resistanceChart = new Chart(ctx1, {
    type: 'bar',
    data: {
      labels: organisms,
      datasets: [{
        label: 'RWUI (%)',
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
              return context.parsed.y.toFixed(1) + '%';
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

  // Chart 2: Risk Distribution (Pie)
  const riskCounts = {
    critical: summary.critical_risk_count || 0,
    high: summary.high_risk_count || 0,
    medium: 0,
    low: 0
  };

  // Count medium and low from metrics
  metrics.forEach(m => {
    if (m.risk_level === 'medium') riskCounts.medium++;
    else if (m.risk_level === 'low') riskCounts.low++;
  });

  const ctx2 = document.getElementById('riskChart').getContext('2d');
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
          '#f59e0b', // yellow (medium)
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
