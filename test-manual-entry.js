// Test manual test entry creation
const http = require('http');

// First, login to get token
const loginData = JSON.stringify({
  email: 'mdalamrahman4@gmail.com',
  password: 'Zerocheck@admin1'
});

const loginOptions = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(loginData)
  }
};

console.log('🔐 Getting admin token for manual test creation...');

const loginReq = http.request(loginOptions, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    if (res.statusCode === 200) {
      const loginResult = JSON.parse(data);
      const token = loginResult.token;
      
      if (token) {
        console.log('✅ Got token, testing manual test creation...');
        testManualEntry(token);
      } else {
        console.error('❌ No token in login response');
      }
    }
  });
});

loginReq.write(loginData);
loginReq.end();

function testManualEntry(token) {
  const testData = {
    testData: {
      title: "Test Math Quiz",
      subject: "Mathematics",
      class: "10",
      board: "CBSE",
      school: "Test School",
      testType: "offline",
      testDate: new Date().toISOString(),
      duration: 60,
      totalQuestions: 2,
      instructions: "Solve all questions"
    },
    studentId: "683acd88feb7e5ec188f6cbc", // Use a student ID from our search results
    questions: [
      {
        questionNo: 1,
        maxMarks: 5,
        obtainedMarks: 4,
        remarks: "Good work"
      },
      {
        questionNo: 2,
        maxMarks: 5,
        obtainedMarks: 3,
        remarks: "Needs improvement"
      }
    ],
    fileUrls: {}
  };

  const postData = JSON.stringify(testData);
  
  const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/admin/manual-test/create',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  console.log('📝 Testing manual test entry creation...');

  const req = http.request(options, (res) => {
    console.log(`Create Status: ${res.statusCode}`);
    
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      console.log('Create Response:', data);
      
      if (res.statusCode === 201) {
        console.log('✅ Manual test entry creation successful!');
      } else {
        console.log('❌ Manual test entry creation failed');
      }
    });
  });

  req.on('error', (error) => {
    console.error('Create Error:', error);
  });

  req.write(postData);
  req.end();
}

loginReq.on('error', (error) => {
  console.error('Login Error:', error);
});
