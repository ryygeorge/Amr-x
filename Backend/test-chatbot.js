// Quick test script for chatbot endpoint
// Run: node test-chatbot.js

const testEndpoint = async () => {
  try {
    console.log('🧪 Testing chatbot endpoint...\n');
    
    // Test 1: Health check
    console.log('1️⃣ Testing health endpoint...');
    const healthRes = await fetch('http://localhost:3001/api/chatbot/health');
    const health = await healthRes.json();
    console.log('Health:', health);
    console.log('✅ Health check passed\n');
    
    // Test 2: Valid question
    console.log('2️⃣ Testing valid question...');
    const validRes = await fetch('http://localhost:3001/api/chatbot/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'What is antimicrobial resistance?' })
    });
    const validData = await validRes.json();
    console.log('Response:', validData);
    console.log(validData.ok ? '✅ Valid question passed\n' : '❌ Valid question failed\n');
    
    // Test 3: Forbidden keyword
    console.log('3️⃣ Testing forbidden keyword...');
    const forbiddenRes = await fetch('http://localhost:3001/api/chatbot/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'What antibiotic should I prescribe?' })
    });
    const forbiddenData = await forbiddenRes.json();
    console.log('Response:', forbiddenData);
    console.log(!forbiddenData.ok ? '✅ Forbidden keyword blocked\n' : '❌ Should have been blocked\n');
    
    // Test 4: Empty question
    console.log('4️⃣ Testing empty question...');
    const emptyRes = await fetch('http://localhost:3001/api/chatbot/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: '' })
    });
    const emptyData = await emptyRes.json();
    console.log('Response:', emptyData);
    console.log(!emptyData.ok ? '✅ Empty question rejected\n' : '❌ Should have been rejected\n');
    
    console.log('🎉 All tests completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n💡 Make sure the server is running: cd Backend && node server.js');
  }
};

testEndpoint();
