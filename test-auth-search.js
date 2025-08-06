// Test authentication and search endpoint
const http = require('http');

// First, let's test admin login to get a token
const loginData = JSON.stringify({
  email: 'mdalamrahman4@gmail.com', // From .env
  password: 'Zerocheck@admin1' // From .env
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

console.log('🔐 Testing admin login...');

const loginReq = http.request(loginOptions, (res) => {
  console.log(`Login Status Code: ${res.statusCode}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('Login Response:', data);
    
    if (res.statusCode === 200) {
      try {
        const loginResult = JSON.parse(data);
        const token = loginResult.token;
        
        if (token) {
          console.log('✅ Got token, testing search...');
          testSearchWithToken(token);
        } else {
          console.error('❌ No token in login response');
        }
      } catch (error) {
        console.error('❌ Error parsing login response:', error);
      }
    }
  });
});

loginReq.on('error', (error) => {
  console.error('Login Error:', error);
});

loginReq.write(loginData);
loginReq.end();

function testSearchWithToken(token) {
  const searchOptions = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/admin/manual-test/search-students?query=md',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };

  console.log('🔍 Testing search with token...');

  const searchReq = http.request(searchOptions, (res) => {
    console.log(`Search Status Code: ${res.statusCode}`);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      console.log('Search Response:', data);
    });
  });

  searchReq.on('error', (error) => {
    console.error('Search Error:', error);
  });

  searchReq.end();
}
