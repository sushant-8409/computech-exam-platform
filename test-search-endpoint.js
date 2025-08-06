const http = require('http');

// Test the search endpoint
const testSearchEndpoint = async () => {
  const postData = JSON.stringify({
    // No data needed for GET request
  });

  const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/admin/manual-test/search-students?query=test',
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const req = http.request(options, (res) => {
    console.log(`Status Code: ${res.statusCode}`);
    console.log(`Headers:`, res.headers);

    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      console.log('Response:', data);
    });
  });

  req.on('error', (error) => {
    console.error('Error:', error);
  });

  req.end();
};

console.log('Testing search endpoint...');
testSearchEndpoint();
