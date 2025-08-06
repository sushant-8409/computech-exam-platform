// Test file upload functionality
const http = require('http');
const fs = require('fs');
const path = require('path');

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

console.log('🔐 Getting admin token for upload test...');

const loginReq = http.request(loginOptions, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    if (res.statusCode === 200) {
      const loginResult = JSON.parse(data);
      const token = loginResult.token;
      
      if (token) {
        console.log('✅ Got token, testing upload...');
        testUpload(token);
      } else {
        console.error('❌ No token in login response');
      }
    }
  });
});

loginReq.write(loginData);
loginReq.end();

function testUpload(token) {
  // Create a simple test file
  const testContent = 'This is a test file for manual test entry upload.';
  const fileName = 'test-upload.txt';
  
  const boundary = '----FormBoundary' + Math.random().toString(16);
  const formData = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="file"; filename="' + fileName + '"',
    'Content-Type: text/plain',
    '',
    testContent,
    `--${boundary}`,
    'Content-Disposition: form-data; name="fileType"',
    '',
    'questionPaper',
    `--${boundary}`,
    'Content-Disposition: form-data; name="category"',
    '',
    'manual-test',
    `--${boundary}--`,
    ''
  ].join('\r\n');

  const uploadOptions = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/admin/manual-test/upload',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': Buffer.byteLength(formData)
    }
  };

  console.log('📤 Testing file upload...');

  const uploadReq = http.request(uploadOptions, (res) => {
    console.log(`Upload Status: ${res.statusCode}`);
    
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      console.log('Upload Response:', data);
      
      if (res.statusCode === 200) {
        console.log('✅ Upload test successful!');
      } else {
        console.log('❌ Upload test failed');
      }
    });
  });

  uploadReq.on('error', (error) => {
    console.error('Upload Error:', error);
  });

  uploadReq.write(formData);
  uploadReq.end();
}

loginReq.on('error', (error) => {
  console.error('Login Error:', error);
});
