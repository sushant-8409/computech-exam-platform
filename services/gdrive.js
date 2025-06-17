// services/gdrive.js
const { google } = require('googleapis');
const { Readable } = require('stream');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const SCOPES = ['https://www.googleapis.com/auth/drive'];
const KEYFILEPATH = path.resolve(__dirname, '../gdrive-credentials.json');

// 1. Load and fix credentials
const rawCredentials = JSON.parse(fs.readFileSync(KEYFILEPATH));
const credentials = {
  ...rawCredentials,
  private_key: rawCredentials.private_key
};

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: SCOPES
});

const drive = google.drive({ version: 'v3', auth });

async function uploadToGDrive(fileBuffer, fileName, mimeType) {
  try {
    const fileMetadata = {
      name: fileName,
      parents: [process.env.GOOGLE_DRIVE_FOLDER_ID]
    };

    const media = {
      mimeType,
      body: Readable.from(fileBuffer)
    };

    const { data: file } = await drive.files.create({
      resource: fileMetadata,
      media,
      fields: 'id'
    });

    await drive.permissions.create({
      fileId: file.id,
      requestBody: {
        role: 'reader',
        type: 'anyone'
      }
    });

    return {
      url: `https://drive.google.com/file/d/${file.id}/preview`,
      fileId: file.id
    };

  } catch (error) {
    console.error('Google Drive API Error:', error.message);
    if (error.code === 400) {
      throw new Error('Invalid authentication - check service account credentials');
    }
    throw error;
  }
}

module.exports = { uploadToGDrive };
