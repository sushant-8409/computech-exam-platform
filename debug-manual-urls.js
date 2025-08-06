// Debug script to check manual test entry URLs in database
const axios = require('axios');

async function checkManualTestEntryUrls() {
  try {
    console.log('🔍 Checking manual test entry URLs in database...');
    
    // Step 1: Login
    const loginResponse = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'mdalamrahman4@gmail.com',
      password: 'Zerocheck@admin1'
    });
    
    if (!loginResponse.data.token) {
      throw new Error('No token received from login');
    }
    
    const token = loginResponse.data.token;
    console.log('✅ Login successful');
    
    // Step 2: Get manual test entries
    const response = await axios.get('http://localhost:5000/api/admin/manual-test/manual-entries', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.data.success && response.data.results.length > 0) {
      console.log(`\n📊 Found ${response.data.results.length} manual test entries:`);
      
      response.data.results.forEach((result, index) => {
        console.log(`\n${index + 1}. ${result.testTitle}`);
        console.log(`   📋 Result ID: ${result._id}`);
        console.log(`   🎯 Test ID: ${result.testId._id}`);
        console.log(`   👤 Student: ${result.studentId.name}`);
        
        // Check URLs in the test object
        const test = result.testId;
        console.log('   📄 Test URLs:');
        console.log(`      - Question Paper URL: ${test.questionPaperURL || 'NOT SET'}`);
        console.log(`      - Answer Key URL: ${test.answerKeyURL || 'NOT SET'}`);
        
        // Check URLs in the result object
        console.log('   📋 Result URLs:');
        console.log(`      - Answer Sheet URL: ${result.answerSheetURL || 'NOT SET'}`);
        
        // Check if this is a manual entry
        console.log(`   🔧 Is Manual Entry: ${result.isManualEntry ? 'YES' : 'NO'}`);
      });
    } else {
      console.log('❌ No manual test entries found');
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

checkManualTestEntryUrls();
