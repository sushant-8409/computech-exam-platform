const http = require('http');

console.log('Testing Manual Test Entry API endpoints...');

// Test if server responds to basic API call
const testOptions = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/admin/manual-test/search-students?query=test',
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  }
};

console.log('1. Testing student search endpoint...');
const req = http.request(testOptions, (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  console.log(`Headers:`, res.headers);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Response:', data);
    console.log('✅ Manual Test Entry API test completed');
  });
});

req.on('error', (error) => {
  console.error('❌ Error testing API:', error.message);
  console.log('Make sure the server is running on port 5000');
});

req.end();

setTimeout(() => {
  console.log('Test completed. Check the server logs for more details.');
  process.exit(0);
}, 3000);
