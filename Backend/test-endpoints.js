// Backend/test-endpoints.js
// Test RWUI analytics endpoints

import http from 'http';

function testEndpoint(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Testing RWUI Analytics Endpoints\n');
  
  // Test 1: Health
  console.log('1️⃣  GET /api/analytics/health');
  try {
    const health = await testEndpoint('/api/analytics/health');
    console.log('   ✅ Response:', JSON.stringify(health, null, 2));
  } catch (err) {
    console.log('   ❌ Error:', err.message);
  }

  // Test 2: RWUI metrics
  console.log('\n2️⃣  GET /api/analytics/rwui');
  try {
    const metrics = await testEndpoint('/api/analytics/rwui');
    console.log('   ✅ Response:', JSON.stringify(metrics, null, 2));
  } catch (err) {
    console.log('   ❌ Error:', err.message);
  }

  // Test 3: RWUI with district filter
  console.log('\n3️⃣  GET /api/analytics/rwui?district=Kottayam');
  try {
    const filtered = await testEndpoint('/api/analytics/rwui?district=Kottayam');
    console.log('   ✅ Response:', JSON.stringify(filtered, null, 2));
  } catch (err) {
    console.log('   ❌ Error:', err.message);
  }

  // Test 4: Summary
  console.log('\n4️⃣  GET /api/analytics/summary');
  try {
    const summary = await testEndpoint('/api/analytics/summary');
    console.log('   ✅ Response:', JSON.stringify(summary, null, 2));
  } catch (err) {
    console.log('   ❌ Error:', err.message);
  }

  console.log('\n✨ All tests complete!\n');
}

runTests().catch(console.error);
