const XLSX = require('xlsx');

/**
 * Extract ALL data from Excel as key-value pairs
 * We just extract everything - ML will make sense of it later
 */
async function parseExcel(fileBuffer) {
  try {
    console.log('📊 Reading Excel file (raw extraction)...');
    
    // Read the entire workbook
    const workbook = XLSX.read(fileBuffer, { 
      type: 'buffer',
      cellDates: true,
      raw: false,
      sheetStubs: true
    });
    
    const allData = [];
    
    // Process each sheet
    workbook.SheetNames.forEach((sheetName, sheetIndex) => {
      const sheet = workbook.Sheets[sheetName];
      
      // Convert sheet to array of arrays
      const sheetData = XLSX.utils.sheet_to_json(sheet, { 
        header: 1, // Get as array of arrays
        defval: null,
        blankrows: false
      });
      
      // Store raw sheet data
      allData.push({
        sheetName,
        sheetIndex,
        data: sheetData,
        rows: sheetData.length,
        columns: sheetData[0] ? sheetData[0].length : 0
      });
      
      console.log(`  📄 Sheet "${sheetName}": ${sheetData.length} rows`);
    });
    
    // Also extract any obvious organism/antibiotic data (if present)
    const extractedEntities = extractEntities(workbook);
    
    return {
      rawSheets: allData,
      extractedEntities,
      workbookMetadata: {
        sheetCount: workbook.SheetNames.length,
        sheetNames: workbook.SheetNames,
        parsedAt: new Date().toISOString()
      }
    };
    
  } catch (error) {
    console.error('❌ Excel reading error:', error);
    throw new Error(`Excel parsing failed: ${error.message}`);
  }
}

/**
 * Try to find organism/antibiotic data (optional, for quick preview)
 */
function extractEntities(workbook) {
  const entities = {
    organisms: new Set(),
    antibiotics: new Set(),
    potentialDataRows: []
  };
  
  // Common keywords to look for
  const organismKeywords = ['organism', 'bacteria', 'microbe', 'pathogen', 'isolate'];
  const antibioticKeywords = ['antibiotic', 'drug', 'antimicrobial', 'agent', 'atb'];
  
  try {
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(firstSheet, { defval: null });
    
    if (jsonData.length > 0) {
      // Look at first few rows
      const sampleRows = jsonData.slice(0, Math.min(5, jsonData.length));
      
      sampleRows.forEach((row, index) => {
        const rowText = JSON.stringify(row).toLowerCase();
        
        // Check if row contains organism-like data
        const hasOrganism = organismKeywords.some(keyword => 
          rowText.includes(keyword) || 
          Object.keys(row).some(col => col.toLowerCase().includes(keyword))
        );
        
        // Check if row contains antibiotic-like data  
        const hasAntibiotic = antibioticKeywords.some(keyword =>
          rowText.includes(keyword) ||
          Object.keys(row).some(col => col.toLowerCase().includes(keyword))
        );
        
        if (hasOrganism || hasAntibiotic) {
          entities.potentialDataRows.push({
            rowIndex: index,
            data: row,
            hasOrganism,
            hasAntibiotic
          });
        }
        
        // Extract any potential organism/antibiotic values
        Object.entries(row).forEach(([key, value]) => {
          if (typeof value === 'string') {
            const lowerValue = value.toLowerCase().trim();
            const lowerKey = key.toLowerCase();
            
            // Heuristic: Short capitalized strings might be organism codes
            if (value.length <= 30 && /[A-Z_]+/.test(value)) {
              if (lowerKey.includes('organism') || lowerKey.includes('bacteria')) {
                entities.organisms.add(value);
              }
            }
            
            // Heuristic: Drug names
            if (lowerKey.includes('antibiotic') || lowerKey.includes('drug')) {
              entities.antibiotics.add(value);
            }
          }
        });
      });
    }
  } catch (e) {
    console.warn('Entity extraction skipped:', e.message);
  }
  
  return {
    organisms: Array.from(entities.organisms),
    antibiotics: Array.from(entities.antibiotics),
    potentialDataRows: entities.potentialDataRows,
    foundEntities: entities.organisms.size + entities.antibiotics.size > 0
  };
}

module.exports = { parseExcel };