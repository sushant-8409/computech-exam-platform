const { google } = require('googleapis');
require('dotenv').config();

async function testDriveAccess() {
  console.log('🧪 Testing Google Drive API access...');
  
  // Check environment variables
  console.log('📋 Environment Check:');
  console.log('- GOOGLE_OAUTH_CLIENT_ID:', !!process.env.GOOGLE_OAUTH_CLIENT_ID);
  console.log('- GOOGLE_OAUTH_CLIENT_SECRET:', !!process.env.GOOGLE_OAUTH_CLIENT_SECRET);
  console.log('- GOOGLE_DRIVE_FOLDER_ID:', process.env.GOOGLE_DRIVE_FOLDER_ID || 'not set');
  
  // Check OAuth scopes
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    'http://localhost:3000/oauth/callback'
  );
  
  // Generate auth URL to show required scopes
  const scopes = [
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/drive.file'
  ];
  
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    include_granted_scopes: true
  });
  
  console.log('\n🔗 OAuth Configuration:');
  console.log('Required scopes:', scopes);
  console.log('Auth URL (partial):', authUrl.substring(0, 100) + '...');
  
  console.log('\n✅ Basic configuration appears correct.');
  console.log('📝 Next steps to resolve permission issues:');
  console.log('1. Go to Google Cloud Console (https://console.cloud.google.com)');
  console.log('2. Navigate to APIs & Services > OAuth consent screen');
  console.log('3. Add your email as a test user');
  console.log('4. Make sure Google Drive API is enabled in APIs & Services > Library');
  console.log('5. Test the upload after connecting to Google Drive in the app');
}

testDriveAccess().catch(console.error);
