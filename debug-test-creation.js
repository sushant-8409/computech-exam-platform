// Test script to debug validation errors for test creation
const axios = require('axios');

async function testTestCreation() {
  console.log('🧪 Testing test creation with various payloads...');
  
  const baseURL = 'http://localhost:5000';
  
  // Test payload 1: Missing fields
  const testPayload1 = {
    title: 'Test Math Quiz',
    subject: 'Mathematics',
    class: '10',
    board: 'CBSE',
    duration: 60,
    totalMarks: 100,
    passingMarks: 40,
    questionsCount: 10
    // Missing startDate, endDate
  };
  
  // Test payload 2: Invalid dates
  const testPayload2 = {
    ...testPayload1,
    startDate: 'invalid-date',
    endDate: 'invalid-date'
  };
  
  // Test payload 3: Valid payload
  const testPayload3 = {
    ...testPayload1,
    description: 'Test description',
    startDate: new Date().toISOString(),
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    questionPaperURL: 'https://example.com/paper.pdf',
    answerKeyURL: 'https://example.com/key.pdf'
  };
  
  console.log('\n📋 Testing payloads:');
  
  // Test each payload
  for (let i = 1; i <= 3; i++) {
    const payload = eval(`testPayload${i}`);
    console.log(`\n🔍 Test ${i}:`, payload);
    
    try {
      const response = await axios.post(`${baseURL}/api/admin/tests`, payload, {
        headers: {
          'Authorization': 'Bearer test-token', // You'll need a real token
          'Content-Type': 'application/json'
        }
      });
      console.log(`✅ Test ${i} SUCCESS:`, response.status);
    } catch (error) {
      console.log(`❌ Test ${i} FAILED:`, error.response?.status);
      if (error.response?.status === 422) {
        console.log('  📋 Validation errors:', error.response.data.errors);
      } else {
        console.log('  📋 Error:', error.response?.data?.message || error.message);
      }
    }
  }
}

// Only run if called directly
if (require.main === module) {
  testTestCreation().catch(console.error);
}

module.exports = { testTestCreation };
