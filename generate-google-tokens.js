#!/usr/bin/env node

/**
 * Google OAuth Token Generator for Production Deployment
 * 
 * This script generates Google OAuth tokens locally using a temporary server
 * that can be used in production environments like Vercel.
 * 
 * Usage:
 * 1. Add http://localhost:3001/auth/callback to Google Cloud Console
 * 2. Run: node generate-google-tokens.js
 * 3. Follow the authorization in browser
 * 4. Copy the generated tokens to your .env file
 * 5. Deploy to production
 */

const { google } = require('googleapis');
const express = require('express');
const open = require('open');
require('dotenv').config();

// Configuration
const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3001/auth/callback'; // Fixed localhost URI for token generation
const PORT = 3001;

// Scopes needed for Google Drive
const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email'
];

console.log('🔧 Google Token Generator');
console.log('========================');

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ Missing required environment variables:');
  console.error('   GOOGLE_OAUTH_CLIENT_ID');
  console.error('   GOOGLE_OAUTH_CLIENT_SECRET');
  console.error('\nPlease check your .env file');
  process.exit(1);
}

console.log('✅ Client ID:', CLIENT_ID ? 'Set' : 'Missing');
console.log('✅ Client Secret:', CLIENT_SECRET ? 'Set' : 'Missing');
console.log('📍 Redirect URI:', REDIRECT_URI);
console.log('');

// Create OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

// Create express app for handling callback
const app = express();

// Generate auth URL
const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
  prompt: 'consent' // Force consent to get refresh token
});

console.log('🔗 Generated OAuth URL:');
console.log(authUrl);
console.log('');

// Handle the callback
app.get('/auth/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    console.error('❌ OAuth Error:', error);
    res.send(`
      <h1>OAuth Error</h1>
      <p>Error: ${error}</p>
      <p>Please check your Google Cloud Console configuration.</p>
    `);
    return;
  }

  if (!code) {
    console.error('❌ No authorization code received');
    res.send('<h1>Error: No authorization code received</h1>');
    return;
  }

  try {
    // Exchange code for tokens
    console.log('🔄 Exchanging code for tokens...');
    const { tokens } = await oauth2Client.getToken(code);
    
    console.log('✅ Tokens received successfully!');
    console.log('');
    console.log('📋 Add these to your .env file:');
    console.log('=====================================');
    console.log(`GOOGLE_ACCESS_TOKEN=${tokens.access_token}`);
    console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token || 'Not provided'}`);
    console.log(`GOOGLE_TOKEN_TYPE=${tokens.token_type || 'Bearer'}`);
    console.log(`GOOGLE_TOKEN_EXPIRY=${tokens.expiry_date || 'Not provided'}`);
    console.log('=====================================');
    console.log('');

    // Test the tokens
    oauth2Client.setCredentials(tokens);
    
    try {
      const drive = google.drive({ version: 'v3', auth: oauth2Client });
      const response = await drive.about.get({ fields: 'user' });
      console.log('✅ Token test successful!');
      console.log('👤 Authenticated as:', response.data.user.emailAddress);
      console.log('');
    } catch (testError) {
      console.warn('⚠️ Token test failed:', testError.message);
    }

    // Send success response
    res.send(`
      <html>
        <head>
          <title>OAuth Success</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; }
            .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; }
            .success { color: #28a745; }
            .token-box { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 10px 0; font-family: monospace; }
            .copy-btn { background: #007bff; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1 class="success">✅ OAuth Success!</h1>
            <p>Google Drive tokens have been generated. Check your terminal for the environment variables to copy.</p>
            
            <h3>Environment Variables:</h3>
            <div class="token-box">
GOOGLE_ACCESS_TOKEN=${tokens.access_token}<br>
GOOGLE_REFRESH_TOKEN=${tokens.refresh_token || 'Not provided'}<br>
GOOGLE_TOKEN_TYPE=${tokens.token_type || 'Bearer'}<br>
GOOGLE_TOKEN_EXPIRY=${tokens.expiry_date || 'Not provided'}
            </div>
            
            <p><strong>Next Steps:</strong></p>
            <ol>
              <li>Copy the environment variables above to your .env file</li>
              <li>Deploy to Vercel with these new environment variables</li>
              <li>Google Drive will work without session-based OAuth</li>
            </ol>
            
            <p>You can now close this window and stop the token generator.</p>
          </div>
        </body>
      </html>
    `);

    // Keep server running for a bit then exit
    setTimeout(() => {
      console.log('🎉 Token generation complete! You can now Ctrl+C to stop the server.');
      console.log('📝 Don\'t forget to add the tokens to your .env file and redeploy!');
    }, 2000);

  } catch (error) {
    console.error('❌ Token exchange failed:', error);
    res.send(`
      <h1>Token Exchange Failed</h1>
      <p>Error: ${error.message}</p>
      <p>Please try again or check your configuration.</p>
    `);
  }
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 Token generator server running on http://localhost:${PORT}`);
  console.log('');
  console.log('📋 IMPORTANT: Add this redirect URI to your Google Cloud Console:');
  console.log('   http://localhost:3001/auth/callback');
  console.log('');
  console.log('🌐 Opening browser to start OAuth flow...');
  console.log('   If it doesn\'t open automatically, copy the OAuth URL above');
  console.log('');
  
  // Auto-open browser
  setTimeout(() => {
    open(authUrl).catch(() => {
      console.log('❌ Could not auto-open browser. Please manually visit the OAuth URL above.');
    });
  }, 1000);
});

// Handle shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down token generator...');
  server.close(() => {
    console.log('✅ Token generator stopped');
    process.exit(0);
  });
});

// Handle errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled Rejection:', error.message);
  process.exit(1);
});