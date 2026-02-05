// src/scripts/pharmacist-resistance-check.js
// Real-time resistance indicator for hospital pharmacy entry form

const BACKEND_URL = 'http://localhost:3001';

/**
 * When a hospital pharmacy user enters a bacterial species,
 * show them the Resistance Pressure Index from analytics
 */
export async function checkResistanceData(species, district = 'Kottayam') {
  try {
    // Fetch RWUI data for this organism + district
    const url = `${BACKEND_URL}/api/analytics/rwui?organism=${encodeURIComponent(species)}&district=${encodeURIComponent(district)}`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (!data.ok || !data.data || data.data.length === 0) {
      hideResistanceAlert();
      return null;
    }

    // Get first matching metric
    const metric = data.data[0];
    
    // Display alert to pharmacist
    showResistanceAlert(metric);
    return metric;

  } catch (error) {
    console.error('Resistance check failed:', error);
    hideResistanceAlert();
  }
}

function showResistanceAlert(metric) {
  const alert = document.getElementById('resistanceAlert');
  const title = document.getElementById('resistanceTitle');
  const text = document.getElementById('resistanceText');

  if (!alert) return;

  const rwuiPercent = (metric.rwui_value * 100).toFixed(1);
  const riskLevel = metric.risk_level.toUpperCase();
  
  // Set styling based on risk
  let color = '#10b981'; // low (green)
  if (metric.risk_level === 'critical') {
    color = '#ef4444'; // critical (red)
  } else if (metric.risk_level === 'high') {
    color = '#f59e0b'; // high (orange)
  } else if (metric.risk_level === 'medium') {
    color = '#f59e0b'; // medium (orange)
  }

  title.textContent = `⚠️ ${metric.organism} - ${riskLevel} RISK`;
  title.style.color = color;

  text.innerHTML = `
    <div style="margin: 5px 0;">
      <strong>Resistance Pressure Index in ${metric.district}:</strong> ${rwuiPercent}%
    </div>
    <div style="margin: 5px 0;">
      <strong>Tests:</strong> ${metric.total_count} | <strong>Resistant:</strong> ${metric.resistant_count}
    </div>
    <div style="margin-top: 10px; font-size: 0.9em;">
      ${getRiskAdvice(metric.risk_level, metric.organism)}
    </div>
  `;

  alert.style.display = 'block';
  alert.style.borderLeftColor = color;
  alert.style.backgroundColor = color + '15'; // Light background
}

function hideResistanceAlert() {
  const alert = document.getElementById('resistanceAlert');
  if (alert) {
    alert.style.display = 'none';
  }
}

function getRiskAdvice(riskLevel, organism) {
  const adviceMap = {
    critical: `⛔ ${organism} is RESISTANT in your district. Use alternative antibiotics.`,
    high: `⚠️ High resistance to ${organism}. Consider alternatives.`,
    medium: `ℹ️ Moderate resistance to ${organism}. Use with caution.`,
    low: `✅ Low resistance to ${organism}. Generally safe choice.`
  };
  
  return adviceMap[riskLevel] || 'No data available';
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  const speciesInput = document.getElementById('species');
  
  if (speciesInput) {
    // Check resistance when user finishes typing
    let timeout;
    speciesInput.addEventListener('input', (e) => {
      clearTimeout(timeout);
      const species = e.target.value.trim();
      
      if (species.length >= 3) {
        timeout = setTimeout(() => {
          console.log('🔍 Checking resistance for:', species);
          checkResistanceData(species);
        }, 500); // Debounce 500ms
      } else {
        hideResistanceAlert();
      }
    });
  }
});
