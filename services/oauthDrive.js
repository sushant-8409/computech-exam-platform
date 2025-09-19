const { google } = require('googleapis');
const { Readable } = require('stream');

const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

// Dynamically set redirect URI based on environment
const getRedirectUri = () => {
  if (process.env.GOOGLE_OAUTH_REDIRECT_URL) {
    return process.env.GOOGLE_OAUTH_REDIRECT_URL;
  }
  
  // Default redirect URIs for development and production
  if (process.env.NODE_ENV === 'production') {
  return 'https://auctutor.app/auth/google/callback';
  } else {
    return 'http://localhost:5000/auth/google/callback';
  }
};

const REDIRECT_URI = getRedirectUri();

console.log('🔧 OAuth Configuration:');
console.log('- CLIENT_ID:', CLIENT_ID ? 'Set' : 'Missing');
console.log('- CLIENT_SECRET:', CLIENT_SECRET ? 'Set' : 'Missing');  
console.log('- REDIRECT_URI:', REDIRECT_URI);

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

function getAuthUrl() {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('Google OAuth credentials not configured. Please set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET in your environment variables.');
  }
  
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/drive.file'],
    prompt: 'consent',
  });
  
  console.log('🔗 Generated Google OAuth URL:', authUrl);
  return authUrl;
}

async function getTokens(code) {
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

async function uploadToGDrive(tokens, fileBuffer, fileName, mimeType) {
  console.log('📁 Starting Google Drive upload:', {
    fileName,
    mimeType,
    bufferSize: fileBuffer.length,
    hasFolderId: !!process.env.GOOGLE_DRIVE_FOLDER_ID,
    hasEnvTokens: !!process.env.GOOGLE_ACCESS_TOKEN,
    hasSessionTokens: !!(tokens && tokens.access_token)
  });

  // Priority: Environment tokens (for production) > Session tokens (for development)
  let finalTokens = null;
  let tokenSource = 'none';

  if (process.env.GOOGLE_ACCESS_TOKEN) {
    finalTokens = {
      access_token: process.env.GOOGLE_ACCESS_TOKEN,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      token_type: process.env.GOOGLE_TOKEN_TYPE || 'Bearer',
      expiry_date: process.env.GOOGLE_TOKEN_EXPIRY ? parseInt(process.env.GOOGLE_TOKEN_EXPIRY) : null
    };
    tokenSource = 'environment';
    console.log('🔑 Using environment tokens for Google Drive upload');
  } else if (tokens && tokens.access_token) {
    finalTokens = tokens;
    tokenSource = 'session';
    console.log('🔑 Using session tokens for Google Drive upload');
  }

  if (!finalTokens || !finalTokens.access_token) {
    throw new Error('No Google Drive tokens available. Please run generate-google-tokens.js to create environment tokens or connect Google Drive in development.');
  }

  console.log(`🔐 Token source: ${tokenSource}`);
  oauth2Client.setCredentials(finalTokens);
  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  try {
    // First, verify we have access to Drive
    const aboutResponse = await drive.about.get({ fields: 'user' });
    console.log('✅ Drive access verified for:', aboutResponse.data.user.emailAddress);

    // If folder ID is specified, verify access to it
    let folderAccessible = false;
    if (process.env.GOOGLE_DRIVE_FOLDER_ID) {
      try {
        const folderCheck = await drive.files.get({
          fileId: process.env.GOOGLE_DRIVE_FOLDER_ID,
          fields: 'id, name, permissions'
        });
        console.log('✅ Folder access verified:', folderCheck.data.name);
        folderAccessible = true;
      } catch (folderError) {
        console.error('⚠️ Folder access issue:', folderError.message);
        console.log('📁 Uploading to root folder instead');
        folderAccessible = false;
      }
    }

    const fileMetadata = { 
      name: fileName
    };

    // Only add parents if folder ID is set AND accessible
    if (process.env.GOOGLE_DRIVE_FOLDER_ID && folderAccessible) {
      fileMetadata.parents = [process.env.GOOGLE_DRIVE_FOLDER_ID];
    }

    console.log('📤 Creating file with metadata:', fileMetadata);

    const { data } = await drive.files.create({
      requestBody: fileMetadata,
      media: {
        mimeType,
        body: Readable.from(fileBuffer),
      },
      fields: 'id, webViewLink, webContentLink',
    });

    console.log('📤 File created, setting permissions...');

    // Make the file publicly viewable
    try {
      await drive.permissions.create({
        fileId: data.id,
        requestBody: {
          role: 'reader',
          type: 'anyone'
        }
      });
      console.log('✅ File made publicly viewable');
    } catch (permissionError) {
      console.error('⚠️ Failed to set public permissions:', permissionError.message);
      // Continue even if permission setting fails
    }

    console.log('✅ File uploaded successfully:', {
      fileId: data.id,
      webViewLink: data.webViewLink
    });

    // Return a properly formatted embed URL
    const embedUrl = `https://drive.google.com/file/d/${data.id}/preview`;
    
    return {
      fileId: data.id,
      url: embedUrl, // Return embed URL instead of webViewLink
      viewUrl: data.webViewLink || `https://drive.google.com/file/d/${data.id}/view`,
    };

  } catch (error) {
    console.error('❌ Google Drive upload failed:', {
      message: error.message,
      code: error.code,
      status: error.status,
      details: error.errors
    });
    throw new Error(`Google Drive upload failed: ${error.message}`);
  }
}

module.exports = {
  uploadToGDrive,
  getAuthUrl,
  getTokens
};
