const express = require('express');
const jwt = require('jsonwebtoken');
const { google } = require('googleapis');
const User = require('../models/User');
const Student = require('../models/Student');
const router = express.Router();

// Helper function to get redirect URI
const getRedirectUri = () => {
  return process.env.NODE_ENV === 'production'
    ? 'https://computech-exam-platform.onrender.com/auth/google/callback'
    : 'http://localhost:5000/auth/google/callback';
};

// Helper function to create OAuth client
const createOAuthClient = () => {
  return new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    getRedirectUri()
  );
};

// Add student Google Drive status route
router.get('/api/student/google-drive-status', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ connected: false, error: 'No authentication token' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log(`📋 Checking Google Drive status for user: ${decoded.email}`);

    // Always check admin's Google Drive connection status 
    // since all uploads go to admin's drive
    const adminUser = await User.findOne({ role: 'admin' });
    
    if (!adminUser) {
      return res.status(404).json({ connected: false, error: 'Admin user not found' });
    }

    const isConnected = !!(adminUser.googleTokens && adminUser.googleConnected);
    console.log(`✅ Admin Google Drive status:`, { adminEmail: adminUser.email, connected: isConnected });

    res.json({ 
      connected: isConnected,
      message: isConnected ? 'Google Drive connected (Admin)' : 'Google Drive not connected. Admin needs to connect Google Drive.'
    });

  } catch (error) {
    console.error('❌ Google Drive status error:', error);
    res.status(500).json({ 
      connected: false, 
      error: error.message 
    });
  }
});

// Google OAuth initiation route
router.get('/auth/google', (req, res) => {
  console.log('🔗 OAuth route hit - Starting Google authorization...');
  
  try {
    // Validate environment variables
    if (!process.env.GOOGLE_OAUTH_CLIENT_ID || !process.env.GOOGLE_OAUTH_CLIENT_SECRET) {
      throw new Error('Missing Google OAuth credentials in environment variables');
    }
    
    // Get user information from token
    let userInfo = null;
    try {
      let token = req.header('Authorization')?.replace('Bearer ', '');
      
      // Check query parameter for popup windows
      if (!token && req.query.token) {
        token = req.query.token;
        console.log('📋 Token found in query parameter');
      }
      
      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userInfo = {
          id: decoded.id,
          role: decoded.role || 'student',
          email: decoded.email
        };
        console.log('👤 OAuth initiated by user:', userInfo);
      }
    } catch (authError) {
      console.log('⚠️ Could not decode token:', authError.message);
    }

    const oauth2Client = createOAuthClient();
    console.log('🔄 Using redirect URI:', getRedirectUri());
    
    // Create state to track user
    const state = userInfo ? Buffer.from(JSON.stringify(userInfo)).toString('base64') : 'anonymous';
    
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email'
      ],
      prompt: 'consent',
      state: state
    });
    
    console.log('✅ Generated OAuth URL, redirecting...');
    res.redirect(authUrl);
    
  } catch (error) {
    console.error('❌ OAuth error:', error);
    
    // For popup requests, send HTML response
    if (req.query.token) {
      res.send(`
        <script>
          if (window.opener) {
            window.opener.postMessage({ 
              type: 'OAUTH_ERROR', 
              error: '${error.message}' 
            }, '*');
            window.close();
          }
        </script>
      `);
    } else {
      res.status(500).json({
        error: 'OAuth configuration error',
        message: error.message
      });
    }
  }
});

// Google OAuth callback route
router.get('/auth/google/callback', async (req, res) => {
  console.log('🔄 OAuth callback hit!');
  
  const { code, state, error } = req.query;
  
  if (error) {
    console.error('❌ OAuth error from Google:', error);
    return res.send(`
      <script>
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
  }
  
  if (!code) {
    console.error('❌ Missing authorization code');
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
  }

  try {
    console.log('📥 Processing OAuth callback...');
    
    // Exchange code for tokens
    const oauth2Client = createOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);
    console.log('✅ Tokens received from Google');
    
    // Decode state to identify user
    let userInfo = null;
    if (state && state !== 'anonymous') {
      try {
        userInfo = JSON.parse(Buffer.from(state, 'base64').toString());
        console.log('👤 OAuth completed by user:', userInfo);
      } catch (stateError) {
        console.error('❌ Failed to decode OAuth state:', stateError);
      }
    }
    
    // Save tokens to admin user (for centralized file management)
    // Always save to admin regardless of who initiated OAuth
    console.log('🔍 Looking for admin user to save tokens...');
    const adminUser = await User.findOne({ role: 'admin' });
    console.log('👤 Admin user found:', adminUser ? { id: adminUser._id, email: adminUser.email } : 'None');
    
    if (adminUser) {
      await User.findByIdAndUpdate(adminUser._id, {
        googleTokens: tokens,
        googleConnected: true
      });
      console.log('✅ Tokens saved to admin user for centralized drive:', adminUser.email);
      
      // Verify the tokens were saved
      const updatedAdmin = await User.findById(adminUser._id);
      console.log('🔐 Tokens verification:', { 
        hasTokens: !!updatedAdmin.googleTokens, 
        isConnected: updatedAdmin.googleConnected 
      });
      
      // Create/verify Google Drive folder for file storage
      if (process.env.GOOGLE_DRIVE_FOLDER_ID) {
        try {
          const oauth2Client = createOAuthClient();
          oauth2Client.setCredentials(tokens);
          const drive = google.drive({ version: 'v3', auth: oauth2Client });
          
          // Check if the folder exists
          const folderCheck = await drive.files.get({
            fileId: process.env.GOOGLE_DRIVE_FOLDER_ID,
            fields: 'id, name'
          });
          console.log('✅ Google Drive folder verified:', folderCheck.data.name);
        } catch (folderError) {
          console.log('📁 Creating new Google Drive folder for uploads...');
          try {
            const oauth2Client = createOAuthClient();
            oauth2Client.setCredentials(tokens);
            const drive = google.drive({ version: 'v3', auth: oauth2Client });
            
            const folderMetadata = {
              name: 'Computech Exam Files',
              mimeType: 'application/vnd.google-apps.folder'
            };
            
            const folder = await drive.files.create({
              requestBody: folderMetadata,
              fields: 'id'
            });
            
            console.log('✅ Created new Google Drive folder:', folder.data.id);
            console.log('⚠️ Please update GOOGLE_DRIVE_FOLDER_ID in .env to:', folder.data.id);
          } catch (createError) {
            console.error('❌ Failed to create Google Drive folder:', createError.message);
          }
        }
      }
    } else {
      console.error('❌ No admin user found to save Google tokens');
      return res.send(`
        <script>
          if (window.opener) {
            window.opener.postMessage({ 
              type: 'OAUTH_ERROR', 
              error: 'No admin user found. Please create an admin account first.' 
            }, '*');
            window.close();
          } else {
            alert('No admin user found. Please create an admin account first.');
            window.location.href = '/';
          }
        </script>
      `);
    }
    
    // Send success response for popup
    console.log('✅ OAuth success - sending success page');
    res.send(`
      <html>
        <head>
          <title>Google Drive Connected</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f8f9fa; }
            .success { color: #10b981; font-size: 24px; margin-bottom: 20px; }
            .message { color: #666; margin: 10px 0; }
            .loading { color: #3b82f6; }
          </style>
        </head>
        <body>
          <div class="success">✅ Success!</div>
          <p>Google Drive connected successfully!</p>
          <p class="message">All file uploads will be saved to the admin's centralized Google Drive.</p>
          <p class="loading">Redirecting... This window will close automatically.</p>
          
          <script>
            console.log('🎉 OAuth success - starting parent communication');
            
            let attempts = 0;
            const maxAttempts = 10;
            
            function notifyParent() {
              attempts++;
              console.log('📡 Attempting to notify parent window (attempt', attempts, ')');
              
              if (window.opener && !window.opener.closed) {
                try {
                  window.opener.postMessage({ 
                    type: 'OAUTH_SUCCESS', 
                    timestamp: Date.now(),
                    message: 'Google Drive connected successfully!'
                  }, '*');
                  console.log('✅ Parent notified successfully');
                  
                  // Close window after successful notification
                  setTimeout(() => {
                    console.log('🔄 Closing popup window');
                    window.close();
                  }, 1500);
                  
                  return true;
                } catch (e) {
                  console.error('❌ Failed to notify parent:', e);
                }
              } else {
                console.log('⚠️ No parent window found');
              }
              
              // Retry if we haven't exceeded max attempts
              if (attempts < maxAttempts) {
                setTimeout(notifyParent, 500);
              } else {
                console.log('❌ Max attempts reached, redirecting to main page');
                window.location.href = '/';
              }
              
              return false;
            }
            
            // Start notification attempts
            notifyParent();
            
            // Fallback: close window after 10 seconds regardless
            setTimeout(() => {
              console.log('⏰ Fallback: closing window after timeout');
              if (window.opener) {
                window.close();
              } else {
                window.location.href = '/';
              }
            }, 10000);
          </script>
        </body>
      </html>
    `);
    
  } catch (err) {
    console.error('❌ OAuth callback error:', err);
    res.send(`
      <script>
        if (window.opener) {
          window.opener.postMessage({ 
            type: 'OAUTH_ERROR', 
            error: '${err.message}' 
          }, '*');
          window.close();
        }
      </script>
    `);
  }
});

// Test route
router.get('/auth/test', (req, res) => {
  res.json({ message: 'Auth routes are working!' });
});

// Debug route to check admin user status
router.get('/auth/debug/admin-status', async (req, res) => {
  try {
    const adminUser = await User.findOne({ role: 'admin' });
    if (adminUser) {
      res.json({
        adminFound: true,
        adminEmail: adminUser.email,
        hasGoogleTokens: !!adminUser.googleTokens,
        googleConnected: adminUser.googleConnected,
        tokensKeys: adminUser.googleTokens ? Object.keys(adminUser.googleTokens) : []
      });
    } else {
      res.json({
        adminFound: false,
        message: 'No admin user found in database'
      });
    }
  } catch (error) {
    res.status(500).json({
      error: error.message,
      adminFound: false
    });
  }
});

module.exports = router;
