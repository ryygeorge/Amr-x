// Backend/test-rwui.js
// Test RWUI analytics with real pharmacist_entries data

import { getRWUIMetrics, getRWUISummary } from './services/rwuiService.js';

async function testRWUI() {
  console.log('🧪 Testing RWUI Analytics\n');

  // Test 1: Get all metrics
  console.log('📊 Test 1: Get all RWUI metrics');
  try {
    const metrics = await getRWUIMetrics({});
    console.log('✅ Result:');
    console.log(JSON.stringify(metrics, null, 2));
  } catch (error) {
    console.log('❌ Error:', error.message);
  }

  // Test 2: Filter by district
  console.log('\n📊 Test 2: Filter by Kottayam district');
  try {
    const metrics = await getRWUIMetrics({ district: 'Kottayam' });
    console.log('✅ Result:');
    console.log(JSON.stringify(metrics, null, 2));
  } catch (error) {
    console.log('❌ Error:', error.message);
  }

  // Test 3: Get summary
  console.log('\n📊 Test 3: Get summary statistics');
  try {
    const summary = await getRWUISummary({});
    console.log('✅ Result:');
    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

testRWUI().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
