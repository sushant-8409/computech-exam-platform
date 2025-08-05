// services/gdrive.js
const { google } = require('googleapis');
const { Readable } = require('stream');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const SCOPES = ['https://www.googleapis.com/auth/drive'];
const KEYFILEPATH = path.resolve(__dirname, '../gdrive-credentials.json');

// Get OAuth client for user delegation
const getOAuthClient = () => {
  return new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URI || 'http://localhost:5000/auth/google/callback'
  );
};

// Get service account auth (for reading only)
const getServiceAuth = () => {
  const rawCredentials = JSON.parse(fs.readFileSync(KEYFILEPATH));
  const credentials = {
    ...rawCredentials,
    private_key: rawCredentials.private_key
  };

  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'] // Only read permissions
  });
};

async function uploadToGDrive(fileBuffer, fileName, mimeType, userAccessToken = null) {
  try {
    console.log('📤 Starting Google Drive upload:', fileName);
    
    let authClient;
    
    if (userAccessToken) {
      // Use user's OAuth token
      authClient = getOAuthClient();
      authClient.setCredentials({ access_token: userAccessToken });
      console.log('🔑 Using user OAuth token for upload');
    } else {
      // Fallback: Try to get fresh OAuth token from stored refresh token
      const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
      if (refreshToken) {
        authClient = getOAuthClient();
        authClient.setCredentials({ 
          refresh_token: refreshToken,
          access_token: process.env.GOOGLE_ACCESS_TOKEN 
        });
        console.log('🔑 Using stored refresh token for upload');
      } else {
        throw new Error('No user access token provided and no refresh token available. OAuth authentication required.');
      }
    }

    const drive = google.drive({ version: 'v3', auth: authClient });

    // Create folder if it doesn't exist
    let folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!folderId) {
      folderId = await findOrCreateFolder(drive, 'Exam Platform Files');
    }

    const fileMeta = { 
      name: fileName, 
      parents: folderId ? [folderId] : undefined 
    };
    const media = { mimeType, body: Readable.from(fileBuffer) };

    console.log('⬆️ Uploading to Google Drive...');
    
    const { data: file } = await drive.files.create({
      resource: fileMeta, 
      media, 
      fields: 'id,name,webViewLink,webContentLink'
    });

    console.log('✅ Upload successful:', file.id);

    // Make the file publicly viewable
    await drive.permissions.create({
      fileId: file.id,
      requestBody: { role: 'reader', type: 'anyone' }
    });

    return {
      url: `https://drive.google.com/file/d/${file.id}/preview`,
      fileId: file.id,
      viewUrl: `https://drive.google.com/file/d/${file.id}/view`,
      downloadUrl: file.webContentLink,
      name: file.name
    };

  } catch (error) {
    console.error('❌ Google Drive upload failed:', error.message);
    
    // Provide specific error messages
    if (error.message.includes('storage quota') || error.message.includes('Service Accounts')) {
      throw new Error('Google Drive storage quota exceeded. Please authenticate with Google to use your personal storage.');
    }
    
    if (error.message.includes('OAuth') || error.message.includes('access_token')) {
      throw new Error('Authentication required. Please connect your Google account.');
    }
    
    throw error;
  }
}

// Helper function to find or create a folder
const findOrCreateFolder = async (drive, folderName) => {
  try {
    // Search for existing folder
    const response = await drive.files.list({
      q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder'`,
      fields: 'files(id, name)'
    });

    if (response.data.files.length > 0) {
      console.log('📁 Found existing folder:', response.data.files[0].id);
      return response.data.files[0].id;
    }

    // Create new folder
    const folderMetadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder'
    };

    const folder = await drive.files.create({
      resource: folderMetadata,
      fields: 'id'
    });

    console.log('📁 Created new folder:', folder.data.id);
    return folder.data.id;

  } catch (error) {
    console.error('❌ Folder operation failed:', error);
    return null; // Upload to root if folder creation fails
  }
};

// Function to get file metadata using service account (for reading)
const getFileMetadata = async (fileId) => {
  try {
    const auth = getServiceAuth();
    const drive = google.drive({ version: 'v3', auth });
    
    const response = await drive.files.get({
      fileId: fileId,
      fields: 'id,name,mimeType,webViewLink,webContentLink'
    });

    return response.data;
  } catch (error) {
    console.error('❌ Failed to get file metadata:', error);
    throw error;
  }
};

module.exports = { 
  uploadToGDrive, 
  getFileMetadata,
  getOAuthClient 
};
