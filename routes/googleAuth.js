const express = require('express');
const { google } = require('googleapis');
const router = express.Router();

// Google OAuth2 configuration
const getRedirectUri = () => {
  if (process.env.NODE_ENV === 'production') {
    return 'https://computech-07f0.onrender.com/auth/google/callback';
  }
  return 'http://localhost:5000/auth/google/callback';
};

console.log('🔧 OAuth Configuration:');
console.log('- Environment:', process.env.NODE_ENV || 'development');
console.log('- Client ID:', process.env.GOOGLE_OAUTH_CLIENT_ID ? 'Set' : 'Missing');
console.log('- Client Secret:', process.env.GOOGLE_OAUTH_CLIENT_SECRET ? 'Set' : 'Missing');
console.log('- Redirect URI:', getRedirectUri());

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_OAUTH_CLIENT_ID,
  process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  getRedirectUri()
);

// Define the scopes for Google Drive access
// For file upload functionality, we need Drive scopes in both dev and production
// Note: This requires Google Cloud Console configuration with test users for development
const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email'
];

// Simple test route
router.get('/auth/test', (req, res) => {
  res.json({ message: 'Auth routes are working!' });
});

// Google OAuth routes - Start OAuth flow
// Update your existing /auth/google route
router.get('/auth/google', (req, res) => {
  console.log('🔗 /auth/google route hit - starting OAuth flow');
  
  const { token } = req.query; // Get token from student dashboard
  const isStudentFlow = !!token; // If token is present, it's from student dashboard
  
  // Store the token and flow type in session
  if (isStudentFlow) {
    req.session.userToken = token;
    req.session.oauthFlow = 'student';
    console.log('👨‍🎓 Student OAuth flow detected');
  } else {
    req.session.oauthFlow = 'admin';
    console.log('👨‍💼 Admin OAuth flow detected');
  }
  
  console.log('🌐 Current environment:', process.env.NODE_ENV || 'development');
  console.log('🔗 Using redirect URI:', getRedirectUri());
  
  // Check if required environment variables are set
  if (!process.env.GOOGLE_OAUTH_CLIENT_ID || !process.env.GOOGLE_OAUTH_CLIENT_SECRET) {
    console.error('❌ Missing Google OAuth credentials');
    
    if (isStudentFlow) {
      // For student popup flow, send postMessage
      return res.send(`
        <script>
          if (window.opener) {
            window.opener.postMessage({ 
              type: 'OAUTH_ERROR', 
              error: 'Google OAuth credentials not configured' 
            }, '*');
            window.close();
          } else {
            alert('Configuration Error: Google OAuth credentials missing');
          }
        </script>
      `);
    } else {
      // For admin flow, redirect as before
      return res.status(500).send(`
        <h1>Configuration Error</h1>
        <p>Google OAuth credentials are not configured.</p>
        <script>
          setTimeout(() => {
            window.location.href = '/admin?tab=create-test&error=config';
          }, 3000);
        </script>
      `);
    }
  }

  try {
    // Generate authentication URL
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent'
    });

    console.log('🔗 Generated OAuth URL:', authUrl);
    console.log('🔗 Redirecting to Google OAuth...');
    res.redirect(authUrl);
  } catch (error) {
    console.error('❌ Error generating OAuth URL:', error);
    
    if (isStudentFlow) {
      return res.send(`
        <script>
          if (window.opener) {
            window.opener.postMessage({ 
              type: 'OAUTH_ERROR', 
              error: 'Failed to generate authentication URL: ${error.message}' 
            }, '*');
            window.close();
          }
        </script>
      `);
    } else {
      return res.status(500).send(`
        <h1>OAuth Error</h1>
        <p>Failed to generate authentication URL: ${error.message}</p>
        <script>
          setTimeout(() => {
            window.location.href = '/admin?tab=create-test&error=oauth_generation';
          }, 5000);
        </script>
      `);
    }
  }
});


// Google OAuth callback - Handle the authorization code
// Update your existing callback route
router.get('/auth/google/callback', async (req, res) => {
  console.log('🔗 OAuth callback route hit');
  const { code, error } = req.query;
  const oauthFlow = req.session.oauthFlow || 'admin'; // Default to admin if not set
  const isStudentFlow = oauthFlow === 'student';
  
  console.log(`📱 OAuth flow type: ${oauthFlow}`);

  if (error) {
    console.error('❌ OAuth error:', error);
    
    if (isStudentFlow) {
      // For student popup flow
      return res.send(`
        <script>
          console.log('Sending OAuth error to parent window');
          if (window.opener) {
            window.opener.postMessage({ 
              type: 'OAUTH_ERROR', 
              error: '${error}' 
            }, '*');
            window.close();
          } else {
            alert('OAuth Error: ${error}');
          }
        </script>
      `);
    } else {
      // For admin flow (existing logic)
      const frontendUrl = process.env.NODE_ENV === 'production' 
        ? 'https://computech-exam-platform.onrender.com' 
        : 'http://localhost:3000';
      
      if (error === 'access_denied') {
        return res.send(`
          <h1>Google OAuth Access Denied</h1>
          <p>The app needs Google verification to access Drive.</p>
          <button onclick="window.location.href='${frontendUrl}/admin'">Back to Admin</button>
        `);
      }
      return res.redirect(`${frontendUrl}/admin?tab=create-test&error=oauth_denied`);
    }
  }

  if (!code) {
    console.error('❌ No authorization code received');
    
    if (isStudentFlow) {
      return res.send(`
        <script>
          if (window.opener) {
            window.opener.postMessage({ 
              type: 'OAUTH_ERROR', 
              error: 'No authorization code received' 
            }, '*');
            window.close();
          }
        </script>
      `);
    } else {
      const frontendUrl = process.env.NODE_ENV === 'production' 
        ? 'https://computech-exam-platform.onrender.com' 
        : 'http://localhost:3000';
      return res.redirect(`${frontendUrl}/admin?tab=create-test&error=no_code`);
    }
  }

  try {
    // Exchange authorization code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    console.log('✅ OAuth tokens received');
    
    // Set credentials
    oauth2Client.setCredentials(tokens);

    // Store tokens in session
    req.session.googleTokens = tokens;
    
    // Test Drive API access
    try {
      const drive = google.drive({ version: 'v3', auth: oauth2Client });
      const response = await drive.about.get({ fields: 'user' });
      console.log('✅ Google Drive connected for user:', response.data.user.emailAddress);
    } catch (driveError) {
      console.error('⚠️ Drive API test failed:', driveError.message);
    }
    
    if (isStudentFlow) {
      // For student popup flow - send success message
      console.log('🎓 Sending success message to student dashboard');
      return res.send(`
        <script>
          console.log('Sending OAuth success message to parent window');
          if (window.opener) {
            window.opener.postMessage({ type: 'OAUTH_SUCCESS' }, '*');
            window.close();
          } else {
            alert('Google Drive connected successfully!');
            window.close();
          }
        </script>
      `);
    } else {
      // For admin flow (existing logic)
      const frontendUrl = process.env.NODE_ENV === 'production' 
        ? 'https://computech-exam-platform.onrender.com' 
        : 'http://localhost:3000';
      
      const redirectUrl = `${frontendUrl}/admin?tab=create-test&oauth=success`;
      console.log('🔄 Redirecting to admin:', redirectUrl);
      res.redirect(redirectUrl);
    }
    
  } catch (error) {
    console.error('❌ OAuth token exchange failed:', error);
    
    if (isStudentFlow) {
      return res.send(`
        <script>
          if (window.opener) {
            window.opener.postMessage({ 
              type: 'OAUTH_ERROR', 
              error: 'Token exchange failed: ${error.message}' 
            }, '*');
            window.close();
          }
        </script>
      `);
    } else {
      const frontendUrl = process.env.NODE_ENV === 'production' 
        ? 'https://computech-exam-platform.onrender.com' 
        : 'http://localhost:3000';
      
      res.redirect(`${frontendUrl}/admin?tab=create-test&error=token_exchange`);
    }
  }
});

// Route to check Google Drive connection status
router.get('/auth/google/status', async (req, res) => {
  try {
    const isConnected = !!(req.session.googleTokens && req.session.googleTokens.access_token);
    
    let driveAccess = false;
    let userInfo = null;
    let error = null;

    if (isConnected) {
      try {
        // Test Drive API access
        const oauth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_OAUTH_CLIENT_ID,
          process.env.GOOGLE_OAUTH_CLIENT_SECRET
        );
        oauth2Client.setCredentials(req.session.googleTokens);

        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        const driveResponse = await drive.about.get({ fields: 'user' });
        driveAccess = true;
        userInfo = driveResponse.data.user;
        
        console.log('✅ Drive status check successful for:', userInfo.emailAddress);
      } catch (driveError) {
        console.error('❌ Drive access test failed:', driveError.message);
        error = driveError.message;
      }
    }

    res.json({ 
      connected: isConnected,
      driveAccess,
      userInfo,
      error,
      tokens: req.session.googleTokens ? 'present' : 'missing',
      scopes: req.session.googleTokens?.scope || 'unknown'
    });
  } catch (error) {
    console.error('❌ Status check error:', error);
    res.json({ 
      connected: false,
      error: error.message,
      tokens: 'error'
    });
  }
});

// Add a test route to verify Google Cloud Console configuration
router.get('/auth/google/test-config', (req, res) => {
  const config = {
    hasClientId: !!process.env.GOOGLE_OAUTH_CLIENT_ID,
    hasClientSecret: !!process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    hasFolderId: !!process.env.GOOGLE_DRIVE_FOLDER_ID,
    redirectUri: getRedirectUri(),
    environment: process.env.NODE_ENV || 'development',
    scopes: SCOPES
  };

  res.json({
    message: 'Google OAuth Configuration Test',
    config,
    instructions: {
      step1: 'Ensure Google Cloud Console OAuth 2.0 Client is configured',
      step2: 'Add authorized redirect URIs in Google Cloud Console',
      step3: 'Add your email as a test user in OAuth consent screen',
      step4: 'Ensure Drive API is enabled in Google Cloud Console'
    }
  });
});

// Route to disconnect Google Drive
router.post('/auth/google/disconnect', (req, res) => {
  req.session.googleTokens = null;
  res.json({ success: true, message: 'Google Drive disconnected' });
});

module.exports = router;
