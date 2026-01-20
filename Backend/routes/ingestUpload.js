const express = require('express');
const router = express.Router();
const { supabase } = require('../lib/supabase');
const { parseExcel } = require('../services/excelParser');

router.post('/ingest-upload', async (req, res) => {
  console.log('📥 Received pharmacist upload:', req.body);
  
  const { uploadId, filePath, pharmacistId } = req.body;
  
  // Validate
  if (!uploadId || !filePath || !pharmacistId) {
    return res.status(400).json({
      ok: false,
      error: 'Missing uploadId, filePath, or pharmacistId'
    });
  }
  
  try {
    // 1. Download file from Supabase Storage
    console.log(`⬇️ Downloading: ${filePath}`);
    const { data: fileBuffer, error: downloadError } = await supabase
      .storage
      .from('uploads')
      .download(filePath);
    
    if (downloadError) {
      console.error('Download error:', downloadError);
      throw new Error(`Failed to download file: ${downloadError.message}`);
    }
    
    console.log(`✅ File downloaded (${fileBuffer.size} bytes)`);
    
    // 2. Parse Excel (just extract structure)
    console.log('📊 Analyzing Excel structure...');
    const parseResult = await parseExcel(await fileBuffer.arrayBuffer());
    
    // 3. Store raw file metadata (NO PARSED DATA IN DB YET)
    console.log('💾 Storing upload metadata...');
    
    // For now, just return success - we'll store in DB when tables exist
    res.json({
      ok: true,
      message: 'Excel file received and analyzed',
      uploadId,
      pharmacistId,
      fileInfo: {
        size: fileBuffer.size,
        sheets: parseResult.workbookMetadata.sheetCount,
        sheetNames: parseResult.workbookMetadata.sheetNames
      },
      analysis: {
        totalSheets: parseResult.rawSheets.length,
        totalRows: parseResult.rawSheets.reduce((sum, sheet) => sum + sheet.rows, 0),
        foundEntities: parseResult.extractedEntities.foundEntities,
        organismsFound: parseResult.extractedEntities.organisms.length,
        antibioticsFound: parseResult.extractedEntities.antibiotics.length
      },
      preview: {
        firstSheetSample: parseResult.rawSheets[0]?.data.slice(0, 3), // First 3 rows of first sheet
        organisms: parseResult.extractedEntities.organisms.slice(0, 5),
        antibiotics: parseResult.extractedEntities.antibiotics.slice(0, 5)
      },
      note: '✅ File stored in Supabase Storage. Ready for ML processing when needed.',
      nextStep: 'ML model can access this file anytime via Supabase Storage URL'
    });
    
    console.log(`🎉 Upload ${uploadId} processed successfully`);
    console.log(`   📊 ${parseResult.rawSheets.length} sheets analyzed`);
    console.log(`   🦠 ${parseResult.extractedEntities.organisms.length} potential organisms found`);
    console.log(`   💊 ${parseResult.extractedEntities.antibiotics.length} potential antibiotics found`);
    
  } catch (error) {
    console.error('❌ Upload processing error:', error);
    res.status(500).json({
      ok: false,
      error: 'Upload processing failed',
      details: error.message,
      note: 'File may still be stored in Supabase Storage even if analysis failed'
    });
  }
});

module.exports = router; 