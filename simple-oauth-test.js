require('dotenv').config();

console.log('🔧 Simple OAuth Test');
console.log('===================');

// Check environment variables first
console.log('Environment Variables:');
console.log('- GOOGLE_OAUTH_CLIENT_ID:', process.env.GOOGLE_OAUTH_CLIENT_ID ? 'Set (' + process.env.GOOGLE_OAUTH_CLIENT_ID.substring(0, 10) + '...)' : 'Missing');
console.log('- GOOGLE_OAUTH_CLIENT_SECRET:', process.env.GOOGLE_OAUTH_CLIENT_SECRET ? 'Set (' + process.env.GOOGLE_OAUTH_CLIENT_SECRET.substring(0, 10) + '...)' : 'Missing');

if (!process.env.GOOGLE_OAUTH_CLIENT_ID || !process.env.GOOGLE_OAUTH_CLIENT_SECRET) {
  console.log('\n❌ Missing OAuth credentials!');
  console.log('Please ensure you have:');
  console.log('GOOGLE_OAUTH_CLIENT_ID=your_client_id');
  console.log('GOOGLE_OAUTH_CLIENT_SECRET=your_client_secret');
  console.log('in your .env file');
  process.exit(1);
}

try {
  const { google } = require('googleapis');
  
  console.log('\n✅ Google APIs loaded');
  
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    'http://localhost:5000/auth/google/callback'
  );
  
  console.log('✅ OAuth2 client created');
  
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/drive.file'],
    prompt: 'consent',
  });
  
  console.log('\n🔗 Generated OAuth URL:');
  console.log(authUrl);
  
  if (authUrl.startsWith('https://accounts.google.com')) {
    console.log('\n✅ OAuth URL is valid!');
    console.log('The issue is not with URL generation.');
  } else {
    console.log('\n❌ OAuth URL is invalid!');
  }
  
} catch (error) {
  console.log('\n❌ Error generating OAuth URL:');
  console.log('Message:', error.message);
  console.log('Stack:', error.stack);
}
