const { google } = require('googleapis');
const { Readable } = require('stream');
const path = require('path');
require('dotenv').config();

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
const KEYFILEPATH = path.join(__dirname, '../gdrive-credentials.json');

const auth = new google.auth.GoogleAuth({
  keyFile: KEYFILEPATH,
  scopes: SCOPES,
});
const drive = google.drive({ version: 'v3', auth });

async function uploadToGDrive(fileBuffer, fileName, mimeType) {
  const fileMetadata = { name: fileName };
  const media = {
    mimeType,
    body: Readable.from(fileBuffer), // <-- Fix is here
  };

  const file = await drive.files.create({
    resource: fileMetadata,
    media,
    fields: 'id',
  });

  await drive.permissions.create({
    fileId: file.data.id,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
  });

  return {
    url: `https://drive.google.com/file/d/${file.data.id}/preview`,
    fileId: file.data.id,
  };
}

module.exports = { uploadToGDrive };
