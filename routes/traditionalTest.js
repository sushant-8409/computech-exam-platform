const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const Test = require('../models/Test');
const Result = require('../models/Result');
const Student = require('../models/Student');
const User = require('../models/User');
const MonitoringImage = require('../models/MonitoringImage');
const { authenticateStudent } = require('../middleware/auth');
const { uploadToGDrive: uploadViaOauth } = require('../services/oauthDrive');
const { uploadToGoogleDrive } = require('../services/gdrive');
const oauthDrive = require('../services/oauthDrive');

// Configure multer for answer sheet uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Use /tmp for Vercel serverless compatibility
    const tmpDir = '/tmp';
    // Ensure directory exists (should exist in serverless environments)
    try {
      require('fs').mkdirSync(tmpDir, { recursive: true });
    } catch (error) {
      // Directory might already exist, which is fine
      if (error.code !== 'EEXIST') {
        console.warn('Warning: Could not create tmp directory:', error.message);
      }
    }
    cb(null, tmpDir);
  },
  filename: function (req, file, cb) {
    const timestamp = new Date().toISOString().replace(/[:.-]/g, '');
    const ext = path.extname(file.originalname);
    cb(null, `answer-sheet-${timestamp}-${req.body.studentId}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: function (req, file, cb) {
    // Check file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, JPG, and PNG files are allowed.'));
    }
  }
});

/**
 * Get test details for traditional test interface
 * GET /api/student/test/:testId
 */
router.get('/test/:testId', authenticateStudent, async (req, res) => {
  try {
    const { testId } = req.params;
    const studentId = req.student._id;

    // Find the test
    const test = await Test.findById(testId).lean();
    if (!test) {
      return res.status(404).json({ success: false, message: 'Test not found' });
    }

    // Check if test is active and within time bounds
    const now = new Date();
    if (!test.active) {
      return res.status(403).json({ success: false, message: 'Test is not active' });
    }

    if (test.startDate && now < new Date(test.startDate)) {
      return res.status(403).json({ success: false, message: 'Test has not started yet' });
    }

    if (test.endDate && now > new Date(test.endDate)) {
      return res.status(403).json({ success: false, message: 'Test has ended' });
    }

    // Check if student is eligible (class and board matching)
    const student = await Student.findById(studentId);
    if (test.class && test.class !== student.class) {
      return res.status(403).json({ success: false, message: 'You are not eligible for this test' });
    }

    if (test.board && test.board !== student.board) {
      return res.status(403).json({ success: false, message: 'You are not eligible for this test' });
    }

    // Check for existing result
    const existingResult = await Result.findOne({ studentId, testId }).lean();
    if (existingResult) {
      // Check if this is a resumable test
      if (existingResult.status === 'pending' && existingResult.resumeAllowed === true) {
        // Check if timer has expired
        const timeElapsed = existingResult.timeTaken || 0;
        const testDurationSeconds = (test.duration || 60) * 60;
        
        if (timeElapsed >= testDurationSeconds) {
          // Auto-submit expired test
          await Result.findByIdAndUpdate(existingResult._id, {
            status: 'pending',
            submittedAt: new Date(),
            submissionType: 'auto_submit',  // Use valid enum value
            adminComments: 'Auto-submitted due to time expiry on resume attempt'
          });
          
          return res.status(409).json({ 
            success: false, 
            message: 'Time has expired for this test. It has been automatically submitted.',
            attempted: true,
            timeExpired: true
          });
        }
        
        // Allow resume
        return res.json({ 
          success: true, 
          test,
          canResume: true,
          existingResult: {
            id: existingResult._id,
            startedAt: existingResult.startedAt,
            timeTaken: existingResult.timeTaken || 0,
            answerSheetUrl: existingResult.answerSheetUrl,
            violations: existingResult.violations || []
          }
        });
      }
      
      return res.status(409).json({ 
        success: false, 
        message: 'You have already attempted this test.',
        attempted: true 
      });
    }

    // Return test data
    res.json({ success: true, test });

  } catch (error) {
    console.error('Get traditional test error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * Get signed URL for question paper
 * GET /api/student/test/:testId/question-paper
 */
router.get('/test/:testId/question-paper', authenticateStudent, async (req, res) => {
  try {
    const { testId } = req.params;
    
    const test = await Test.findById(testId).lean();
    if (!test || !test.questionPaperURL) {
      return res.status(404).json({ success: false, message: 'Question paper not found' });
    }

    // Generate signed URL for the question paper
    try {
      // Extract file ID from Google Drive URL if needed
      let fileId = test.questionPaperURL;
      if (test.questionPaperURL.includes('drive.google.com') || test.questionPaperURL.includes('/d/')) {
        const match = test.questionPaperURL.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (match) {
          fileId = match[1];
        }
      }
      
      // Create a direct viewing URL for PDFs
      const signedUrl = `https://drive.google.com/file/d/${fileId}/preview`;
      res.json({ success: true, signedUrl });
    } catch (err) {
      console.error('Failed to get signed URL:', err);
      // Fallback to direct URL
      res.json({ success: true, signedUrl: test.questionPaperURL });
    }

  } catch (error) {
    console.error('Get question paper error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * Start a traditional test
 * POST /api/student/start-test/:testId
 */
router.post('/start-test/:testId', authenticateStudent, async (req, res) => {
  try {
    const { testId } = req.params;
    const studentId = req.student._id;

    // Check if test exists
    const test = await Test.findById(testId);
    if (!test) {
      return res.status(404).json({ success: false, message: 'Test not found' });
    }

    // Check for existing result
    const existingResult = await Result.findOne({ studentId, testId });
    if (existingResult && existingResult.status !== 'pending') {
      return res.status(409).json({ success: false, message: 'Test already started' });
    }

    // Create or update result entry
    let result;
    if (existingResult && existingResult.resumeAllowed) {
      // Resume existing test
      result = existingResult;
      result.status = 'pending';  // Use valid enum value instead of 'in_progress'
    } else {
      // Create new result
      result = new Result({
        studentId,
        testId,
        testTitle: test.title,
        testSubject: test.subject || 'General',
        submissionType: 'manual_submit',  // Use valid enum value instead of 'traditional'
        status: 'pending',  // Use valid enum value instead of 'in_progress'
        startedAt: new Date(),
        testStartTime: new Date(),
        totalMarks: test.totalMarks || 0,
        violations: [],
        suspiciousActivities: [],
        monitoringImages: []
      });
    }

    await result.save();

    res.json({ 
      success: true, 
      message: 'Test started successfully',
      resultId: result._id
    });

  } catch (error) {
    console.error('Start test error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * Upload answer sheet
 * POST /api/student/upload-answer-sheet
 */
router.post('/upload-answer-sheet', authenticateStudent, upload.single('answerSheet'), async (req, res) => {
  try {
    const { testId } = req.body;
    const studentId = req.student._id;

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    // Get admin's Google Drive tokens for upload
    const adminUser = await User.findOne({ role: 'admin' });
    
    if (!adminUser || !adminUser.googleTokens) {
      return res.status(401).json({ 
        success: false,
        message: 'Google Drive not connected. Please contact administrator.' 
      });
    }

    // Read file buffer for upload
    const fileBuffer = await fs.readFile(req.file.path);
    
    // Create answer sheet folder structure
    const fileName = `answer-sheet-${testId}-${studentId}-${Date.now()}${path.extname(req.file.originalname)}`;
    const folderPath = `answer-sheets/${testId}/${fileName}`;
    
    // Upload to Google Drive using admin tokens and OAuth service
    const result = await uploadViaOauth(
      adminUser.googleTokens,
      fileBuffer,
      folderPath,
      req.file.mimetype
    );

    const driveUrl = result.webViewLink || result.id;

    // Update result with answer sheet URL
    await Result.findOneAndUpdate(
      { studentId, testId },
      { 
        answerSheetUrl: driveUrl,
        answerSheetUploadedAt: new Date()
      }
    );

    // Clean up temporary file
    try {
      await fs.unlink(req.file.path);
    } catch (cleanupErr) {
      console.error('File cleanup error:', cleanupErr);
    }

    console.log(`📄 Answer sheet uploaded successfully: ${fileName}`);

    res.json({ 
      success: true, 
      message: 'Answer sheet uploaded successfully',
      url: driveUrl
    });

  } catch (error) {
    console.error('Upload answer sheet error:', error);
    
    // Clean up file on error
    if (req.file && req.file.path) {
      try {
        await fs.unlink(req.file.path);
      } catch (cleanupErr) {
        console.error('File cleanup error:', cleanupErr);
      }
    }
    
    res.status(500).json({ success: false, message: 'Upload failed' });
  }
});

/**
 * Upload and merge JPG images into PDF
 */
router.post('/upload-answer-images', upload.any(), async (req, res) => {
  const { testId, studentId, imageCount } = req.body;
  const files = req.files;

  if (!testId || !files || files.length === 0) {
    return res.status(400).json({ 
      success: false, 
      message: 'Test ID and image files are required' 
    });
  }

  // Filter only the answer image files (ignore other fields)
  const imageFiles = files.filter(file => file.fieldname.startsWith('answerImage_'));
  
  if (imageFiles.length === 0) {
    return res.status(400).json({ 
      success: false, 
      message: 'No image files found' 
    });
  }

  // Validate file types
  const invalidFiles = imageFiles.filter(file => !file.mimetype.startsWith('image/jpeg'));
  if (invalidFiles.length > 0) {
    return res.status(400).json({ 
      success: false, 
      message: 'Only JPG/JPEG files are allowed' 
    });
  }

  try {
    const PDFDocument = require('pdfkit');
    const sharp = require('sharp');
    const fs = require('fs');
    const path = require('path');
    
    // Create PDF document
    const doc = new PDFDocument({ autoFirstPage: false });
    const chunks = [];
    
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => {
      // PDF creation completed
    });

    // Sort files by their fieldname to ensure correct page order
    imageFiles.sort((a, b) => {
      const aIndex = parseInt(a.fieldname.split('_')[1]);
      const bIndex = parseInt(b.fieldname.split('_')[1]);
      return aIndex - bIndex;
    });

    // Process each image
    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i];
      
      console.log(`Processing image ${i + 1}/${imageFiles.length}: ${file.originalname}`);
      
      // Read image from file path (since we're using diskStorage)
      const imageBuffer = fs.readFileSync(file.path);
      
      // Optimize image with sharp
      const optimizedImage = await sharp(imageBuffer)
        .jpeg({ quality: 85 })
        .resize(1200, null, { 
          withoutEnlargement: true,
          fit: 'inside'
        })
        .toBuffer();

      // Get image dimensions for PDF sizing
      const metadata = await sharp(optimizedImage).metadata();
      const { width, height } = metadata;
      
      // Calculate page size (A4 max with aspect ratio preserved)
      const maxWidth = 595.28; // A4 width in points
      const maxHeight = 841.89; // A4 height in points
      
      let pageWidth = width * 0.75; // Convert px to points (72 DPI)
      let pageHeight = height * 0.75;
      
      if (pageWidth > maxWidth) {
        const ratio = maxWidth / pageWidth;
        pageWidth = maxWidth;
        pageHeight = pageHeight * ratio;
      }
      
      if (pageHeight > maxHeight) {
        const ratio = maxHeight / pageHeight;
        pageHeight = maxHeight;
        pageWidth = pageWidth * ratio;
      }

      // Add page to PDF
      doc.addPage({
        size: [pageWidth, pageHeight],
        margin: 0
      });
      
      doc.image(optimizedImage, 0, 0, {
        width: pageWidth,
        height: pageHeight
      });
      
      console.log(`Added page ${i + 1} to PDF (${Math.round(pageWidth)}x${Math.round(pageHeight)})`);
    }

    doc.end();

    // Wait for PDF to be created
    await new Promise((resolve) => {
      doc.on('end', resolve);
    });

    const pdfBuffer = Buffer.concat(chunks);
    
    console.log(`PDF created successfully: ${pdfBuffer.length} bytes`);
    
    // Create filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `answer-sheet-${testId}-${timestamp}.pdf`;
    
    // Get admin's Google Drive tokens for upload
    let adminUser = null;
    try {
      adminUser = await User.findOne({ 
        role: 'admin', 
        googleConnected: true,
        $or: [
          { 'googleTokens.access_token': { $exists: true } },
          { 'googleTokens.refresh_token': { $exists: true } }
        ]
      });
      
      if (adminUser && adminUser.googleTokens) {
        adminAccessToken = adminUser.googleTokens.access_token;
        adminRefreshToken = adminUser.googleTokens.refresh_token;
        console.log('📋 Found admin Google Drive tokens');
        
        // Set environment variables temporarily for gdrive service to use
        if (adminRefreshToken) {
          process.env.GOOGLE_REFRESH_TOKEN = adminRefreshToken;
          console.log('🔄 Set admin refresh token in environment');
        }
        if (adminAccessToken) {
          process.env.GOOGLE_ACCESS_TOKEN = adminAccessToken;
          console.log('� Set admin access token in environment');
        }
      } else {
        console.log('⚠️ No admin Google Drive tokens found');
      }
    } catch (error) {
      console.error('❌ Error fetching admin Google Drive tokens:', error);
    }
    
    // Upload to Google Drive using admin tokens and oauthDrive service
    const uploadResult = await uploadViaOauth(
      adminUser.googleTokens,
      pdfBuffer,
      filename,
      'application/pdf'
    );

    if (uploadResult && uploadResult.fileId) {
      console.log(`PDF uploaded successfully to Google Drive: ${uploadResult.fileId}`);
      
      res.json({
        success: true,
        fileId: uploadResult.fileId,
        fileName: filename,
        message: `Successfully merged ${imageFiles.length} images into PDF and uploaded`,
        pageCount: imageFiles.length,
        url: uploadResult.viewUrl,
        viewUrl: uploadResult.viewUrl // Keep both for compatibility
      });
    } else {
      throw new Error('Upload to Google Drive failed - no file ID returned');
    }

  } catch (error) {
    console.error('PDF creation error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create PDF from images: ' + error.message
    });
  } finally {
    // Clean up uploaded files
    if (files) {
      files.forEach(file => {
        if (file.path) {
          try {
            // Check if file exists before trying to delete
            if (require('fs').existsSync(file.path)) {
              require('fs').unlinkSync(file.path);
              console.log(`Cleaned up file: ${file.path}`);
            } else {
              console.log(`File already cleaned up: ${file.path}`);
            }
          } catch (cleanupErr) {
            console.error('File cleanup error:', cleanupErr);
          }
        }
      });
    }
  }
});

/**
 * Submit traditional test
 * POST /api/student/submit-traditional-test
 */
router.post('/submit-traditional-test', authenticateStudent, async (req, res) => {
  try {
    console.log('📝 Traditional test submission received:', { 
      studentId: req.student?._id, 
      testId: req.body.testId,
      hasAnswerSheet: !!req.body.answerSheetUrl 
    });
    
    const {
      testId,
      answerSheetUrl,
      violations = [],
      suspiciousActivities = [],
      monitoringImages = [],
      timeTaken = 0,
      browserInfo = {},
      autoSubmit = false,
      autoSubmitReason = '',
      submissionType = 'manual_submit',  // Use valid enum value
      startedAt,
      submittedAt
    } = req.body;

    const studentId = req.student._id;

    // Find the test
    const test = await Test.findById(testId);
    if (!test) {
      return res.status(404).json({ success: false, message: 'Test not found' });
    }

    // Find the result
    const result = await Result.findOne({ studentId, testId });
    if (!result) {
      return res.status(404).json({ success: false, message: 'Test result not found' });
    }

    // Check if already submitted
    if (result.status === 'pending' || result.status === 'done') {
      return res.status(409).json({ success: false, message: 'Test already submitted' });
    }

    // Validate required fields for traditional tests
    if (test.paperSubmissionRequired && !answerSheetUrl && !result.answerSheetUrl) {
      return res.status(400).json({ success: false, message: 'Answer sheet is required for this test' });
    }

    // Calculate percentage and grade
    const percentage = 0; // Traditional tests don't have auto-calculated scores
    let grade = 'Pending';

    // Update result
    result.status = 'pending'; // Will be reviewed by admin
    // Process violations to ensure details are strings
    const processedViolations = violations.map(violation => ({
      ...violation,
      details: typeof violation.details === 'object' 
        ? JSON.stringify(violation.details) 
        : violation.details || ''
    }));

    result.submissionType = submissionType;
    result.submittedAt = submittedAt || new Date();
    result.testEndTime = submittedAt || new Date();
    result.timeTaken = timeTaken;
    result.percentage = percentage;
    result.grade = grade;
    result.violations = processedViolations;
    result.suspiciousActivities = suspiciousActivities;
    result.monitoringImages = monitoringImages;
    result.browserInfo = browserInfo;
    result.autoSubmit = autoSubmit;
    result.autoSubmitReason = autoSubmitReason;
    
    // Update answer sheet URL if provided
    if (answerSheetUrl) {
      result.answerSheetUrl = answerSheetUrl;
    }

    await result.save();

    console.log('✅ Traditional test submitted successfully:', { 
      resultId: result._id, 
      status: result.status 
    });
    
    res.json({ 
      success: true, 
      message: 'Test submitted successfully',
      resultId: result._id,
      result: {
        id: result._id,
        status: result.status,
        percentage: result.percentage,
        grade: result.grade,
        submittedAt: result.submittedAt
      }
    });

  } catch (error) {
    console.error('❌ Submit traditional test error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Submission failed',
      error: error.message 
    });
  }
});

/**
 * Exit test (save progress and mark as exited)
 * POST /api/student/exit-test/:testId
 */
router.post('/exit-test/:testId', authenticateStudent, async (req, res) => {
  try {
    console.log('📤 Exit test request received:', { 
      testId: req.params.testId, 
      studentId: req.student?._id 
    });
    
    const { testId } = req.params;
    const {
      violations = [],
      answerSheetUrl,
      timeTaken = 0,
      monitoringImages = []
    } = req.body;
    
    console.log('📊 Exit test data received:', {
      violationsCount: violations.length,
      monitoringImagesCount: monitoringImages.length,
      timeTaken,
      hasAnswerSheet: !!answerSheetUrl
    });

    const studentId = req.student._id;

    // Find the result
    const result = await Result.findOne({ studentId, testId });
    if (!result) {
      return res.status(404).json({ success: false, message: 'Test result not found' });
    }

    // Process violations to ensure details are strings
    const processedViolations = violations.map(violation => ({
      ...violation,
      details: typeof violation.details === 'object' 
        ? JSON.stringify(violation.details) 
        : violation.details || ''
    }));

    // Process and upload monitoring images to Google Drive
    const processedMonitoringImages = [];
    if (monitoringImages && monitoringImages.length > 0) {
      console.log('🖼️ Processing monitoring images:', { count: monitoringImages.length });
      
      for (const image of monitoringImages) {
        try {
          // Convert base64 to buffer if needed
          let imageBuffer;
          if (image.imageData && image.imageData.startsWith('data:image/')) {
            const base64Data = image.imageData.replace(/^data:image\/\w+;base64,/, '');
            imageBuffer = Buffer.from(base64Data, 'base64');
          } else if (image.data) {
            imageBuffer = Buffer.from(image.data, 'base64');
          } else {
            console.warn('⚠️ Skipping monitoring image without data:', image.timestamp);
            continue;
          }

          // Upload to Google Drive using token prioritization
          const timestamp = new Date(image.timestamp).toISOString().replace(/[:.]/g, '-');
          const filename = `monitoring-${studentId}-${testId}-${timestamp}.jpg`;
          
          const uploadResult = await oauthDrive.uploadToGDrive(imageBuffer, filename, 'image/jpeg');
          const fileId = uploadResult.fileId;
          console.log('� Uploaded monitoring image to Google Drive:', { filename, fileId });

          // Save to MongoDB
          const monitoringDoc = new MonitoringImage({
            studentId,
            testId,
            timestamp: new Date(image.timestamp),
            purpose: image.type || 'monitoring',
            driveFileId: fileId,
            fileName: filename,
            webViewLink: `https://drive.google.com/file/d/${fileId}/view`,
            webContentLink: `https://drive.google.com/uc?id=${fileId}`,
            directLink: `https://drive.google.com/file/d/${fileId}/preview`
          });
          
          await monitoringDoc.save();
          console.log('💾 Saved monitoring image to MongoDB:', monitoringDoc._id);

          // Add to processed array for result
          processedMonitoringImages.push({
            timestamp: image.timestamp,
            purpose: image.type || 'monitoring',
            driveFileId: fileId,
            fileName: filename,
            monitoringImageId: monitoringDoc._id
          });

        } catch (uploadError) {
          console.error('❌ Failed to upload monitoring image:', uploadError);
          // Continue with other images even if one fails
        }
      }
    }

    console.log('🖼️ Processing monitoring images:', {
      originalCount: monitoringImages.length,
      uploadedCount: processedMonitoringImages.length,
      uploadedToGoogleDrive: true
    });

    // Update result with exit status
    result.status = 'pending'; // Use valid enum value instead of 'exited'
    result.timeTaken = timeTaken;
    result.violations = processedViolations;
    result.monitoringImages = processedMonitoringImages;
    result.exitedAt = new Date();
    result.resumeAllowed = false; // Admin can enable this later
    
    if (answerSheetUrl) {
      result.answerSheetUrl = answerSheetUrl;
    }

    await result.save();

    console.log('✅ Test exited successfully:', { 
      resultId: result._id, 
      status: result.status 
    });

    res.json({ 
      success: true, 
      message: 'Test exited successfully',
      resultId: result._id
    });

  } catch (error) {
    console.error('❌ Exit test error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Exit failed',
      error: error.message 
    });
  }
});

/**
 * Save test progress (for auto-save functionality)
 * POST /api/student/save-progress/:testId
 */
router.post('/save-progress/:testId', authenticateStudent, async (req, res) => {
  try {
    const { testId } = req.params;
    const {
      timeTaken = 0,
      violations = [],
      answerSheetUrl,
      lastActivity
    } = req.body;

    const studentId = req.student._id;

    // Process violations to ensure details are strings
    const processedViolations = violations.map(violation => ({
      ...violation,
      details: typeof violation.details === 'object' 
        ? JSON.stringify(violation.details) 
        : violation.details || ''
    }));

    // Update result with progress
    const result = await Result.findOneAndUpdate(
      { studentId, testId },
      {
        timeTaken,
        violations: processedViolations,
        lastActivity: lastActivity || new Date(),
        ...(answerSheetUrl && { answerSheetUrl })
      },
      { new: true }
    );

    if (!result) {
      return res.status(404).json({ success: false, message: 'Test result not found' });
    }

    res.json({ 
      success: true, 
      message: 'Progress saved',
      timeTaken: result.timeTaken
    });

  } catch (error) {
    console.error('Save progress error:', error);
    res.status(500).json({ success: false, message: 'Failed to save progress' });
  }
});

module.exports = router;
