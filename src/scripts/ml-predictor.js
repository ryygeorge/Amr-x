// ml-predictor.js
const ML_API_URL = 'https://amrx-ml-api.onrender.com';

// DOM Elements
const form = document.getElementById('predictionForm');
const organismSelect = document.getElementById('organism');
const antibioticSelect = document.getElementById('antibiotic');
const predictBtn = document.getElementById('predictBtn');
const loadingDiv = document.getElementById('loading');
const errorDiv = document.getElementById('error');
const errorMessage = document.getElementById('errorMessage');
const resultDiv = document.getElementById('result');
const emptyState = document.getElementById('emptyState');

// Result display elements
const probabilityValue = document.getElementById('probabilityValue');
const progressFill = document.getElementById('progressFill');
const resultOrganism = document.getElementById('resultOrganism');
const resultAntibiotic = document.getElementById('resultAntibiotic');
const resultRiskLevel = document.getElementById('resultRiskLevel');
const resultModel = document.getElementById('resultModel');
const riskBox = document.getElementById('riskBox');
const riskMessage = document.getElementById('riskMessage');
const riskSuggestion = document.getElementById('riskSuggestion');
const predictionTime = document.getElementById('predictionTime');

// Risk level configurations
const riskConfigs = {
    'low': {
        emoji: '🟢',
        className: 'risk-low',
        message: 'LOW RISK',
        suggestion: 'Likely effective - Standard dosing recommended',
        color: '#28a745'
    },
    'moderate-low': {
        emoji: '🟡',
        className: 'risk-moderate-low',
        message: 'MODERATE-LOW RISK',
        suggestion: 'Use with caution - Monitor response closely',
        color: '#ffc107'
    },
    'moderate-high': {
        emoji: '🟠',
        className: 'risk-moderate-high',
        message: 'MODERATE-HIGH RISK',
        suggestion: 'Significant resistance likely - Consider alternatives',
        color: '#ff9800'
    },
    'high': {
        emoji: '🔴',
        className: 'risk-high',
        message: 'HIGH RISK',
        suggestion: 'High probability of resistance - Strongly consider alternatives',
        color: '#dc3545'
    }
};

// Form submission handler
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const organism = organismSelect.value;
    const antibiotic = antibioticSelect.value;
    
    if (!organism || !antibiotic) {
        showError('Please select both organism and antibiotic');
        return;
    }
    
    // Show loading, hide results/errors
    showLoading();
    hideError();
    hideResult();
    
    try {
        // Make prediction request
        const data = await makePrediction(organism, antibiotic);
        
        // Display results
        displayResult(data);
        
        // Save to local storage for history
        saveToHistory(data);
        
        // Update history display
        updateHistoryDisplay();
        
    } catch (error) {
        showError(error.message);
    } finally {
        hideLoading();
    }
});

// Make prediction API call
async function makePrediction(organism, antibiotic) {
    const response = await fetch(`${ML_API_URL}/api/v1/predict`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            organism: organism,
            antibiotic: antibiotic
        })
    });
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Prediction failed (${response.status})`);
    }
    
    return await response.json();
}

// Display results
function displayResult(data) {
    const riskConfig = riskConfigs[data.risk_level] || riskConfigs['moderate-low'];
    
    // Update DOM elements
    probabilityValue.textContent = data.percentage;
    resultOrganism.textContent = data.organism;
    resultAntibiotic.textContent = data.antibiotic;
    resultRiskLevel.textContent = data.risk_level.toUpperCase().replace('-', ' ');
    resultModel.textContent = data.model_version || 'xgboost_v1.0';
    predictionTime.textContent = new Date(data.timestamp).toLocaleString();
    
    // Set progress bar
    progressFill.style.width = data.percentage;
    progressFill.style.backgroundColor = riskConfig.color;
    
    // Update risk box
    riskBox.className = `risk-box ${riskConfig.className}`;
    riskBox.innerHTML = `
        <div class="risk-emoji">${riskConfig.emoji}</div>
        <div class="risk-message">${riskConfig.message}</div>
        <div class="risk-suggestion">${riskConfig.suggestion}</div>
    `;
    
    // Show result, hide empty state
    showResult();
}

// UI Helper Functions
function showLoading() {
    loadingDiv.style.display = 'block';
    predictBtn.disabled = true;
    predictBtn.textContent = 'Predicting...';
}

function hideLoading() {
    loadingDiv.style.display = 'none';
    predictBtn.disabled = false;
    predictBtn.textContent = 'Predict Resistance Probability';
}

function showError(message) {
    errorMessage.textContent = message;
    errorDiv.style.display = 'block';
    
    // Check for cold start warning
    if (message.includes('warm') || message.includes('504')) {
        errorMessage.innerHTML += '<br><small>First request after inactivity takes ~30 seconds. Try again in a moment.</small>';
    }
}

function hideError() {
    errorDiv.style.display = 'none';
}

function showResult() {
    resultDiv.style.display = 'block';
    emptyState.style.display = 'none';
}

function hideResult() {
    resultDiv.style.display = 'none';
    emptyState.style.display = 'block';
}

// History functions
function saveToHistory(data) {
    let history = JSON.parse(localStorage.getItem('amrx_predictions') || '[]');
    
    // Add new prediction to beginning
    history.unshift({
        ...data,
        id: Date.now(),
        local_time: new Date().toISOString()
    });
    
    // Keep only last 10 predictions
    if (history.length > 10) {
        history = history.slice(0, 10);
    }
    
    localStorage.setItem('amrx_predictions', JSON.stringify(history));
}

function updateHistoryDisplay() {
    const history = JSON.parse(localStorage.getItem('amrx_predictions') || '[]');
    const historyDiv = document.getElementById('predictionsHistory');
    
    if (history.length === 0) {
        historyDiv.innerHTML = '<p>No prediction history yet.</p>';
        return;
    }
    
    const historyHTML = history.map(pred => `
        <div class="history-item">
            <div class="history-organism">${pred.organism}</div>
            <div class="history-antibiotic">${pred.antibiotic}</div>
            <div class="history-probability ${getRiskClass(pred.risk_level)}">
                ${pred.percentage}
            </div>
            <div class="history-time">${new Date(pred.local_time).toLocaleTimeString()}</div>
        </div>
    `).join('');
    
    historyDiv.innerHTML = `
        <div class="history-list">
            ${historyHTML}
        </div>
    `;
}

function getRiskClass(riskLevel) {
    return riskLevel.replace('-', '-');
}

// Add cold start warning
setTimeout(() => {
    const warning = document.createElement('div');
    warning.className = 'api-warning';
    warning.innerHTML = `
        <p><strong>Note:</strong> First prediction may take ~30 seconds (API cold start)</p>
        <p>Subsequent predictions will be faster.</p>
    `;
    warning.style.cssText = `
        background: #fff3cd;
        border: 1px solid #ffeaa7;
        padding: 12px;
        border-radius: 8px;
        margin-top: 20px;
        font-size: 14px;
        color: #856404;
    `;
    
    const formSection = document.querySelector('.form-section');
    if (formSection) {
        formSection.appendChild(warning);
    }
}, 1000);

// Load history on page load
document.addEventListener('DOMContentLoaded', () => {
    updateHistoryDisplay();
    
    // Populate dropdowns with more options (optional)
    populateDropdowns();
});

// Optional: Populate dropdowns with more options
async function populateDropdowns() {
    // You can fetch full lists from your backend or hardcode
    const organisms = [
        "ESCHERICHIA COLI",
        "STAPHYLOCOCCUS AUREUS", 
        "PSEUDOMONAS AERUGINOSA",
        "KLEBSIELLA PNEUMONIAE",
        "ACINETOBACTER BAUMANNII",
        "ENTEROCOCCUS FAECALIS",
        "STREPTOCOCCUS PNEUMONIAE",
        "PROTEUS MIRABILIS",
        "ENTEROBACTER CLOACAE",
        "SERRATIA MARCESCENS"
    ];
    
    const antibiotics = [
        "Amikacin",
        "Amoxicillin/Clavulanic Acid",
        "Ampicillin",
        "Cefepime", 
        "Ceftriaxone",
        "Ciprofloxacin",
        "Gentamicin",
        "Levofloxacin",
        "Meropenem",
        "Vancomycin",
        "Piperacillin/Tazobactam",
        "Trimethoprim/Sulfamethoxazole"
    ];
    
    // Add to dropdowns
    organisms.forEach(org => {
        const option = document.createElement('option');
        option.value = org;
        option.textContent = org;
        organismSelect.appendChild(option);
    });
    
    antibiotics.forEach(ab => {
        const option = document.createElement('option');
        option.value = ab;
        option.textContent = ab;
        antibioticSelect.appendChild(option);
    });
}