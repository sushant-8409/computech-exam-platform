// Test file upload with proper PDF file
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

console.log('🔐 Getting admin token for file upload test...');

const loginReq = http.request(loginOptions, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    if (res.statusCode === 200) {
      const loginResult = JSON.parse(data);
      const token = loginResult.token;
      
      if (token) {
        console.log('✅ Got token, testing file upload...');
        testFileUpload(token);
      } else {
        console.error('❌ No token in login response');
      }
    }
  });
});

loginReq.write(loginData);
loginReq.end();

function testFileUpload(token) {
  // Create a simple PDF content (not a real PDF, but with PDF mimetype for testing)
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
(Test Question Paper) Tj
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
  
  const fileName = 'test-question-paper.pdf';
  
  const boundary = '----FormBoundary' + Math.random().toString(16);
  const formData = Buffer.concat([
    Buffer.from([
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="' + fileName + '"',
      'Content-Type: application/pdf',
      '',
      ''
    ].join('\r\n')),
    pdfContent,
    Buffer.from([
      '',
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
    ].join('\r\n'))
  ]);

  const uploadOptions = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/admin/manual-test/upload',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': formData.length
    }
  };

  console.log('📤 Testing PDF file upload...');

  const uploadReq = http.request(uploadOptions, (res) => {
    console.log(`Upload Status: ${res.statusCode}`);
    
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      console.log('Upload Response:');
      try {
        const response = JSON.parse(data);
        console.log(JSON.stringify(response, null, 2));
        
        if (response.success && response.fileUrl) {
          console.log('✅ File upload successful!');
          console.log('📁 File URL:', response.fileUrl);
          console.log('💾 Storage:', response.storage);
        } else {
          console.log('❌ File upload failed');
        }
      } catch (error) {
        console.log('Raw response:', data);
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
