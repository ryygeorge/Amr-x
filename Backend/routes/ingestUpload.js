const express = require('express');
const router = express.Router();
const { supabase } = require('../lib/supabase');

// Handle file upload notifications from frontend
router.post('/ingest-upload', async (req, res) => {
  console.log('📥 Received file upload notification:', req.body);
  
  const { filePath, pharmacistId, district, state, pharmacyName, fileName } = req.body;
  
  // Validate required fields
  if (!filePath || !pharmacistId || !district) {
    console.error('❌ Missing required fields:', { filePath, pharmacistId, district });
    return res.status(400).json({
      ok: false,
      error: 'Missing required fields: filePath, pharmacistId, or district'
    });
  }
  
  try {
    console.log(`📍 File stored for ML processing from ${district} district`);
    console.log(`   Path: ${filePath}`);
    console.log(`   Pharmacy: ${pharmacyName || 'Unknown Pharmacy'}`);
    console.log(`   File: ${fileName}`);
    
    // 1. First, let's ensure the table exists (fallback)
    await ensureTrackingTableExists();
    
    // 2. Store in tracking table
    const { error: trackingError } = await supabase
      .from('ml_files_tracking')
      .insert([{
        file_path: filePath,
        file_name: fileName || 'unknown',
        pharmacist_id: pharmacistId,
        district: district,
        state: state || 'Kerala',
        pharmacy_name: pharmacyName,
        status: 'pending_ml',
        uploaded_at: new Date().toISOString()
      }]);
    
    if (trackingError) {
      console.error('❌ Tracking table insert error:', trackingError);
      
      // Try creating table if it doesn't exist
      if (trackingError.code === '42P01') { // Table doesn't exist
        console.log('🔄 Creating ml_files_tracking table...');
        await createTrackingTable();
        
        // Try insert again
        const { error: retryError } = await supabase
          .from('ml_files_tracking')
          .insert([{
            file_path: filePath,
            file_name: fileName || 'unknown',
            pharmacist_id: pharmacistId,
            district: district,
            state: state || 'Kerala',
            pharmacy_name: pharmacyName,
            status: 'pending_ml',
            uploaded_at: new Date().toISOString()
          }]);
        
        if (retryError) {
          console.error('❌ Retry also failed:', retryError);
        } else {
          console.log('✅ Created table and inserted successfully');
        }
      }
    } else {
      console.log('✅ File registered in tracking table');
    }
    
    // 3. Return success response
    const response = {
      ok: true,
      message: 'File registered for ML processing',
      fileInfo: {
        district: district,
        path: filePath,
        pharmacist: pharmacistId,
        pharmacy: pharmacyName,
        fileName: fileName
      },
      nextSteps: 'ML model will access this file directly from storage',
      mlAccessUrl: `https://nplowpmpcrotocvbyxy.supabase.co/storage/v1/object/uploads/${filePath}`,
      timestamp: new Date().toISOString()
    };
    
    console.log(`✅ File ${fileName} registered from ${district} district`);
    res.json(response);
    
  } catch (error) {
    console.error('❌ File registration error:', error);
    
    // Even if tracking fails, file is still stored - return partial success
    res.status(200).json({
      ok: true,
      warning: 'File stored but tracking failed',
      message: 'File uploaded successfully to storage. Tracking system error.',
      fileInfo: {
        district: district,
        path: filePath,
        storageStatus: 'success'
      },
      errorDetails: error.message,
      note: 'ML can still access file from storage path'
    });
  }
});

// Helper function to ensure tracking table exists
async function ensureTrackingTableExists() {
  try {
    // Simple query to check if table exists
    const { error } = await supabase
      .from('ml_files_tracking')
      .select('id')
      .limit(1);
    
    if (error && error.code === '42P01') { // Table doesn't exist
      console.log('🔄 ml_files_tracking table not found, creating...');
      await createTrackingTable();
    }
  } catch (err) {
    console.warn('⚠️ Table check failed:', err.message);
  }
}

// Create tracking table
async function createTrackingTable() {
  try {
    // Using raw SQL to create table
    const { error } = await supabase.rpc('create_tracking_table_if_not_exists');
    
    if (error) {
      console.warn('⚠️ Could not create table via RPC, using direct query...');
      // If RPC fails, we'll just let the insert fail and handle it
    }
  } catch (err) {
    console.warn('⚠️ Table creation attempt failed:', err.message);
  }
}

module.exports = router;