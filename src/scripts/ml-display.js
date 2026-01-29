// scripts/ml-display.js
export class MLDisplay {
  constructor() {
    this.apiUrl = ''; // Will get from teammate
  }

  // Just format and display whatever ML gives us
  formatPrediction(mlData) {
    return {
      probability: mlData.probability || mlData.resistance_probability,
      riskLevel: mlData.risk_level || this.calculateRisk(mlData.probability),
      confidence: mlData.confidence || 0.8,
      recommendation: mlData.recommendation || 'Consult antibiogram',
      modelVersion: mlData.model_version || 'v1.0',
      thresholds: mlData.thresholds || { high: 0.7, medium: 0.4, low: 0.2 }
    };
  }

  calculateRisk(probability) {
    if (probability >= 0.7) return 'High';
    if (probability >= 0.4) return 'Medium';
    return 'Low';
  }

  getRiskColor(risk) {
    const colors = {
      'High': '#ef4444',
      'Medium': '#f59e0b', 
      'Low': '#10b981',
      'Critical': '#dc2626',
      'Warning': '#d97706'
    };
    return colors[risk] || '#6b7280';
  }
}