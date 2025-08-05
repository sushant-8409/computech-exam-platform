const express = require('express');
const multer = require('multer');
const { uploadToGDrive } = require('../services/gdrive');
const { google } = require('googleapis');
const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const result = await uploadToGDrive(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    res.json({
      success: true,
      url: result.url,      // Google Drive preview link
      fileId: result.fileId
    });
  } catch (err) {
    console.error('GDrive upload error:', err);
    res.status(500).json({ success: false, message: err.message || 'Upload failed' });
  }
});

// File serving endpoint for students to access files securely
router.get('/:type/:fileKey', async (req, res) => {
  try {
    const { type, fileKey } = req.params;
    
    console.log(`📁 File request: type=${type}, fileKey=${fileKey}`);
    
    // Validate file type
    const allowedTypes = ['questionpaper', 'answerkey', 'answersheet'];
    if (!allowedTypes.includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid file type' });
    }

    // Initialize Google Drive API
    const auth = new google.auth.GoogleAuth({
      keyFile: './gdrive-credentials.json',
      scopes: ['https://www.googleapis.com/auth/drive']
    });

    const drive = google.drive({ version: 'v3', auth });

    // Extract file ID from the URL or use it directly
    let fileId = fileKey;
    
    // If the fileKey looks like a Google Drive URL, extract the file ID
    if (fileKey.includes('drive.google.com') || fileKey.includes('/d/')) {
      const match = fileKey.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (match) {
        fileId = match[1];
      }
    }

    console.log(`🔍 Extracted file ID: ${fileId}`);

    // Get file metadata first
    const fileMetadata = await drive.files.get({
      fileId: fileId,
      fields: 'id,name,mimeType,webViewLink,webContentLink'
    });

    console.log(`📄 File metadata:`, fileMetadata.data);

    // For PDF files, create a direct viewing URL
    if (fileMetadata.data.mimeType === 'application/pdf') {
      // Create a direct embed URL for PDF viewing
      const embedUrl = `https://drive.google.com/file/d/${fileId}/preview`;
      
      res.json({
        success: true,
        url: embedUrl,
        fileName: fileMetadata.data.name,
        mimeType: fileMetadata.data.mimeType
      });
    } else {
      // For other file types, use the web view link
      res.json({
        success: true,
        url: fileMetadata.data.webViewLink,
        fileName: fileMetadata.data.name,
        mimeType: fileMetadata.data.mimeType
      });
    }

  } catch (error) {
    console.error('❌ File serving error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to serve file',
      error: error.message 
    });
  }
});

module.exports = router;
