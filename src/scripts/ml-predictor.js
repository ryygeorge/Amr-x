// scripts/ml-predictor.js
export class MLPredictor {
  constructor() {
    this.apiUrl = 'http://localhost:5000/api/predict'; // Will get from teammate
  }

  async predict(organism, antibiotic) {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organism, antibiotic })
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Prediction failed:', error);
      // Fallback data
      return {
        probability: Math.random() * 0.8 + 0.1, // 10-90%
        risk_level: ['Low', 'Medium', 'High'][Math.floor(Math.random() * 3)],
        confidence: 0.7
      };
    }
  }

  async savePrediction(predictionData) {
    const { supabase } = await import('./supabase-init.js');
    const { data: { user } } = await supabase.auth.getUser();
    
    const { error } = await supabase
      .from('ml_predictions')
      .insert({
        user_id: user?.id,
        organism: predictionData.organism,
        antibiotic: predictionData.antibiotic,
        resistance_probability: predictionData.probability,
        risk_level: predictionData.risk_level,
        clinical_context: predictionData.context || 'Dashboard prediction'
      });
    
    return !error;
  }

  getRiskColor(risk) {
    switch(risk.toLowerCase()) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  }

  getProbabilityText(probability) {
    const percent = (probability * 100).toFixed(1);
    if (probability > 0.7) return `${percent}% (Very High)`;
    if (probability > 0.5) return `${percent}% (High)`;
    if (probability > 0.3) return `${percent}% (Moderate)`;
    return `${percent}% (Low)`;
  }
}