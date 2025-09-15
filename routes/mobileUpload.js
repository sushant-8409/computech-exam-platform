const express = require('express');
const router = express.Router();
const MobileUploadRequest = require('../models/MobileUploadRequest');
const emailService = require('../services/emailService');
const { authenticateStudent, authenticateAdmin } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const gdriveService = require('../services/gdrive');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../tmp');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `mobile-upload-${uniqueSuffix}-${sanitizedName}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = req.uploadRequest?.uploadContext?.allowedTypes || ['pdf', 'jpg', 'jpeg', 'png'];
  const fileExtension = path.extname(file.originalname).toLowerCase().substring(1);
  
  if (allowedTypes.includes(fileExtension)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${fileExtension} not allowed. Allowed types: ${allowedTypes.join(', ')}`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1 // Single file upload
  }
});

// Middleware to validate upload token
const validateUploadToken = async (req, res, next) => {
  try {
    const { token } = req.params;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Upload token is required'
      });
    }
    
    const uploadRequest = await MobileUploadRequest.findByToken(token);
    
    if (!uploadRequest) {
      return res.status(404).json({
        success: false,
        error: 'Invalid or expired upload link',
        expired: true
      });
    }
    
    if (uploadRequest.isExpired()) {
      uploadRequest.status = 'expired';
      await uploadRequest.save();
      
      return res.status(410).json({
        success: false,
        error: 'Upload link has expired',
        expired: true
      });
    }
    
    req.uploadRequest = uploadRequest;
    next();
  } catch (error) {
    console.error('Error validating upload token:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate upload token'
    });
  }
};

// POST /api/mobile-upload/request - Create mobile upload request
router.post('/request', authenticateStudent, async (req, res) => {
  try {
    const {
      email: emailFromBody,
      testId,
      uploadType = 'test-paper',
      uploadContext = {},
      validityMinutes = 10
    } = req.body;

    // Use authenticated student's email if not provided in body
    const email = emailFromBody || req.user?.email;

    // Validate required fields
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }
    
    // Validate validity minutes (1-60 minutes)
    if (validityMinutes < 1 || validityMinutes > 60) {
      return res.status(400).json({
        success: false,
        error: 'Validity must be between 1 and 60 minutes'
      });
    }
    
    // Create upload request
    const uploadRequest = await MobileUploadRequest.createUploadRequest({
      userId: req.user.id,
      email,
      testId,
      uploadType,
      uploadContext: {
        testName: uploadContext.testName || 'Document Upload',
        subject: uploadContext.subject || 'General',
        instructions: uploadContext.instructions || 'Please upload your document using the mobile interface.',
        maxFiles: 1,
        allowedTypes: uploadContext.allowedTypes || ['pdf', 'jpg', 'jpeg', 'png'],
        ...uploadContext
      },
      validityMinutes
    });
    
    // Send email with upload link
    const emailResult = await emailService.sendMobileUploadLink({
      to: email,
      uploadRequest,
      requesterName: req.user.name || 'Admin'
    });
    
    if (emailResult.success) {
      uploadRequest.emailSent = true;
      uploadRequest.emailSentAt = new Date();
      await uploadRequest.save();
    }
    
    res.json({
      success: true,
      message: 'Mobile upload link sent successfully',
      data: {
        requestId: uploadRequest._id,
        token: uploadRequest.token,
        uploadUrl: uploadRequest.uploadUrl,
        expiresAt: uploadRequest.expiresAt,
        timeRemaining: uploadRequest.timeRemaining,
        emailSent: emailResult.success,
        uploadContext: uploadRequest.uploadContext
      }
    });
    
  } catch (error) {
    console.error('Error creating mobile upload request:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create mobile upload request'
    });
  }
});

// GET /api/mobile-upload/info/:token - Get upload request info
router.get('/info/:token', validateUploadToken, async (req, res) => {
  try {
    const uploadRequest = req.uploadRequest;
    
    // Record access
    const userAgent = req.get('User-Agent') || '';
    const ipAddress = req.ip || req.connection.remoteAddress;
    await uploadRequest.markAccessed(userAgent, ipAddress);
    
    res.json({
      success: true,
      data: {
        requestId: uploadRequest._id,
        uploadType: uploadRequest.uploadType,
        uploadContext: uploadRequest.uploadContext,
        status: uploadRequest.status,
        timeRemaining: uploadRequest.timeRemaining,
        accessInfo: uploadRequest.accessInfo,
        uploadedFiles: uploadRequest.uploadedFiles,
        analytics: uploadRequest.analytics,
        user: {
          name: uploadRequest.userId?.name || 'User'
        }
      }
    });
    
  } catch (error) {
    console.error('Error getting upload info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get upload information'
    });
  }
});

// POST /api/mobile-upload/upload/:token - Upload file via mobile
router.post('/upload/:token', validateUploadToken, (req, res) => {
  const uploadRequest = req.uploadRequest;
  
  // Check if already uploaded
  if (uploadRequest.status === 'uploaded') {
    return res.status(400).json({
      success: false,
      error: 'File has already been uploaded for this request'
    });
  }
  
  // Use multer with the upload request context
  req.uploadRequest = uploadRequest;
  
  upload.single('file')(req, res, async (err) => {
    try {
      // Record upload attempt
      await uploadRequest.recordUploadAttempt();
      
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
              success: false,
              error: 'File too large. Maximum size is 10MB.'
            });
          }
          if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
              success: false,
              error: 'Too many files. Only one file allowed.'
            });
          }
        }
        
        return res.status(400).json({
          success: false,
          error: err.message || 'File upload failed'
        });
      }
      
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded'
        });
      }
      
      // Upload to Google Drive
      const driveResult = await gdriveService.uploadFile({
        filePath: req.file.path,
        fileName: req.file.originalname,
        mimeType: req.file.mimetype,
        folderId: process.env.GOOGLE_DRIVE_MOBILE_UPLOADS_FOLDER_ID || null
      });
      
      if (!driveResult.success) {
        // Clean up local file
        try {
          await fs.unlink(req.file.path);
        } catch (cleanupError) {
          console.error('Error cleaning up file:', cleanupError);
        }
        
        return res.status(500).json({
          success: false,
          error: 'Failed to upload file to cloud storage'
        });
      }
      
      // Record successful upload
      await uploadRequest.recordSuccessfulUpload({
        filename: req.file.filename,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        driveFileId: driveResult.fileId
      });
      
      // Clean up local file
      try {
        await fs.unlink(req.file.path);
      } catch (cleanupError) {
        console.error('Error cleaning up local file:', cleanupError);
      }
      
      // Send notification email to requester
      try {
        await emailService.sendMobileUploadNotification({
          to: uploadRequest.userId.email,
          uploaderEmail: uploadRequest.email,
          uploadRequest,
          fileName: req.file.originalname,
          fileSize: req.file.size
        });
      } catch (emailError) {
        console.error('Error sending notification email:', emailError);
        // Don't fail the upload if email fails
      }
      
      res.json({
        success: true,
        message: 'File uploaded successfully',
        data: {
          fileName: req.file.originalname,
          fileSize: req.file.size,
          uploadedAt: new Date(),
          driveFileId: driveResult.fileId,
          driveUrl: driveResult.webViewLink,
          status: uploadRequest.status,
          analytics: uploadRequest.analytics
        }
      });
      
    } catch (error) {
      console.error('Error processing mobile upload:', error);
      
      // Clean up file if it exists
      if (req.file?.path) {
        try {
          await fs.unlink(req.file.path);
        } catch (cleanupError) {
          console.error('Error cleaning up file:', cleanupError);
        }
      }
      
      res.status(500).json({
        success: false,
        error: 'Failed to process file upload'
      });
    }
  });
});

// GET /api/mobile-upload/status/:token - Get upload status
router.get('/status/:token', validateUploadToken, async (req, res) => {
  try {
    const uploadRequest = req.uploadRequest;
    
    res.json({
      success: true,
      data: {
        status: uploadRequest.status,
        timeRemaining: uploadRequest.timeRemaining,
        uploadedFiles: uploadRequest.uploadedFiles,
        analytics: uploadRequest.analytics
      }
    });
    
  } catch (error) {
    console.error('Error getting upload status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get upload status'
    });
  }
});

// DELETE /api/mobile-upload/cancel/:token - Cancel upload request
router.delete('/cancel/:token', validateUploadToken, async (req, res) => {
  try {
    const uploadRequest = req.uploadRequest;
    
    if (uploadRequest.status === 'uploaded') {
      return res.status(400).json({
        success: false,
        error: 'Cannot cancel - file has already been uploaded'
      });
    }
    
    uploadRequest.status = 'cancelled';
    await uploadRequest.save();
    
    res.json({
      success: true,
      message: 'Upload request cancelled successfully'
    });
    
  } catch (error) {
    console.error('Error cancelling upload request:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel upload request'
    });
  }
});

// GET /api/mobile-upload/my-requests - Get user's upload requests (admin)
router.get('/my-requests', authenticateStudent, async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    
    // Handle admin users who have string ID 'admin' instead of ObjectId
    let query;
    if (req.user.role === 'admin') {
      // For admin users, show all requests or filter by status only
      query = status ? { status } : {};
    } else {
      // For regular users, filter by their ObjectId
      query = { userId: req.user.id };
      if (status) {
        query.status = status;
      }
    }
    
    const uploadRequests = await MobileUploadRequest.find(query)
      .populate('testId', 'title subject')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();
    
    const total = await MobileUploadRequest.countDocuments(query);
    
    res.json({
      success: true,
      data: uploadRequests,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
    
  } catch (error) {
    console.error('Error getting upload requests:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get upload requests'
    });
  }
});

// Error handling middleware
router.use((error, req, res, next) => {
  console.error('Mobile upload route error:', error);
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File too large. Maximum size is 10MB.'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: 'Too many files. Only one file allowed.'
      });
    }
  }
  
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

module.exports = router;