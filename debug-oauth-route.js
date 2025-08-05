const express = require('express');
const router = express.Router();

// Simple test route for OAuth debugging
router.get('/test-oauth', (req, res) => {
  console.log('🧪 Testing OAuth configuration...');
  
  // Check environment variables
  const hasClientId = !!process.env.GOOGLE_OAUTH_CLIENT_ID;
  const hasClientSecret = !!process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  
  console.log('Environment check:');
  console.log('- CLIENT_ID:', hasClientId);
  console.log('- CLIENT_SECRET:', hasClientSecret);
  
  if (!hasClientId || !hasClientSecret) {
    return res.json({
      error: 'Missing OAuth credentials',
      details: {
        hasClientId,
        hasClientSecret,
        envVars: Object.keys(process.env).filter(key => key.includes('GOOGLE'))
      }
    });
  }
  
  try {
    const { google } = require('googleapis');
    
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_OAUTH_CLIENT_ID,
      process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      'http://localhost:5000/auth/google/callback'
    );
    
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/drive.file'],
      prompt: 'consent',
    });
    
    console.log('✅ Generated URL:', authUrl);
    
    res.json({
      success: true,
      authUrl: authUrl,
      urlValid: authUrl.startsWith('https://accounts.google.com')
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
    res.json({
      error: error.message,
      stack: error.stack
    });
  }
});

module.exports = router;
