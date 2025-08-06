// Debug script to test manual test creation flow
const axios = require('axios');

async function testManualTestCreation() {
  try {
    console.log('🚀 Starting manual test creation debug...');
    
    // Step 1: Login
    console.log('\n📝 Step 1: Login as admin...');
    const loginResponse = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'mdalamrahman4@gmail.com',
      password: 'Zerocheck@admin1'
    });
    
    if (!loginResponse.data.token) {
      throw new Error('No token received from login');
    }
    
    const token = loginResponse.data.token;
    console.log('✅ Login successful, got token');
    
    // Step 2: Search for a student
    console.log('\n🔍 Step 2: Search for student...');
    const searchResponse = await axios.get('http://localhost:5000/api/admin/manual-test/search-students', {
      params: { query: 'test' },
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!searchResponse.data.success || searchResponse.data.students.length === 0) {
      throw new Error('No students found or search failed');
    }
    
    const student = searchResponse.data.students[0];
    console.log(`✅ Found student: ${student.name} (${student._id})`);
    
    // Step 3: Create manual test without files first
    console.log('\n📋 Step 3: Create manual test entry (no files)...');
    
    const testData = {
      title: 'Debug Manual Test',
      subject: 'Mathematics',
      class: student.class,
      board: student.board,
      school: student.school,
      testType: 'offline',
      testDate: new Date().toISOString().split('T')[0],
      duration: 60,
      totalQuestions: 3,
      instructions: 'Debug test entry'
    };
    
    const questions = [
      { questionNo: 1, maxMarks: 10, obtainedMarks: 8, remarks: 'Good work' },
      { questionNo: 2, maxMarks: 15, obtainedMarks: 12, remarks: 'Well done' },
      { questionNo: 3, maxMarks: 25, obtainedMarks: 20, remarks: 'Excellent' }
    ];
    
    const fileUrls = {}; // No files for now
    
    const createResponse = await axios.post('http://localhost:5000/api/admin/manual-test/create', {
      testData,
      studentId: student._id,
      questions,
      fileUrls
    }, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (createResponse.data.success) {
      console.log('✅ Manual test created successfully!');
      console.log(`📋 Test ID: ${createResponse.data.test._id}`);
      console.log(`📊 Result ID: ${createResponse.data.result._id}`);
      console.log(`🎯 Total Marks: ${createResponse.data.result.totalMarks}`);
      console.log(`📈 Marks Obtained: ${createResponse.data.result.marksObtained}`);
      console.log(`📊 Percentage: ${createResponse.data.result.percentage}%`);
      console.log(`🏆 Grade: ${createResponse.data.result.grade}`);
      console.log(`✅ Status: ${createResponse.data.result.status}`);
    } else {
      throw new Error(`Failed to create test: ${createResponse.data.message}`);
    }
    
    console.log('\n🎉 Debug test completed successfully!');
    
  } catch (error) {
    console.error('❌ Debug test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Check if axios is available
try {
  testManualTestCreation();
} catch (error) {
  console.error('❌ Please install axios: npm install axios');
}
