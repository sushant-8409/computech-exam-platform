// Debug script to test manual test creation with file uploads
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

async function testManualTestWithFiles() {
  try {
    console.log('🚀 Starting manual test creation with files debug...');
    
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
    
    // Step 3: Create a test PDF file
    console.log('\n📄 Step 3: Creating test PDF file...');
    const pdfContent = Buffer.from(`%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj

4 0 obj
<<
/Length 44
>>
stream
BT
/F1 12 Tf
100 700 Td
(Debug Test Question Paper) Tj
ET
endstream
endobj

xref
0 5
0000000000 65535 f 
0000000010 00000 n 
0000000079 00000 n 
0000000173 00000 n 
0000000301 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
398
%%EOF`);
    
    const tempFilePath = path.join(__dirname, 'debug-test-paper.pdf');
    fs.writeFileSync(tempFilePath, pdfContent);
    console.log('✅ Created test PDF file');
    
    // Step 4: Upload question paper file
    console.log('\n📤 Step 4: Testing file upload...');
    const formData = new FormData();
    formData.append('file', fs.createReadStream(tempFilePath));
    formData.append('fileType', 'questionPaper');
    formData.append('category', 'manual-test');
    
    const uploadResponse = await axios.post('http://localhost:5000/api/admin/manual-test/upload', formData, {
      headers: {
        'Authorization': `Bearer ${token}`,
        ...formData.getHeaders()
      }
    });
    
    if (!uploadResponse.data.success) {
      throw new Error('File upload failed');
    }
    
    const questionPaperUrl = uploadResponse.data.fileUrl;
    console.log('✅ File upload successful');
    console.log('📁 Question Paper URL:', questionPaperUrl);
    console.log('💾 Storage method:', uploadResponse.data.storage);
    
    // Step 5: Create manual test with file URL
    console.log('\n📋 Step 5: Create manual test entry with files...');
    
    const testData = {
      title: 'Debug Manual Test with Files',
      subject: 'Mathematics',
      class: student.class,
      board: student.board,
      school: student.school,
      testType: 'offline',
      testDate: new Date().toISOString().split('T')[0],
      duration: 60,
      totalQuestions: 2,
      instructions: 'Debug test entry with file uploads'
    };
    
    const questions = [
      { questionNo: 1, maxMarks: 20, obtainedMarks: 18, remarks: 'Great work' },
      { questionNo: 2, maxMarks: 30, obtainedMarks: 25, remarks: 'Very good' }
    ];
    
    const fileUrls = {
      questionPaper: questionPaperUrl
    };
    
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
      console.log('✅ Manual test with files created successfully!');
      console.log(`📋 Test ID: ${createResponse.data.test._id}`);
      console.log(`📊 Result ID: ${createResponse.data.result._id}`);
      console.log(`📄 Question Paper URL in Test: ${createResponse.data.test.questionPaperURL || 'NOT SET'}`);
      console.log(`📝 Answer Sheet URL in Result: ${createResponse.data.result.answerSheetURL || 'NOT SET'}`);
      console.log(`🎯 Total Marks: ${createResponse.data.result.totalMarks}`);
      console.log(`📈 Marks Obtained: ${createResponse.data.result.marksObtained}`);
      console.log(`📊 Percentage: ${createResponse.data.result.percentage}%`);
    } else {
      throw new Error(`Failed to create test: ${createResponse.data.message}`);
    }
    
    // Cleanup
    fs.unlinkSync(tempFilePath);
    
    console.log('\n🎉 Debug test with files completed successfully!');
    
  } catch (error) {
    console.error('❌ Debug test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    
    // Cleanup on error
    const tempFilePath = path.join(__dirname, 'debug-test-paper.pdf');
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
  }
}

// Check if required modules are available
try {
  testManualTestWithFiles();
} catch (error) {
  console.error('❌ Please install required modules: npm install axios form-data');
}
