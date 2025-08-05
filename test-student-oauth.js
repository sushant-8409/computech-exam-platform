// Test script to check student OAuth flow
const axios = require('axios');
const jwt = require('jsonwebtoken');

// Create a mock student token
const studentPayload = {
  id: '507f1f77bcf86cd799439011', // Mock student ID
  role: 'student',
  email: 'teststudent@example.com'
};

const token = jwt.sign(studentPayload, process.env.JWT_SECRET || 'test-secret');
console.log('🎯 Generated test student token:', token);

// Test OAuth initiation with student token
async function testStudentOAuth() {
  try {
    console.log('\n🧪 Testing Student OAuth Flow...');
    
    const response = await axios.get('http://localhost:5000/auth/google', {
      params: { token: token },
      maxRedirects: 0,
      validateStatus: function (status) {
        return status >= 200 && status < 400; // Allow redirects
      }
    });
    
    console.log('✅ OAuth initiation successful');
    console.log('📋 Response status:', response.status);
    console.log('🔗 Redirect location:', response.headers.location);
    
    if (response.headers.location && response.headers.location.includes('accounts.google.com')) {
      console.log('✅ Properly redirecting to Google OAuth');
      
      // Check if state parameter is included
      if (response.headers.location.includes('state=')) {
        console.log('✅ State parameter included in OAuth URL');
      } else {
        console.log('❌ State parameter missing from OAuth URL');
      }
    } else {
      console.log('❌ Not redirecting to Google OAuth properly');
    }
    
  } catch (error) {
    if (error.response && error.response.status === 302) {
      console.log('✅ OAuth redirect successful (302)');
      console.log('🔗 Redirect location:', error.response.headers.location);
    } else {
      console.error('❌ OAuth test failed:', error.message);
      if (error.response) {
        console.log('Response status:', error.response.status);
        console.log('Response data:', error.response.data);
      }
    }
  }
}

testStudentOAuth();
