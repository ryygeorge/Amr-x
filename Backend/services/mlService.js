// Backend/services/mlService.js
// ML Service - Fetches baseline resistance probability from ML API

const ML_API_URL = 'https://amrx-ml-api.onrender.com/api/v1';

// Map organism names to ML API format
const ORGANISM_MAP = {
  'Escherichia coli': 'ESCHERICHIA COLI',
  'Klebsiella pneumoniae': 'KLEBSIELLA PNEUMONIAE',
  'Staphylococcus aureus': 'STAPHYLOCOCCUS AUREUS',
  'Pseudomonas aeruginosa': 'PSEUDOMONAS AERUGINOSA',
  'Acinetobacter baumannii': 'ACINETOBACTER BAUMANNII',
  'Enterococcus faecalis': 'ENTEROCOCCUS FAECALIS',
  'Enterococcus faecium': 'ENTEROCOCCUS FAECIUM',
  'Streptococcus pneumoniae': 'STREPTOCOCCUS PNEUMONIAE',
  'Salmonella species': 'SALMONELLA SPP',
  'Shigella species': 'SHIGELLA SPP'
};

// Map antibiotic names to ML API format
const ANTIBIOTIC_MAP = {
  'Ciprofloxacin': 'Ciprofloxacin',
  'Amoxicillin': 'Amoxicillin/Clavulanic Acid',
  'Ampicillin': 'Ampicillin',
  'Ceftriaxone': 'Ceftriaxone',
  'Clarithromycin': 'Clarithromycin',
  'Vancomycin': 'Vancomycin',
  'Meropenem': 'Meropenem',
  'Gentamicin': 'Gentamicin',
  'Piperacillin-Tazobactam': 'Piperacillin/Tazobactam',
  'Colistin': 'Colistin',
  'Linezolid': 'Linezolid',
  'Imipenem': 'Imipenem',
  'Amoxicillin-Clavulanate': 'Amoxicillin/Clavulanic Acid',
  'Ampicillin-Sulbactam': 'Ampicillin/Sulbactam'
};

/**
 * Get baseline resistance probability from ML API
 * @param {string} organism - Bacterial organism name
 * @param {string} antibiotic - Antibiotic name
 * @returns {Promise<number|null>} Resistance probability (0-1) or null if failed
 */
export async function getMLResistanceProbability(organism, antibiotic) {
  try {
    // Map to ML API format
    const mlOrganism = ORGANISM_MAP[organism] || organism.toUpperCase();
    const mlAntibiotic = ANTIBIOTIC_MAP[antibiotic] || antibiotic;

    console.log(`🧠 ML API Call: ${mlOrganism} + ${mlAntibiotic}`);

    const response = await fetch(`${ML_API_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organism: mlOrganism,
        antibiotic: mlAntibiotic
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ ML API Error:', response.status, errorData);
      return null;
    }

    const data = await response.json();
    const probability = data.probability;

    if (typeof probability === 'number' && probability >= 0 && probability <= 1) {
      console.log(`✅ ML Probability: ${(probability * 100).toFixed(1)}%`);
      return probability;
    }

    console.warn('⚠️ Invalid ML response format:', data);
    return null;

  } catch (error) {
    console.error('💥 ML Service Error:', error.message);
    return null;
  }
}

/**
 * Extract antibiotics from prescription or results text
 * Returns array of antibiotic names found
 */
function extractAntibioticsFromText(text) {
  if (!text) return [];
  
  const normalized = text.toLowerCase();
  const found = [];
  
  for (const [standard, _] of Object.entries(ANTIBIOTIC_MAP)) {
    if (normalized.includes(standard.toLowerCase())) {
      found.push(standard);
    }
  }
  
  return found;
}

/**
 * Get ML probabilities for multiple antibiotics mentioned in entry
 * @param {string} organism 
 * @param {string} antibioticsText - Text containing antibiotic names
 * @returns {Promise<Array>} Array of {antibiotic, probability}
 */
export async function getMLProbabilitiesForEntry(organism, antibioticsText) {
  const antibiotics = extractAntibioticsFromText(antibioticsText);
  
  if (antibiotics.length === 0) {
    return [];
  }

  const results = [];
  
  for (const antibiotic of antibiotics) {
    const probability = await getMLResistanceProbability(organism, antibiotic);
    if (probability !== null) {
      results.push({ antibiotic, probability });
    }
  }
  
  return results;
}

/**
 * Calculate average ML probability for an entry
 * Used as baseline resistance pressure score
 */
export function calculateAverageProbability(probabilities) {
  if (!probabilities || probabilities.length === 0) return null;
  
  const sum = probabilities.reduce((acc, p) => acc + p.probability, 0);
  return sum / probabilities.length;
}
