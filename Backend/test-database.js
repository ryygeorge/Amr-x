// Backend/test-database.js
// Simple script to check what data exists in Supabase

import { supabase } from './lib/supabase.js';

async function checkDatabase() {
  console.log('🔍 Checking Supabase Database...\n');

  // Check parsed_antibiogram_rows
  console.log('📊 Table: parsed_antibiogram_rows');
  const { data: rows, error: rowsError, count: rowsCount } = await supabase
    .from('parsed_antibiogram_rows')
    .select('*', { count: 'exact', head: false })
    .limit(5);

  if (rowsError) {
    console.log('  ❌ Error:', rowsError.message);
  } else {
    console.log(`  ✅ Total rows: ${rowsCount || 0}`);
    if (rows && rows.length > 0) {
      console.log('  📝 Sample row:');
      console.log('    ', JSON.stringify(rows[0], null, 2));
      
      // Show column structure
      console.log('\n  📋 Columns:', Object.keys(rows[0]).join(', '));
    } else {
      console.log('  ⚠️  Table is EMPTY - no data to analyze');
    }
  }

  // Check uploads table
  console.log('\n📊 Table: uploads');
  const { data: uploads, error: uploadsError } = await supabase
    .from('uploads')
    .select('id, file_name, district, created_at')
    .limit(5);

  if (uploadsError) {
    console.log('  ❌ Error:', uploadsError.message);
  } else {
    console.log(`  ✅ Total uploads: ${uploads?.length || 0}`);
    if (uploads && uploads.length > 0) {
      uploads.forEach(u => {
        console.log(`    - ${u.file_name} (${u.district}) - ${new Date(u.created_at).toLocaleDateString()}`);
      });
    } else {
      console.log('  ⚠️  No uploads found');
    }
  }

  // Check pharmacist_entries table (the actual parsed data!)
  console.log('\n📊 Table: pharmacist_entries');
  const { data: entries, error: entriesError, count: entriesCount } = await supabase
    .from('pharmacist_entries')
    .select('*', { count: 'exact', head: false })
    .limit(5);

  if (entriesError) {
    console.log('  ❌ Error:', entriesError.message);
  } else {
    console.log(`  ✅ Total entries: ${entriesCount || 0}`);
    if (entries && entries.length > 0) {
      console.log('  📝 Sample entry:');
      console.log('    ', JSON.stringify(entries[0], null, 2));
    } else {
      console.log('  ⚠️  Table is EMPTY');
    }
  }

  // Check ml_predictions table
  console.log('\n📊 Table: ml_predictions');
  const { data: predictions, error: predError } = await supabase
    .from('ml_predictions')
    .select('organism, antibiotic, resistance_probability')
    .limit(5);

  if (predError) {
    console.log('  ❌ Error:', predError.message);
  } else {
    console.log(`  ✅ Total predictions: ${predictions?.length || 0}`);
    if (predictions && predictions.length > 0) {
      predictions.forEach(p => {
        console.log(`    - ${p.organism} + ${p.antibiotic}: ${(p.resistance_probability * 100).toFixed(1)}%`);
      });
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📌 SUMMARY:');
  console.log('='.repeat(60));
  
  if (entries && entries.length > 0) {
    console.log(`\n✅ You have ${entriesCount} entries in pharmacist_entries!`);
    console.log('   📊 RWUI analytics will read from THIS table');
    console.log('   ✨ pharmacist_entries = parsed antibiogram data');
  } else if (uploads && uploads.length > 0) {
    console.log('\n⚠️  Files uploaded but NOT parsed yet!');
    console.log('   Check if upload processed correctly');
  } else {
    console.log('\n⚠️  No data yet - upload an Excel file first');
  }
  
  console.log('\n');
}

checkDatabase().catch(err => {
  console.error('❌ Database check failed:', err.message);
  process.exit(1);
});
