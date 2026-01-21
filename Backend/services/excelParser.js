const XLSX = require('xlsx');

/**
 * Simple parser - just extracts file metadata
 * ML will handle the actual data extraction
 */
async function parseExcel(fileBuffer) {
  try {
    console.log('📊 Getting Excel metadata...');
    
    const workbook = XLSX.read(fileBuffer, { 
      type: 'buffer',
      cellDates: true,
      raw: false
    });
    
    return {
      success: true,
      metadata: {
        sheetCount: workbook.SheetNames.length,
        sheetNames: workbook.SheetNames,
        totalSize: fileBuffer.byteLength
      },
      note: 'File stored for ML processing - ML will extract data directly'
    };
    
  } catch (error) {
    console.error('❌ Excel metadata extraction error:', error);
    return {
      success: false,
      error: error.message,
      metadata: null
    };
  }
}

module.exports = { parseExcel };