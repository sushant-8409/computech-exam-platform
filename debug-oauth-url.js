require('dotenv').config();

console.log('🔧 Direct OAuth URL Test');
console.log('========================');

try {
  const { getAuthUrl } = require('./services/oauthDrive');
  console.log('📱 Calling getAuthUrl()...');
  
  const authUrl = getAuthUrl();
  console.log('✅ OAuth URL generated successfully:');
  console.log(authUrl);
  
  // Check if it's a valid Google OAuth URL
  if (authUrl && authUrl.startsWith('https://accounts.google.com/oauth/v2/auth')) {
    console.log('✅ URL format is correct - should redirect to Google');
  } else {
    console.log('❌ URL format is incorrect');
    console.log('Expected: https://accounts.google.com/oauth/v2/auth...');
    console.log('Got:', authUrl);
  }
  
} catch (error) {
  console.log('❌ Error generating OAuth URL:');
  console.log('Error message:', error.message);
  console.log('Stack:', error.stack);
}

console.log('\n🌍 Environment check:');
console.log('- CLIENT_ID exists:', !!process.env.GOOGLE_OAUTH_CLIENT_ID);
console.log('- CLIENT_SECRET exists:', !!process.env.GOOGLE_OAUTH_CLIENT_SECRET);
console.log('- NODE_ENV:', process.env.NODE_ENV || 'development');
