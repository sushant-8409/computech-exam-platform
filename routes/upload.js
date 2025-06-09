const express = require('express');
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path'); // FIXED: Added missing path import
const { authenticateStudent,authenticateAdmin } = require('../middleware/auth');
const { uploadToCloudflare, generateSignedUrl } = require('../services/cloudflare');
const Test = require('../models/Test');
const router = express.Router();

const storage = multer.memoryStorage();

// Create separate multer instances for different upload types
const questionPaperUpload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    console.log('📎 Question paper upload attempt:', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      uploadType: 'question-paper'
    });

    if (file.mimetype !== 'application/pdf') {
      console.log('❌ Invalid file type for question paper:', file.mimetype);
      return cb(new Error('Only PDF files are allowed for question papers'), false);
    }

    console.log('✅ Question paper file type validation passed');
    cb(null, true);
  }
});

const answerKeyUpload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    console.log('📎 Answer key upload attempt:', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      uploadType: 'answer-key'
    });

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    
    if (!allowedTypes.includes(file.mimetype)) {
      console.log('❌ Invalid file type for answer key:', file.mimetype);
      return cb(new Error(`Invalid file type. Only ${allowedTypes.join(', ')} files are allowed for answer keys`), false);
    }

    console.log('✅ Answer key file type validation passed');
    cb(null, true);
  }
});

const answerSheetUpload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    console.log('📎 Answer sheet upload attempt:', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      uploadType: 'answer-sheet'
    });

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    
    if (!allowedTypes.includes(file.mimetype)) {
      console.log('❌ Invalid file type for answer sheet:', file.mimetype);
      return cb(new Error(`Invalid file type. Only ${allowedTypes.join(', ')} files are allowed for answer sheets`), false);
    }

    console.log('✅ Answer sheet file type validation passed');
    cb(null, true);
  }
});


// Upload question paper (Admin only) with local storage fallback
router.post('/question-paper/:testId', authenticateAdmin, questionPaperUpload.single('questionPaper'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const { testId } = req.params;
    
    console.log('🔍 Looking for test:', testId);
    const test = await Test.findById(testId);
    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'Test not found'
      });
    }

    const timestamp = Date.now();
    const fileName = `question-papers/${testId}/${timestamp}-${req.file.originalname}`;

    console.log('📤 Attempting Cloudflare R2 upload...');

    try {
      // Try Cloudflare R2 first
      const uploadResult = await uploadToCloudflare(
        req.file.buffer,
        fileName,
        req.file.mimetype
      );

      if (uploadResult.success) {
        // Store the actual accessible URL
        test.questionPaperURL = uploadResult.url;
        test.questionPaperKey = uploadResult.key;
        await test.save();

        console.log('✅ Question paper uploaded to R2:', uploadResult.url);

        return res.json({
          success: true,
          message: 'Question paper uploaded successfully to Cloudflare R2',
          fileUrl: uploadResult.url,
          fileKey: uploadResult.key,
          storage: 'cloudflare',
          testId: testId
        });
      }
    } catch (r2Error) {
      console.log('⚠️ Cloudflare R2 upload failed, using local storage fallback');
      console.log('R2 Error:', r2Error.message);
    }

    // Fallback to local storage - FIXED: Now path is properly imported
    try {
      console.log('💾 Saving file locally...');
      
      // FIXED: Now path.join works because path is imported
      const uploadsDir = path.join(process.cwd(), 'uploads', 'question-papers', testId);
      await fs.mkdir(uploadsDir, { recursive: true });
      
      const localFileName = `${timestamp}-${req.file.originalname}`;
      const localPath = path.join(uploadsDir, localFileName);
      await fs.writeFile(localPath, req.file.buffer);
      
      // Generate proper accessible URL for local storage
      const accessibleUrl = `${req.protocol}://${req.get('host')}/uploads/question-papers/${testId}/${localFileName}`;
      
      test.questionPaperURL = accessibleUrl;
      test.questionPaperKey = `uploads/question-papers/${testId}/${localFileName}`;
      await test.save();
      
      console.log('✅ Question paper saved locally with URL:', accessibleUrl);
      
      res.json({
        success: true,
        message: 'Question paper uploaded successfully (local storage)',
        fileUrl: accessibleUrl,
        fileKey: test.questionPaperKey,
        storage: 'local',
        testId: testId
      });
    } catch (localError) {
      console.error('❌ Local storage failed:', localError);
      throw localError;
    }

  } catch (error) {
    console.error('❌ Question paper upload processing error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload question paper'
    });
  }
});

// Upload answer key (Admin only)
router.post('/answer-key/:testId', authenticateAdmin, answerKeyUpload.single('answerKey'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const { testId } = req.params;
    
    const test = await Test.findById(testId);
    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'Test not found'
      });
    }

    const timestamp = Date.now();
    const fileName = `answer-keys/${testId}/${timestamp}-${req.file.originalname}`;

    try {
      const uploadResult = await uploadToCloudflare(
        req.file.buffer,
        fileName,
        req.file.mimetype
      );

      if (uploadResult.success) {
        test.answerKey = {
          isUploaded: true,
          url: uploadResult.key,
          approvedForRelease: false
        };
        await test.save();

        res.json({
          success: true,
          message: 'Answer key uploaded successfully',
          fileUrl: uploadResult.url,
          fileKey: uploadResult.key
        });
      } else {
        throw new Error('Upload to Cloudflare failed');
      }
    } catch (r2Error) {
      // Local fallback for answer keys too
      console.log('⚠️ R2 failed, using local storage for answer key');
      
      const uploadsDir = path.join(process.cwd(), 'uploads', 'answer-keys', testId);
      await fs.mkdir(uploadsDir, { recursive: true });
      
      const localFileName = `${timestamp}-${req.file.originalname}`;
      const localPath = path.join(uploadsDir, localFileName);
      await fs.writeFile(localPath, req.file.buffer);
      
      const accessibleUrl = `${req.protocol}://${req.get('host')}/uploads/answer-keys/${testId}/${localFileName}`;
      
      test.answerKey = {
        isUploaded: true,
        url: accessibleUrl,
        approvedForRelease: false
      };
      await test.save();

      res.json({
        success: true,
        message: 'Answer key uploaded successfully (local storage)',
        fileUrl: accessibleUrl,
        fileKey: localPath,
        storage: 'local'
      });
    }
  } catch (error) {
    console.error('❌ Answer key upload processing error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload answer key'
    });
  }
});
router.post(
  '/answer-sheet',
  authenticateStudent,             // or your own auth middleware
  answerSheetUpload.single('answerSheet'),    // must match FormData field name
  async (req, res, next) => {
    try {
      if (!req.file?.buffer) {
        return res
          .status(400)
          .json({ success:false, message:'No file uploaded' });
      }
      // e.g. key: answersheets/<timestamp>_<originalname>
      const key = `answersheets/${Date.now()}_${req.file.originalname}`;
      const { url } = await uploadToCloudflare(
        req.file.buffer,
        key,
        req.file.mimetype
      );
      res.json({
        success: true,
        message: 'Answer sheet uploaded',
        url
      });
    } catch (err) {
      console.error('❌ Answer-sheet upload error:', err);
      next(err);
    }
  }
);
// Upload answer sheet (Student only)
router.post('/answer-sheet', authenticateStudent, answerSheetUpload.single('answerSheet'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const { testId } = req.body;
    const studentId = req.user.id;

    if (!testId) {
      return res.status(400).json({
        success: false,
        message: 'Test ID is required'
      });
    }

    const test = await Test.findById(testId);
    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'Test not found'
      });
    }

    if (test.blockedStudents.includes(studentId)) {
      return res.status(403).json({
        success: false,
        message: 'You are blocked from this test'
      });
    }

    const timestamp = Date.now();
    const fileName = `answer-sheets/${testId}/${studentId}/${timestamp}-${req.file.originalname}`;

    try {
      const uploadResult = await uploadToCloudflare(
        req.file.buffer,
        fileName,
        req.file.mimetype
      );

      if (uploadResult.success) {
        res.json({
          success: true,
          message: 'Answer sheet uploaded successfully',
          fileUrl: uploadResult.url,
          fileKey: uploadResult.key
        });
      } else {
        throw new Error('Upload to Cloudflare failed');
      }
    } catch (r2Error) {
      // Local fallback for answer sheets
      console.log('⚠️ R2 failed, using local storage for answer sheet');
      
      const uploadsDir = path.join(process.cwd(), 'uploads', 'answer-sheets', testId, studentId);
      await fs.mkdir(uploadsDir, { recursive: true });
      
      const localFileName = `${timestamp}-${req.file.originalname}`;
      const localPath = path.join(uploadsDir, localFileName);
      await fs.writeFile(localPath, req.file.buffer);
      
      const accessibleUrl = `${req.protocol}://${req.get('host')}/uploads/answer-sheets/${testId}/${studentId}/${localFileName}`;

      res.json({
        success: true,
        message: 'Answer sheet uploaded successfully (local storage)',
        fileUrl: accessibleUrl,
        fileKey: localPath,
        storage: 'local'
      });
    }
  } catch (error) {
    console.error('❌ Answer sheet upload processing error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload answer sheet'
    });
  }
});

module.exports = router;
