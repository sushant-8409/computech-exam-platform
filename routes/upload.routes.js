const express = require('express');
const multer = require('multer');
const { uploadToGDrive } = require('../services/oauthDrive');
const { authenticateStudent } = require('../middleware/auth');

const router = express.Router();
// Increase limits for mobile uploads (e.g., larger photos/PDFs)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB
});

router.post('/api/upload', upload.single('file'), async (req, res) => {
  const tokens = (req.session && (req.session.googleTokens || req.session.tokens));

  if (!tokens) {
  return res.status(401).json({ message: 'Not logged in with Google' });
  }

  try {
    const result = await uploadToGDrive(
      tokens,
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );
    res.json(result);
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Monitoring image upload route with authentication
router.post('/api/upload/monitoring-image', authenticateStudent, upload.single('file'), async (req, res) => {
  try {
    const { testId, studentId, timestamp, type } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Create monitoring folder structure
    const folderName = `exam-monitoring/${testId}/${studentId}`;
    const fileName = `${type}-${timestamp}.jpg`;
    
    // Upload to Google Drive
    let tokens = (req.session && (req.session.googleTokens || req.session.tokens));
    if (!tokens) {
      // Fallback to admin tokens for monitoring uploads to avoid blocking mobile
      const User = require('../models/User');
      const adminUser = await User.findOne({ role: 'admin' });
      if (adminUser && adminUser.googleTokens) {
        tokens = adminUser.googleTokens;
      } else {
        return res.status(401).json({ message: 'Not authenticated with Google Drive' });
      }
    }

    const result = await uploadToGDrive(
      tokens,
      req.file.buffer,
      `${folderName}/${fileName}`,
      'image/jpeg'
    );

    // Store monitoring record in database if needed
    // You can add database logic here to track monitoring images

    res.json({
      success: true,
      fileUrl: result.webViewLink || result.id,
      fileId: result.id,
      message: 'Monitoring image uploaded successfully'
    });

  } catch (error) {
    console.error('Monitoring image upload error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to upload monitoring image',
      error: error.message 
    });
  }
});

// Answer sheet upload route
router.post('/api/upload/answer-sheet', authenticateStudent, upload.single('file'), async (req, res) => {
  try {
    const { testId, studentId, timestamp } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Get admin's Google Drive tokens for upload
    const User = require('../models/User');
    const adminUser = await User.findOne({ role: 'admin' });
    
    if (!adminUser || !adminUser.googleTokens) {
      return res.status(401).json({ 
        success: false,
        message: 'Google Drive not connected. Please contact administrator.' 
      });
    }

    // Create answer sheet folder structure
    const folderName = `answer-sheets/${testId}`;
    const fileName = `${studentId}-${timestamp || Date.now()}.pdf`;
    
    // Upload to Google Drive using admin tokens
    const result = await uploadToGDrive(
      adminUser.googleTokens,
      req.file.buffer,
      `${folderName}/${fileName}`,
      'application/pdf'
    );

    console.log(`📄 Answer sheet uploaded successfully: ${fileName}`);

    res.json({
      success: true,
      fileUrl: result.webViewLink || result.id,
      fileId: result.id,
      message: 'Answer sheet uploaded successfully'
    });

  } catch (error) {
    console.error('Answer sheet upload error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to upload answer sheet',
      error: error.message 
    });
  }
});

module.exports = router;