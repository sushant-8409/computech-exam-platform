require('dotenv').config();

console.log('🔧 Google OAuth Configuration Test');
console.log('=====================================');

const requiredVars = [
  'GOOGLE_OAUTH_CLIENT_ID',
  'GOOGLE_OAUTH_CLIENT_SECRET'
];

let allConfigured = true;

console.log('\n📋 Environment Variables:');
requiredVars.forEach(varName => {
  const value = process.env[varName];
  const status = value ? '✅ Set' : '❌ Missing';
  console.log(`  ${varName}: ${status}`);
  if (!value) allConfigured = false;
});

console.log(`\n🌍 Environment: ${process.env.NODE_ENV || 'development'}`);

const getRedirectUri = () => {
  if (process.env.GOOGLE_OAUTH_REDIRECT_URL) {
    return process.env.GOOGLE_OAUTH_REDIRECT_URL;
  }
  
  if (process.env.NODE_ENV === 'production') {
    return 'https://computech-exam-platform.onrender.com/auth/google/callback';
  } else {
    return 'http://localhost:5000/auth/google/callback';
  }
};

console.log(`📍 Redirect URI: ${getRedirectUri()}`);

if (allConfigured) {
  console.log('\n✅ OAuth configuration looks good!');
  console.log('\n🧪 Testing OAuth URL generation...');
  
  try {
    const { getAuthUrl } = require('./services/oauthDrive');
    const authUrl = getAuthUrl();
    console.log('✅ OAuth URL generated successfully');
    console.log(`🔗 URL: ${authUrl}`);
    
    if (authUrl.startsWith('https://accounts.google.com')) {
      console.log('✅ URL format is correct');
    } else {
      console.log('❌ URL format is incorrect');
    }
  } catch (error) {
    console.log('❌ Error generating OAuth URL:', error.message);
  }
} else {
  console.log('\n❌ OAuth configuration incomplete!');
  console.log('\n📝 To fix this:');
  console.log('1. Go to Google Cloud Console');
  console.log('2. Create OAuth 2.0 credentials');
  console.log('3. Set the redirect URI to: ' + getRedirectUri());
  console.log('4. Add the credentials to your .env file');
}

console.log('\n🔗 Test URL: http://localhost:5000/auth/google');
