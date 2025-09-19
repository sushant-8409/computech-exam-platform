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
  console.log('📤 Upload request received:', {
    hasFile: !!req.file,
    hasSessionTokens: !!(req.session?.googleTokens || req.session?.tokens),
    hasEnvTokens: !!process.env.GOOGLE_ACCESS_TOKEN,
    envTokenPreview: process.env.GOOGLE_ACCESS_TOKEN ? `${process.env.GOOGLE_ACCESS_TOKEN.substring(0, 20)}...` : 'none'
  });

  const sessionTokens = (req.session && (req.session.googleTokens || req.session.tokens));
  const hasEnvTokens = !!process.env.GOOGLE_ACCESS_TOKEN;

  if (!sessionTokens && !hasEnvTokens) {
    console.error('❌ No tokens available for upload');
    return res.status(401).json({ 
      message: 'Google Drive not connected. Please connect Google Drive or configure environment tokens.',
      suggestion: 'Run generate-google-tokens.js to create production tokens'
    });
  }

  try {
    // Prioritize environment tokens for production
    let tokensToUse = null;
    if (hasEnvTokens) {
      tokensToUse = {
        access_token: process.env.GOOGLE_ACCESS_TOKEN,
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
        token_type: process.env.GOOGLE_TOKEN_TYPE || 'Bearer',
        expiry_date: process.env.GOOGLE_TOKEN_EXPIRY ? parseInt(process.env.GOOGLE_TOKEN_EXPIRY) : undefined
      };
      console.log('📋 Using environment tokens for upload');
    } else if (sessionTokens) {
      tokensToUse = sessionTokens;
      console.log('📋 Using session tokens for upload');
    }

    const result = await uploadToGDrive(
      tokensToUse,
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );
    
    console.log('✅ Upload successful:', result.fileId);
    res.json(result);
  } catch (err) {
    console.error('❌ Upload error:', err);
    res.status(500).json({ 
      error: 'Upload failed',
      message: err.message,
      suggestion: hasEnvTokens ? 'Check Google Drive permissions and token validity' : 'Run generate-google-tokens.js to create production tokens'
    });
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
    
    // Upload to Google Drive - priority: env tokens > session tokens > admin tokens
    let tokens = null;
    let tokenSource = 'none';
    
    if (process.env.GOOGLE_ACCESS_TOKEN) {
      tokens = null; // Let oauthDrive service handle env tokens
      tokenSource = 'environment';
    } else if (req.session && (req.session.googleTokens || req.session.tokens)) {
      tokens = req.session.googleTokens || req.session.tokens;
      tokenSource = 'session';
    } else {
      // Fallback to admin tokens for monitoring uploads to avoid blocking mobile
      const User = require('../models/User');
      const adminUser = await User.findOne({ role: 'admin' });
      if (adminUser && adminUser.googleTokens) {
        tokens = adminUser.googleTokens;
        tokenSource = 'admin-database';
      } else {
        return res.status(401).json({ 
          message: 'Google Drive not connected. Please run generate-google-tokens.js or connect admin Google Drive.',
          tokenSource: 'none'
        });
      }
    }
    
    console.log(`📸 Monitoring upload using ${tokenSource} tokens`);

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
    
    console.log('📄 Answer sheet upload request:', {
      testId,
      studentId,
      hasFile: !!req.file,
      hasEnvTokens: !!process.env.GOOGLE_ACCESS_TOKEN
    });
    
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    let tokens = null;
    let tokenSource = 'none';

    // Priority 1: Use environment tokens
    if (process.env.GOOGLE_ACCESS_TOKEN) {
      tokens = {
        access_token: process.env.GOOGLE_ACCESS_TOKEN,
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
        token_type: process.env.GOOGLE_TOKEN_TYPE || 'Bearer',
        expiry_date: process.env.GOOGLE_TOKEN_EXPIRY ? parseInt(process.env.GOOGLE_TOKEN_EXPIRY) : undefined
      };
      tokenSource = 'environment';
      console.log('📋 Using environment tokens for answer sheet upload');
    } else {
      // Fallback: Get admin's Google Drive tokens from database
      const User = require('../models/User');
      const adminUser = await User.findOne({ role: 'admin' });
      
      if (adminUser && adminUser.googleTokens) {
        tokens = adminUser.googleTokens;
        tokenSource = 'admin-database';
        console.log('📋 Using admin database tokens for answer sheet upload');
      } else {
        return res.status(401).json({ 
          success: false,
          message: 'Google Drive not connected. Please run generate-google-tokens.js or contact administrator.',
          suggestion: 'Run generate-google-tokens.js to create production tokens'
        });
      }
    }

    // Create answer sheet folder structure
    const folderName = `answer-sheets/${testId}`;
    const fileName = `${studentId}-${timestamp || Date.now()}.pdf`;
    
    // Upload to Google Drive
    const result = await uploadToGDrive(
      tokens,
      req.file.buffer,
      `${folderName}/${fileName}`,
      'application/pdf'
    );

    console.log(`✅ Answer sheet uploaded successfully: ${fileName} (${tokenSource})`);

    res.json({
      success: true,
      fileUrl: result.webViewLink || result.id,
      fileId: result.id,
      message: 'Answer sheet uploaded successfully',
      tokenSource
    });

  } catch (error) {
    console.error('❌ Answer sheet upload error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to upload answer sheet',
      error: error.message,
      suggestion: 'Check Google Drive permissions or run generate-google-tokens.js'
    });
  }
});

module.exports = router;