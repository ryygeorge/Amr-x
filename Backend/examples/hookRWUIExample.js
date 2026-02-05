// Backend/examples/hookRWUIExample.js
// EXAMPLE: How to integrate RWUI updates into your hospital pharmacy entry flow
// DO NOT COPY-PASTE - Adapt to your existing code

import { updateRWUI } from '../services/rwuiService.js';

/**
 * EXAMPLE: After saving a hospital pharmacy entry and getting ML prediction
 */
async function savePharmacistEntryExample(entryData, mlPrediction) {
  try {
    // 1. Save the entry to database (your existing code)
    const { data: savedEntry, error } = await supabase
      .from('pharmacist_entries')
      .insert([{
        organism: entryData.organism,
        antibiotic: entryData.antibiotic,
        district: entryData.district,
        pharmacist_id: entryData.pharmacist_id,
        resistance_probability: mlPrediction.probability, // Store ML result
        risk_level: mlPrediction.risk_level,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();
    
    if (error) {
      throw error;
    }
    
    // 2. ASYNC: Update RWUI (fire-and-forget, non-blocking)
    // This will NOT delay the response to the user
    updateRWUI({
      organism: entryData.organism,
      antibiotic: entryData.antibiotic,
      district: entryData.district,
      resistance_probability: mlPrediction.probability
    }).catch(err => {
      // Log but don't throw - analytics failure must not break core flow
      console.error('RWUI update failed (non-critical):', err);
    });
    
    // 3. Return success to user immediately
    return {
      success: true,
      entry: savedEntry
    };
    
  } catch (error) {
    console.error('Error saving entry:', error);
    throw error;
  }
}

/**
 * EXAMPLE: Where to add the hook in your existing route
 */
/*
router.post('/pharmacist-entry', async (req, res) => {
  try {
    const { organism, antibiotic, district } = req.body;
    
    // 1. Get ML prediction (your existing code)
    const mlPrediction = await callMLPredictionAPI(organism, antibiotic);
    
    // 2. Save entry
    const entry = await savePharmacistEntryExample({
      organism,
      antibiotic,
      district,
      pharmacist_id: req.user.id
    }, mlPrediction);
    
    // RWUI update happens automatically in savePharmacistEntryExample
    
    // 3. Return to user
    res.json({
      ok: true,
      entry: entry.entry,
      prediction: mlPrediction
    });
    
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});
*/

/**
 * INTEGRATION CHECKLIST:
 * 
 * 1. Find where hospital pharmacy entries are saved in your backend
 * 2. After successful save + ML prediction, add:
 *    updateRWUI({ organism, antibiotic, district, resistance_probability })
 *      .catch(err => console.error('RWUI update failed:', err));
 * 3. Make sure it's async/non-blocking (use .catch(), not await)
 * 4. Test that entry save still works even if RWUI fails
 */
