// Simple test to verify manual test creation with file URLs
const axios = require('axios');

async function testManualTestCreationWithSimulatedFiles() {
  try {
    console.log('🚀 Testing manual test creation with simulated file URLs...');
    
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
    console.log('✅ Login successful');
    
    // Step 2: Search for a student
    console.log('\n🔍 Step 2: Search for student...');
    const searchResponse = await axios.get('http://localhost:5000/api/admin/manual-test/search-students', {
      params: { query: 'test' },
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!searchResponse.data.success || searchResponse.data.students.length === 0) {
      throw new Error('No students found');
    }
    
    const student = searchResponse.data.students[0];
    console.log(`✅ Found student: ${student.name}`);
    
    // Step 3: Create manual test with simulated file URLs
    console.log('\n📋 Step 3: Create manual test with simulated file URLs...');
    
    const testData = {
      title: 'Test Manual Entry with URLs',
      subject: 'Mathematics',
      class: student.class,
      board: student.board,
      school: student.school,
      testType: 'offline',
      testDate: new Date().toISOString().split('T')[0],
      duration: 60,
      totalQuestions: 2,
      instructions: 'Test with simulated file URLs'
    };
    
    const questions = [
      { questionNo: 1, maxMarks: 25, obtainedMarks: 20, remarks: 'Good work' },
      { questionNo: 2, maxMarks: 25, obtainedMarks: 22, remarks: 'Excellent' }
    ];
    
    // Simulate what would come from file uploads
    const fileUrls = {
      questionPaper: 'https://example.com/question-paper.pdf',
      answerSheet: 'https://example.com/answer-sheet.pdf',
      answerKey: 'https://example.com/answer-key.pdf'
    };
    
    console.log('📤 Sending file URLs:', fileUrls);
    
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
      
      // Check what URLs were actually saved
      console.log('\n🔍 URLs actually saved:');
      console.log(`📄 Question Paper URL: ${createResponse.data.test.questionPaperURL || 'NOT SAVED'}`);
      console.log(`📝 Answer Key URL: ${createResponse.data.test.answerKeyURL || 'NOT SAVED'}`);
      console.log(`📋 Answer Sheet URL: ${createResponse.data.result.answerSheetURL || 'NOT SAVED'}`);
      
      if (createResponse.data.test.questionPaperURL && 
          createResponse.data.test.answerKeyURL && 
          createResponse.data.result.answerSheetURL) {
        console.log('\n🎉 SUCCESS: All file URLs were saved correctly!');
      } else {
        console.log('\n❌ ISSUE: Some file URLs were not saved');
      }
      
    } else {
      throw new Error(`Failed to create test: ${createResponse.data.message}`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testManualTestCreationWithSimulatedFiles();
