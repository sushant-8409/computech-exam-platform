const express = require('express');
const { google } = require('googleapis');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();

// Google OAuth2 configuration
const getRedirectUri = () => {
  // Prefer explicit configuration
  if (process.env.GOOGLE_OAUTH_REDIRECT_URI) {
    return process.env.GOOGLE_OAUTH_REDIRECT_URI;
  }
  // Fallbacks by environment
  if (process.env.NODE_ENV === 'production') {
    // Default to backend domain if not provided via env
    return 'https://auctutor.app/auth/google/callback';
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
        ? 'https://auctutor.app' 
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
        ? 'https://auctutor.app' 
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
    
    // Persist tokens to MongoDB for the authenticated user (admin/student) if token was provided during start
    try {
      const sessionToken = req.session.userToken;
      if (sessionToken) {
        const decoded = jwt.verify(sessionToken, process.env.JWT_SECRET || 'fallback-secret');
        if (decoded && decoded.id) {
          const userId = decoded.id;
          const updated = await User.findByIdAndUpdate(
            userId,
            {
              $set: {
                googleTokens: tokens,
                googleConnected: true
              }
            },
            { new: true }
          );
          if (updated) {
            console.log('🗄️ Saved Google tokens for user:', updated.email || updated._id.toString());
          } else {
            console.warn('⚠️ Could not find user to save Google tokens');
          }
        }
      } else {
        console.log('ℹ️ No session user token found; skipping DB token persist');
      }
    } catch (persistErr) {
      console.warn('⚠️ Failed to persist Google tokens to DB:', persistErr.message);
    }
    
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
      // For admin flow - show tokens for environment setup
      const frontendUrl = process.env.NODE_ENV === 'production' 
        ? 'https://auctutor.app' 
        : 'http://localhost:3000';
      
      // In production, show tokens for manual .env configuration
      if (process.env.NODE_ENV === 'production') {
        return res.send(`
          <html>
            <head>
              <title>Google OAuth Success</title>
              <style>
                body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; }
                .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                .success { color: #28a745; margin-bottom: 20px; }
                .token-section { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 10px 0; }
                .token-label { font-weight: bold; color: #495057; margin-bottom: 5px; }
                .token-value { font-family: monospace; background: #e9ecef; padding: 10px; border-radius: 3px; word-break: break-all; font-size: 12px; }
                .copy-btn { background: #007bff; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer; margin-top: 5px; }
                .copy-btn:hover { background: #0056b3; }
                .instructions { background: #d1ecf1; padding: 15px; border-radius: 5px; margin-top: 20px; border-left: 4px solid #bee5eb; }
                .continue-btn { background: #28a745; color: white; padding: 12px 24px; border: none; border-radius: 5px; text-decoration: none; display: inline-block; margin-top: 20px; }
              </style>
            </head>
            <body>
              <div class="container">
                <h2 class="success">✅ Google OAuth Connected Successfully!</h2>
                
                <p><strong>For production deployment, add these tokens to your .env file:</strong></p>
                
                <div class="token-section">
                  <div class="token-label">GOOGLE_ACCESS_TOKEN:</div>
                  <div class="token-value" id="access-token">${tokens.access_token}</div>
                  <button class="copy-btn" onclick="copyToClipboard('access-token')">Copy</button>
                </div>
                
                <div class="token-section">
                  <div class="token-label">GOOGLE_REFRESH_TOKEN:</div>
                  <div class="token-value" id="refresh-token">${tokens.refresh_token || 'Not provided'}</div>
                  <button class="copy-btn" onclick="copyToClipboard('refresh-token')">Copy</button>
                </div>
                
                <div class="token-section">
                  <div class="token-label">GOOGLE_TOKEN_EXPIRY:</div>
                  <div class="token-value" id="expiry">${tokens.expiry_date || 'Not provided'}</div>
                  <button class="copy-btn" onclick="copyToClipboard('expiry')">Copy</button>
                </div>
                
                <div class="instructions">
                  <h4>📋 Next Steps:</h4>
                  <ol>
                    <li>Copy the tokens above to your Vercel environment variables</li>
                    <li>Or add them to your .env file if deploying elsewhere</li>
                    <li>Redeploy your application</li>
                    <li>Google Drive upload functionality will then work in production</li>
                  </ol>
                </div>
                
                <a href="${frontendUrl}/admin?tab=create-test&oauth=success" class="continue-btn">
                  Continue to Admin Dashboard
                </a>
              </div>
              
              <script>
                function copyToClipboard(elementId) {
                  const element = document.getElementById(elementId);
                  const text = element.textContent;
                  navigator.clipboard.writeText(text).then(() => {
                    const btn = element.nextElementSibling;
                    const originalText = btn.textContent;
                    btn.textContent = 'Copied!';
                    btn.style.background = '#28a745';
                    setTimeout(() => {
                      btn.textContent = originalText;
                      btn.style.background = '#007bff';
                    }, 2000);
                  }).catch(() => {
                    alert('Failed to copy. Please select and copy manually.');
                  });
                }
              </script>
            </body>
          </html>
        `);
      } else {
        // In development, redirect as usual
        const redirectUrl = `${frontendUrl}/admin?tab=create-test&oauth=success`;
        console.log('🔄 Redirecting to admin:', redirectUrl);
        res.redirect(redirectUrl);
      }
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
        ? 'https://auctutor.app' 
        : 'http://localhost:3000';
      
      res.redirect(`${frontendUrl}/admin?tab=create-test&error=token_exchange`);
    }
  }
});

// Route to check Google Drive connection status
router.get('/auth/google/status', async (req, res) => {
  try {
    console.log('🔍 OAuth Status Check:', {
      hasSessionTokens: !!(req.session?.googleTokens?.access_token),
      hasEnvTokens: !!process.env.GOOGLE_ACCESS_TOKEN,
      envTokenPreview: process.env.GOOGLE_ACCESS_TOKEN ? `${process.env.GOOGLE_ACCESS_TOKEN.substring(0, 20)}...` : 'none'
    });

    // Check session tokens first
    const sessionConnected = !!(req.session?.googleTokens?.access_token);
    
    // Check environment tokens (for production)
    const envConnected = !!(process.env.GOOGLE_ACCESS_TOKEN);
    
    const isConnected = sessionConnected || envConnected;
    
    let driveAccess = false;
    let userInfo = null;
    let error = null;
    let tokenSource = 'none';

    if (isConnected) {
      try {
        // Test Drive API access
        const oauth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_OAUTH_CLIENT_ID,
          process.env.GOOGLE_OAUTH_CLIENT_SECRET
        );
        
        // Prioritize environment tokens for production
        if (envConnected) {
          const envTokens = {
            access_token: process.env.GOOGLE_ACCESS_TOKEN,
            refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
            token_type: process.env.GOOGLE_TOKEN_TYPE || 'Bearer',
            expiry_date: process.env.GOOGLE_TOKEN_EXPIRY ? parseInt(process.env.GOOGLE_TOKEN_EXPIRY) : undefined
          };
          
          oauth2Client.setCredentials(envTokens);
          tokenSource = 'environment';
          console.log('📋 Using environment tokens for status check');
        } else if (sessionConnected) {
          oauth2Client.setCredentials(req.session.googleTokens);
          tokenSource = 'session';
          console.log('📋 Using session tokens for status check');
        }

        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        const driveResponse = await drive.about.get({ fields: 'user' });
        driveAccess = true;
        userInfo = driveResponse.data.user;
        
        console.log('✅ Drive status check successful for:', userInfo.emailAddress, `(${tokenSource})`);
      } catch (driveError) {
        console.error('❌ Drive access test failed:', driveError.message);
        error = driveError.message;
        
        // Try to provide helpful error messages
        if (driveError.message.includes('invalid_token')) {
          error = 'Tokens have expired. Please regenerate tokens using generate-google-tokens.js';
        } else if (driveError.message.includes('insufficient permissions')) {
          error = 'Insufficient Google Drive permissions. Please check OAuth scopes.';
        }
      }
    }

    const response = { 
      connected: isConnected,
      driveAccess,
      userInfo,
      error,
      tokenSource,
      sessionTokens: sessionConnected ? 'present' : 'missing',
      envTokens: envConnected ? 'present' : 'missing',
      scopes: req.session?.googleTokens?.scope || (envConnected ? 'drive.file,userinfo.profile,userinfo.email' : 'unknown'),
      debug: {
        hasGoogleClientId: !!process.env.GOOGLE_OAUTH_CLIENT_ID,
        hasGoogleClientSecret: !!process.env.GOOGLE_OAUTH_CLIENT_SECRET,
        nodeEnv: process.env.NODE_ENV
      }
    };

    console.log('📊 OAuth Status Response:', {
      connected: response.connected,
      driveAccess: response.driveAccess,
      tokenSource: response.tokenSource,
      userEmail: response.userInfo?.emailAddress
    });

    res.json(response);
  } catch (error) {
    console.error('❌ Status check error:', error);
    res.json({ 
      connected: false,
      driveAccess: false,
      error: error.message,
      tokenSource: 'error'
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

// Route to check admin Google Drive connection status from database or environment
router.get('/auth/google/admin-status', async (req, res) => {
  try {
    console.log('🔍 Admin OAuth Status Check:', {
      hasEnvTokens: !!process.env.GOOGLE_ACCESS_TOKEN,
      envTokenPreview: process.env.GOOGLE_ACCESS_TOKEN ? `${process.env.GOOGLE_ACCESS_TOKEN.substring(0, 20)}...` : 'none'
    });

    const User = require('../models/User');
    
    // Check environment tokens first (priority for production)
    const envConnected = !!(process.env.GOOGLE_ACCESS_TOKEN);
    
    if (envConnected) {
      try {
        const oauth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_OAUTH_CLIENT_ID,
          process.env.GOOGLE_OAUTH_CLIENT_SECRET
        );
        
        const envTokens = {
          access_token: process.env.GOOGLE_ACCESS_TOKEN,
          refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
          token_type: process.env.GOOGLE_TOKEN_TYPE || 'Bearer',
          expiry_date: process.env.GOOGLE_TOKEN_EXPIRY ? parseInt(process.env.GOOGLE_TOKEN_EXPIRY) : undefined
        };
        
        oauth2Client.setCredentials(envTokens);

        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        const driveResponse = await drive.about.get({ fields: 'user' });
        
        console.log('✅ Admin Google Drive connected via environment tokens:', driveResponse.data.user.emailAddress);
        
        return res.json({
          connected: true,
          driveAccess: true,
          userInfo: driveResponse.data.user,
          tokenSource: 'environment',
          adminEmail: driveResponse.data.user.emailAddress,
          tokenExpiry: envTokens.expiry_date ? new Date(envTokens.expiry_date) : null
        });
      } catch (driveError) {
        console.error('❌ Environment Google Drive tokens invalid:', driveError.message);
        // Continue to check database tokens as fallback
      }
    }
    
    // Fallback to database tokens
    const adminUser = await User.findOne({
      role: 'admin',
      $and: [
        { 'googleTokens.access_token': { $exists: true } },
        { 'googleTokens.refresh_token': { $exists: true } }
      ]
    });

    if (adminUser && adminUser.googleTokens) {
      try {
        const oauth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_OAUTH_CLIENT_ID,
          process.env.GOOGLE_OAUTH_CLIENT_SECRET
        );
        oauth2Client.setCredentials(adminUser.googleTokens);

        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        const driveResponse = await drive.about.get({ fields: 'user' });
        
        console.log('✅ Admin Google Drive connected via database tokens:', driveResponse.data.user.emailAddress);
        
        res.json({
          connected: true,
          driveAccess: true,
          userInfo: driveResponse.data.user,
          tokenSource: 'database',
          adminEmail: adminUser.email,
          tokenExpiry: adminUser.googleTokens.expiry_date ? new Date(adminUser.googleTokens.expiry_date) : null
        });
      } catch (driveError) {
        console.error('❌ Admin Google Drive database tokens invalid:', driveError.message);
        res.json({
          connected: false,
          driveAccess: false,
          error: 'Admin Google Drive tokens are invalid or expired',
          tokenSource: 'database',
          adminEmail: adminUser.email
        });
      }
    } else {
      console.log('❌ No admin Google Drive tokens found');
      res.json({
        connected: false,
        driveAccess: false,
        error: envConnected ? 
          'Environment tokens invalid and no database tokens found' : 
          'No Google Drive tokens found. Please connect Google Drive or run generate-google-tokens.js',
        tokenSource: 'none'
      });
    }
  } catch (error) {
    console.error('❌ Error checking admin Google Drive status:', error);
    res.status(500).json({
      connected: false,
      driveAccess: false,
      error: 'Failed to check admin Google Drive status',
      details: error.message
    });
  }
});

// Route to disconnect Google Drive
router.post('/auth/google/disconnect', (req, res) => {
  req.session.googleTokens = null;
  res.json({ success: true, message: 'Google Drive disconnected' });
});

module.exports = router;
