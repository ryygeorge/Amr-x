import XLSX from 'xlsx';

const R_VALUES = new Set(['R', 'S', 'I']);

function normalizeHeader(h) {
  return String(h || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function isRSI(value) {
  if (value === null || value === undefined) return false;
  return R_VALUES.has(String(value).trim().toUpperCase());
}

/**
 * Parse Excel / CSV antibiogram files
 * Supports:
 *  - LONG format (organism, antibiotic, result)
 *  - WIDE format (organism + antibiotic columns)
 */
async function parseExcel(fileBuffer) {
  try {
    console.log('📊 Parsing antibiogram file...');

    const workbook = XLSX.read(fileBuffer, {
      type: 'buffer',
      cellDates: true,
      raw: false
    });

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });

    if (!rows.length) {
      throw new Error('Empty file');
    }

    const headers = Object.keys(rows[0]);
    const normalizedHeaders = headers.map(normalizeHeader);

    const hasLongFormat =
      normalizedHeaders.includes('organism') &&
      normalizedHeaders.includes('antibiotic') &&
      normalizedHeaders.includes('result');

    const hasWideFormat =
      normalizedHeaders.includes('organism') &&
      !normalizedHeaders.includes('antibiotic') &&
      !normalizedHeaders.includes('result');

    let parsedRows = [];

    /* ======================
       LONG / TIDY FORMAT
       ====================== */
    if (hasLongFormat) {
      console.log('📄 Detected LONG format');

      for (const row of rows) {
        const organism = row.organism || row.Organism;
        const antibiotic = row.antibiotic || row.Antibiotic;
        const result = row.result || row.Result;

        if (!organism || !antibiotic) continue;
        if (!isRSI(result)) continue;

        parsedRows.push({
          organism: String(organism).trim(),
          antibiotic: String(antibiotic).trim(),
          result: String(result).toUpperCase()
        });
      }
    }

    /* ======================
       WIDE FORMAT
       ====================== */
    else if (hasWideFormat) {
      console.log('📊 Detected WIDE format');

      for (const row of rows) {
        const organism = row.organism || row.Organism;
        if (!organism) continue;

        for (const [key, value] of Object.entries(row)) {
          if (normalizeHeader(key) === 'organism') continue;

          if (isRSI(value)) {
            parsedRows.push({
              organism: String(organism).trim(),
              antibiotic: String(key).trim(),
              result: String(value).toUpperCase()
            });
          }
        }
      }
    }

    else {
      throw new Error(
        'Unsupported format. Expected organism + (antibiotic,result) or organism + antibiotic columns.'
      );
    }

    if (parsedRows.length === 0) {
      throw new Error('No valid R/S/I antibiogram values found');
    }

    console.log(`✅ Parsed ${parsedRows.length} antibiogram rows`);

    return {
      success: true,
      rows: parsedRows,
      metadata: {
        totalRows: parsedRows.length,
        sheetName
      }
    };

  } catch (error) {
    console.error('❌ Excel parse error:', error.message);
    return {
      success: false,
      error: error.message,
      rows: []
    };
  }
}

export { parseExcel };

