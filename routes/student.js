const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateStudent } = require('../middleware/auth');
const Test = require('../models/Test');
const Result = require('../models/Result');
const Student = require('../models/Student');
const multer = require('multer');
const mongoose = require('mongoose');
const PushSubscription=require('../models/PushSubscription');
const notificationService = require('../services/notificationService');
// ← add this
const { uploadToGDrive } = require('../services/gdrive'); // Adjust path as needed
const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });
const moment = require('moment-timezone');
const nowIST = moment().tz('Asia/Kolkata').toDate();
const QRCode = require('qrcode');
const ReviewResult = require('../models/ReviewResult');
// Apply student authentication middleware to all routes
router.use(authenticateStudent); // This is line 11 - make sure authenticateStudent is properly exported

// ============================================
// STUDENT DASHBOARD ENDPOINTS
// ============================================
router.use(authenticateStudent);
// Get student dashboard data
// In your student routes (backend)

// Submit route
// ✅ FIXED: Exit route with proper test information handling
router.post('/test/:testId/exit', authenticateStudent, async (req, res) => {
  try {
    const { 
      violations = [], 
      autoExit = false, 
      exitReason = '', 
      timeTaken = 0,
      browserInfo = {},
      answerSheetUrl = null
    } = req.body;
    
    const student = req.student;
    const testId = req.params.testId;

    // ✅ FIXED: Fetch test information first
    const test = await Test.findById(testId).select('title subject totalMarks duration');
    if (!test) {
      return res.status(404).json({ 
        success: false, 
        message: 'Test not found' 
      });
    }

    let result = await Result.findOne({ 
      studentId: student._id, 
      testId: testId 
    });

    if (!result) {
      // ✅ FIXED: Create result with complete test information
      result = new Result({
        studentId: student._id,
        testId: testId,
        testTitle: test.title, // ✅ Set test title
        testSubject: test.subject, // ✅ Set test subject
        totalMarks: test.totalMarks, // ✅ Set total marks
        startedAt: new Date(),
        questionWiseMarks: []
      });
    }

    // ✅ Enhanced exit data recording
    result.submittedAt = new Date();
    result.violations = violations;
    result.timeTaken = timeTaken;
    result.browserInfo = browserInfo;
    result.answerSheetUrl = answerSheetUrl;
    result.status = autoExit ? 'auto_exited' : 'exited';
    // ✅ Ensure test information is set (for existing results too)
    if (!result.testTitle) result.testTitle = test.title;
    if (!result.testSubject) result.testSubject = test.subject;
    if (!result.totalMarks) result.totalMarks = test.totalMarks;
    
    if (autoExit) {
      result.autoExitReason = exitReason;
      result.adminComments = `Auto-exited due to: ${exitReason}`;
    } else {
      result.adminComments = 'Test exited by student';
    }

    await result.save();

    console.log(`✅ Test ${autoExit ? 'auto-exited' : 'exited'} successfully:`, {
      resultId: result._id,
      testId: testId,
      testTitle: result.testTitle,
      studentId: student._id
    });

    res.json({ 
      success: true, 
      message: autoExit ? 'Test auto-exited successfully' : 'Test exited successfully',
      resultId: result._id
    });

  } catch (error) {
    console.error('Exit error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to exit test' 
    });
  }
});
router.post('/test-notification', async (req, res) => {
  try {
    console.log('🧪 Test notification request for:', req.student.name);

    const student = req.student;

    // Send test notification
    const result = await notificationService.sendNotification(
      '507f1f77bcf86cd799439011', // Dummy admin ID
      'system_alert',
      '🧪 Test Notification',
      `Hello ${student.name}! This is a test notification to verify your push subscription is working correctly.`,
      {
        students: [student],
        type: 'test',
        timestamp: new Date().toISOString()
      }
    );

    console.log('✅ Test notification result:', result);

    res.json({
      success: true,
      message: 'Test notification processed',
      result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Test notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send test notification',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});
// ✅ FIXED: Submit route with proper test information
router.post('/test/:testId/submit', authenticateStudent, async (req, res) => {
  try {
    const { 
      answers, 
      answerSheetUrl, 
      violations = [], 
      autoSubmit, 
      autoSubmitReason,
      timeTaken,
      browserInfo 
    } = req.body;

    const student = req.student;
    const testId = req.params.testId;

    // ✅ FIXED: Fetch test information first
    const test = await Test.findById(testId).select('title subject totalMarks duration');
    if (!test) {
      return res.status(404).json({ 
        success: false, 
        message: 'Test not found' 
      });
    }

    // Check for existing submission to prevent duplicates
    const existingResult = await Result.findOne({ 
      studentId: student._id, 
      testId: testId,
      submittedAt: { $exists: true }
    });

    if (existingResult) {
      return res.json({ 
        success: true, 
        message: 'Test already submitted',
        resultId: existingResult._id 
      });
    }

    // Find or create result
    let result = await Result.findOne({ 
      studentId: student._id, 
      testId: testId 
    });

    if (!result) {
      // ✅ FIXED: Create result with complete test information
      result = new Result({
        studentId: student._id,
        testId: testId,
        testTitle: test.title, // ✅ Set test title
        testSubject: test.subject, // ✅ Set test subject
        totalMarks: test.totalMarks, // ✅ Set total marks
        startedAt: new Date(),
        questionWiseMarks: []
      });
    }

    // Update result with submission data
    result.submittedAt = new Date();
    result.answers = answers;
    result.answerSheetUrl = answerSheetUrl;
    result.violations = violations;
    result.browserInfo = browserInfo;
    result.timeTaken = timeTaken;
    result.status = autoSubmit ? 'auto_submitted' : 'submitted';
    
    // ✅ Ensure test information is set
    if (!result.testTitle) result.testTitle = test.title;
    if (!result.testSubject) result.testSubject = test.subject;
    if (!result.totalMarks) result.totalMarks = test.totalMarks;
    
    if (autoSubmit) {
      result.autoSubmitReason = autoSubmitReason;
      result.adminComments = `Auto-submitted due to: ${autoSubmitReason}`;
    }

    const savedResult = await result.save();

    console.log(`✅ Test ${autoSubmit ? 'auto-submitted' : 'submitted'} successfully:`, {
      resultId: savedResult._id,
      testId: testId,
      testTitle: savedResult.testTitle,
      studentId: student._id
    });

    res.json({ 
      success: true, 
      message: 'Test submitted successfully',
      resultId: savedResult._id 
    });

  } catch (error) {
    console.error('Submit error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to submit test'
    });
  }
});


router.post('/push/subscribe', async (req, res) => {
  try {
    console.log('📱 Push subscription request received');
    console.log('Student ID:', req.student._id);
    console.log('Subscription data:', req.body.subscription ? 'Present' : 'Missing');

    const { subscription } = req.body;
    const userId = req.student._id;
    const userAgent = req.headers['user-agent'] || '';

    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({
        success: false,
        message: 'Invalid subscription data',
        required: 'subscription.endpoint is required'
      });
    }

    console.log('📱 Creating push subscription for student:', req.student.name);

    const result = await notificationService.subscribeToPush(userId, subscription, userAgent);

    console.log('✅ Push subscription created:', result._id);

    res.json({
      success: true,
      message: 'Successfully subscribed to push notifications',
      subscriptionId: result._id
    });

  } catch (error) {
    console.error('❌ Push subscribe error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to subscribe to push notifications',
      error: error.message
    });
  }
});

// Unsubscribe from push notifications
router.post('/push/unsubscribe', async (req, res) => {
  try {
    console.log('📱 Push unsubscribe request received');

    const { endpoint } = req.body;
    const userId = req.student._id;

    const result = await notificationService.unsubscribeFromPush(userId, endpoint);

    console.log('✅ Push unsubscription completed');

    res.json({
      success: true,
      message: 'Successfully unsubscribed from push notifications',
      deletedCount: result.deletedCount
    });

  } catch (error) {
    console.error('❌ Push unsubscribe error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unsubscribe from push notifications',
      error: error.message
    });
  }
});

// Get push subscription status
router.get('/push/status', async (req, res) => {
  try {
    console.log('📱 Push status request received');
    console.log('Student ID:', req.student?._id);

    // Check if user exists
    if (!req.student || !req.student._id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        error: 'No student found in request'
      });
    }

    const userId = req.student._id;
    
    // Handle missing PushSubscription model
    if (!PushSubscription) {
      console.warn('⚠️ PushSubscription model not available');
      return res.json({
        success: true,
        subscribed: false,
        subscriptionCount: 0,
        subscriptions: [],
        message: 'PushSubscription model not available - please check server setup'
      });
    }

    // Query subscriptions with error handling
    let subscriptions = [];
    try {
      subscriptions = await PushSubscription.find({ 
        userId: userId, 
        active: true 
      }).lean();
      console.log(`📱 Found ${subscriptions.length} active subscriptions for user ${userId}`);
    } catch (dbError) {
      console.error('❌ Database query error:', dbError);
      return res.status(500).json({
        success: false,
        message: 'Database error while fetching subscriptions',
        error: process.env.NODE_ENV === 'development' ? dbError.message : 'Database error'
      });
    }

    // Success response
    res.json({
      success: true,
      subscribed: subscriptions.length > 0,
      subscriptionCount: subscriptions.length,
      subscriptions: subscriptions.map(sub => ({
        id: sub._id,
        endpoint: sub.subscription?.endpoint ? 
          sub.subscription.endpoint.substring(0, 50) + '...' : 
          'Unknown endpoint',
        createdAt: sub.createdAt,
        lastUsed: sub.lastUsed
      })),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Push status route error:', error);
    console.error('Error stack:', error.stack);
    
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

// ============================================
// TEST ENDPOINTS
// ============================================

// Get available tests
// routes/student.js

// ============================================
// UPDATED: Get available tests (only unattempted)
// ============================================
router.get('/tests', async (req, res) => {
  try {
    const studentId = req.user.id;
    const student = await Student.findById(studentId);
    const now = new Date();

    // ✅ 1. Get all attempted test IDs for this student
    const attemptedTestIds = await Result.distinct('testId', { studentId: studentId });
    console.log('Attempted test IDs:', attemptedTestIds);

    // Normalize class: remove "Class " prefix if present
    const rawClass = student.class || '';
    const clsValue = rawClass.replace(/^Class\s*/i, '').trim();

    // ✅ 2. Find tests that match criteria AND are not attempted
    const tests = await Test.find({
      active: true,
      board: student.board,
      startDate: { $lte: now },
      endDate: { $gte: now },
      _id: { $nin: attemptedTestIds }, // ✅ Exclude attempted tests
      blockedStudents: { $nin: [studentId] }, // ✅ Add blocked check
      $or: [
        { class: clsValue },
        { class: `Class ${clsValue}` }
      ]
    }).select('title subject class board duration totalMarks startDate endDate');

    console.log(`Found ${tests.length} unattempted tests for student ${studentId}`);

    res.json({ success: true, tests });
  } catch (error) {
    console.error('Get tests error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch tests' });
  }
});

// ============================================
// UPDATED: Student dashboard (only unattempted tests)
// ============================================
router.get('/dashboard', async (req, res) => {
  try {
    const studentId = req.user.id;
    const student = await Student.findById(studentId);

    // ✅ 1. Get all attempted test IDs for this student
    const attemptedTestIds = await Result.distinct('testId', { studentId: studentId });

    // Normalize class for proper matching
    const rawClass = student?.class || '';
    const clsValue = rawClass.replace(/^Class\s*/i, '').trim();

    const now = new Date();

    // ✅ 2. Get available tests (unattempted only)
    const availableTests = await Test.find({
      active: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
      _id: { $nin: attemptedTestIds }, // ✅ Exclude attempted tests
      blockedStudents: { $nin: [studentId] },
      board: student.board,
      $or: [
        { class: clsValue },
        { class: `Class ${clsValue}` }
      ]
    }).select('title subject class board duration totalMarks startDate endDate');

    // ✅ 3. Get upcoming tests (unattempted only)
    const upcomingTests = await Test.find({
      active: true,
      startDate: { $gt: now },
      _id: { $nin: attemptedTestIds }, // ✅ Exclude attempted tests
      blockedStudents: { $nin: [studentId] },
      board: student.board,
      $or: [
        { class: clsValue },
        { class: `Class ${clsValue}` }
      ]
    }).select('title subject class board startDate endDate').limit(5);

    // ✅ 4. Get completed results (for statistics)
    const completedResults = await Result.find({ studentId })
      .populate('testId', 'title subject')
      .sort({ submittedAt: -1 })
      .limit(10);

    // ✅ 5. Calculate statistics
    const totalTestsTaken = await Result.countDocuments({ studentId });
    const averageScore = await Result.aggregate([
      { $match: { studentId, status: { $in: ['published', 'reviewed'] } } }, // ✅ Fixed condition
      { $group: { _id: null, avg: { $avg: '$percentage' } } }
    ]);

    // ✅ 6. Additional analytics
    const totalAvailableTests = await Test.countDocuments({
      active: true,
      board: student.board,
      $or: [
        { class: clsValue },
        { class: `Class ${clsValue}` }
      ]
    });

    const unattemptedCount = totalAvailableTests - totalTestsTaken;

    res.json({
      success: true,
      data: {
        availableTests,
        completedResults,
        upcomingTests,
        statistics: {
          totalTestsTaken,
          totalAvailableTests,
          unattemptedCount,
          averageScore: averageScore[0]?.avg || 0
        }
      }
    });
  } catch (error) {
    console.error('Student dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard data'
    });
  }
});

// ============================================
// NEW: Get test attempt status
// ============================================
router.get('/test/:testId/attempt-status', async (req, res) => {
  try {
    const { testId } = req.params;
    const studentId = req.user.id;

    const result = await Result.findOne({ 
      studentId, 
      testId 
    }).select('status submittedAt startedAt');

    const isAttempted = !!result;
    const isSubmitted = result && result.submittedAt;

    res.json({
      success: true,
      isAttempted,
      isSubmitted,
      status: result?.status || null,
      submittedAt: result?.submittedAt || null,
      startedAt: result?.startedAt || null
    });
  } catch (error) {
    console.error('Get attempt status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check attempt status'
    });
  }
});

// ============================================
// ENHANCED: Get single test details (with attempt check)
// ============================================
router.get('/test/:testId', async (req, res) => {
  try {
    const { testId } = req.params;
    const studentId = req.user.id;

    // ✅ Check if test is already attempted
    const existingResult = await Result.findOne({ studentId, testId });
    if (existingResult) {
      return res.status(400).json({
        success: false,
        message: 'Test already attempted',
        attempted: true,
        resultId: existingResult._id,
        status: existingResult.status
      });
    }

    // Fetch test without correct answers
    const test = await Test.findById(testId)
      .select('-questions.correctAnswer')
      .lean();

    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'Test not found'
      });
    }

    // Validate test availability
    const now = new Date();
    if (!test.active || now < test.startDate || now > test.endDate) {
      return res.status(400).json({
        success: false,
        message: 'Test is not available'
      });
    }

    // Check student block status
    if (test.blockedStudents?.includes(studentId)) {
      return res.status(403).json({
        success: false,
        message: 'You are blocked from taking this test'
      });
    }

    // Generate signed URL for question paper (if exists)
    if (test.questionPaperURL) {
      try {
        let key = test.questionPaperURL;
        try {
          const urlObj = new URL(key);
          key = urlObj.pathname.replace(`/${process.env.B2_BUCKET}/`, '');
        } catch {
          // Already a key, do nothing
        }
        test.questionPaperURL = test.questionPaperURL || null;
      } catch (err) {
        console.error('Signed URL error:', err);
        test.questionPaperURL = null;
      }
    }

    res.json({
      success: true,
      test,
      attempted: false
    });

  } catch (error) {
    console.error('Get test error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch test'
    });
  }
});


router.get('/result/:resultId/detailed', async (req, res, next) => {
  try {
    const result = await Result.findOne({
      _id: req.params.resultId,
      studentId: req.user.id
    })
      .populate('test', 'title totalMarks questionsCount')
      .lean();
    if (!result) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }
    res.json({
      success: true,
      result,
      test: {
        title: result.test.title,
        totalMarks: result.totalMarks,
        questionsCount: result.questionWiseMarks.length
      }
    });
  } catch (err) {
    next(err);
  }
});

// 3) Submit a review request
router.post('/results/:resultId/request-review', async (req, res, next) => {
  try {
    const { resultId } = req.params;
    const { questionNumbers = [], comments = '' } = req.body;

    if (!mongoose.Types.ObjectId.isValid(resultId)) {
      return res.status(400).json({ success:false, message:'Bad id' });
    }

    /* 1. fetch original result (must belong to this student) */
    const result = await Result.findOne({
      _id: resultId,
      studentId: req.user.id
    })
    .populate('testId', 'questionPaperURL startDate endDate')  // for URLs & vis.
    .orFail(new Error('Result not found'));

    /* 2. build ReviewResult document  ----------------------- */
    const subset = result.questionWiseMarks.filter(q =>
      questionNumbers.includes(q.questionNo)
    );

    const reviewDoc = new ReviewResult({
      studentId:        result.studentId,
      testId:           result.testId,
      answerSheetUrl:   result.answerSheetUrl,
      questionPaperUrl: result.testId?.questionPaperURL || null,
      marksObtained:    result.marksObtained,
      totalMarks:       result.totalMarks,
      questionWiseMarks: subset,
      testVisibility: {
        startDate: result.testId?.startDate || new Date(),
        endDate:   result.testId?.endDate   || new Date(),
        active:    true
      },
      adminComments:    comments,
      status:           'under review'
    });

    await reviewDoc.save();

    /* 3. update original result ----------------------------- */
    result.reviewRequests ??= [];               // audit trail
    result.reviewRequests.push({
      questionNumbers,
      comments,
      requestedAt: new Date()
    });
    result.status = 'under review';

    await result.save();

    /* 4. respond */
    return res.json({ success: true, reviewResultId: reviewDoc._id });
  } catch (err) {
    console.error('Review-request error:', err.message);
    return next(err);
  }
});


// B) Endpoint to check if the student has submitted
router.get('/submission-status/:testId', async (req, res, next) => {
  try {
    const { testId } = req.params;
    const studentId = req.user.id;
    const submission = await Result.findOne({
      test: testId,
      student: studentId
    });
    res.json({
      success: true,
      submitted: !!submission,
      submittedAt: submission?.submittedAt || null
    });
  } catch (err) {
    next(err);
  }
});
// Get single test details

// 3) Exit Test early: mark submittedAt so the test cannot be restarted
// 4) Check submission/exit status
router.get(
  '/test/:testId/status',
  authenticateStudent,
  async (req, res, next) => {
    try {
      const studentId = req.user.id;
      const { testId } = req.params;
      const result = await Result.findOne({ studentId, testId });
      res.json({
        success: true,
        submitted: !!(result && result.submittedAt)
      });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/tests/:testId/refresh-pdf',
  authenticateStudent,
  async (req, res, next) => {
    try {
      const { testId } = req.params;
      // 1. Fetch only the questionPaperURL field
      const test = await Test.findById(testId)
        .select('questionPaperURL')
        .lean();

      if (!test) {
        return res
          .status(404)
          .json({ success: false, message: 'Test not found' });
      }

      if (!test.questionPaperURL) {
        return res
          .status(404)
          .json({ success: false, message: 'No question paper URL available' });
      }

      // 2. Return the stored URL directly
      return res.json({
        success: true,
        url: test.questionPaperURL
      });
    } catch (err) {
      next(err);
    }
  }
);


// Submit test
router.post(
  '/test/:testId/upload',
  upload.single('answerSheet'),
  async (req, res, next) => {
    try {
      const studentId = req.user.id;
      const { testId } = req.params;
      
      if (!req.file?.buffer) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
      }

      // 1) Upload to Google Drive
      const fileName = `answersheet_${studentId}_${testId}_${Date.now()}.pdf`;
      const { url } = await uploadToGDrive(
        req.file.buffer,
        fileName,
        req.file.mimetype
      );

      // 2) Upsert the Result doc
      const result = await Result.findOneAndUpdate(
        { studentId, testId },
        {
          $setOnInsert: {
            studentId,
            testId,
            testTitle: '',
            startedAt: new Date(),
            totalMarks: 0
          },
          $set: { answerSheetUrl: url }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      // 3) Backfill testTitle if missing
      if (!result.testTitle) {
        const test = await Test.findById(testId).select('title');
        result.testTitle = test?.title || '';
        await result.save();
      }

      res.json({ 
        success: true, 
        answerSheetUrl: url,
        fileId: result.fileId, // Added Google Drive file ID
        resultId: result._id 
      });
    } catch (err) {
      next(err);
    }
  }
);



// ============================================
// RESULTS ENDPOINTS
// =======================================

// Get student results
router.get('/results', async (req, res) => {
  try {
    const studentId = req.user.id;

    const results = await Result.find({ studentId })
      .populate('testId', 'title subject totalMarks answerKeyURL answerKeyVisible')
      .sort({ submittedAt: -1 });

    res.json({
      success: true,
      results
    });
  } catch (error) {
    console.error('Get results error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch results'
    });
  }
});

// Get detailed result with question-wise marks
router.get('/result/:resultId/detailed', async (req, res) => {
  try {
    const { resultId } = req.params;
    const studentId = req.user.id;

    const result = await Result.findOne({
      _id: resultId,
      studentId: studentId
    }).populate('testId', 'title subject answerKeyURL answerKeyVisible questionsCount');

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Result not found'
      });
    }

    res.json({
      success: true,
      result: result,
      test: result.testId
    });
  } catch (error) {
    console.error('Get detailed result error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch result details'
    });
  }
});
// Get detailed result for student
// Get single result with detailed information


router.get('/qr', async (req, res) => {
  const { data } = req.query;
  if (!data) return res.status(400).send('Missing data');
  try {
    const png = await QRCode.toBuffer(data, { width: 200 });
    res.type('png').send(png);
  } catch (err) {
    res.status(500).send('QR generation failed');
  }
});


// ============================================
// TEST RESUME ENDPOINTS
// ============================================

// Get resume data
router.get('/test/:testId/resume', async (req, res) => {
  try {
    const { testId } = req.params;
    const studentId = req.user.id;

    const test = await Test.findById(testId);
    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'Test not found'
      });
    }

    const resumeData = test.resumeData.find(data =>
      data.studentId.toString() === studentId.toString()
    );

    res.json({
      success: true,
      resumeData: resumeData || null,
      canResume: test.resumeEnabled
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get resume data'
    });
  }
});

// Save resume data
router.post('/test/:testId/resume', async (req, res) => {
  try {
    const { testId } = req.params;
    const studentId = req.user.id;
    const { timeRemaining, answers, violations, browserFingerprint } = req.body;

    const test = await Test.findById(testId);
    if (!test || !test.resumeEnabled) {
      return res.status(400).json({
        success: false,
        message: 'Resume not enabled for this test'
      });
    }

    // Update or create resume data
    const existingIndex = test.resumeData.findIndex(data =>
      data.studentId.toString() === studentId.toString()
    );

    const resumeEntry = {
      studentId,
      lastActivity: new Date(),
      timeRemaining,
      answers,
      violations,
      browserFingerprint
    };

    if (existingIndex >= 0) {
      test.resumeData[existingIndex] = resumeEntry;
    } else {
      test.resumeData.push(resumeEntry);
    }

    await test.save();

    res.json({
      success: true,
      message: 'Resume data saved'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to save resume data'
    });
  }
});




// ============================================
// RESULTS ENDPOINTS
// =======================================

// Get student results
router.get('/results', async (req, res) => {
  try {
    const studentId = req.user.id;

    const results = await Result.find({ studentId })
      .populate('testId', 'title subject totalMarks answerKeyURL answerKeyVisible')
      .sort({ submittedAt: -1 });

    res.json({
      success: true,
      results
    });
  } catch (error) {
    console.error('Get results error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch results'
    });
  }
});

// Get detailed result with question-wise marks
router.get('/result/:resultId/detailed', async (req, res) => {
  try {
    const { resultId } = req.params;
    const studentId = req.user.id;

    const result = await Result.findOne({
      _id: resultId,
      studentId: studentId
    }).populate('testId', 'title subject answerKeyURL answerKeyVisible questionsCount');

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Result not found'
      });
    }

    res.json({
      success: true,
      result: result,
      test: result.testId
    });
  } catch (error) {
    console.error('Get detailed result error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch result details'
    });
  }
});
// routes/student.js (or wherever you fetch results)
// routes/student.js - Fixed Result endpoint
// Get detailed result with Test data
// In your backend route (e.g., /api/student/result/:resultId)
// In your backend route (e.g., /api/student/result/:resultId)
router.get('/result/:resultId', async (req, res) => {
  try {
    const result = await Result.findById(req.params.resultId)
      .populate({
        path: 'test',
        select: 'title subject questionPaperURL answerKeyURL answerKeyVisible totalMarks passingMarks'
      })
      .populate({
        path: 'studentId',
        match: { _id: req.user._id },
        select: 'name email class board school' // Include class and board
      });

    if (!result || !result.studentId) {
      return res.status(404).json({
        success: false,
        message: 'Result not found or access denied'
      });
    }

    res.json({
      success: true,
      result: {
        ...result.toObject(),
        status: result.status,
        adminComments: result.adminComments
      }
    });
  } catch (error) {
    console.error('Result error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error loading result'
    });
  }
});

// ============================================
// TEST RESUME ENDPOINTS
// ============================================

// Get resume data
router.get('/test/:testId/resume', async (req, res) => {
  try {
    const { testId } = req.params;
    const studentId = req.user.id;

    const test = await Test.findById(testId);
    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'Test not found'
      });
    }

    const resumeData = test.resumeData.find(data =>
      data.studentId.toString() === studentId.toString()
    );

    res.json({
      success: true,
      resumeData: resumeData || null,
      canResume: test.resumeEnabled
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get resume data'
    });
  }
});

// Save resume data
router.post('/test/:testId/resume', async (req, res) => {
  try {
    const { testId } = req.params;
    const studentId = req.user.id;
    const { timeRemaining, answers, violations, browserFingerprint } = req.body;

    const test = await Test.findById(testId);
    if (!test || !test.resumeEnabled) {
      return res.status(400).json({
        success: false,
        message: 'Resume not enabled for this test'
      });
    }

    // Update or create resume data
    const existingIndex = test.resumeData.findIndex(data =>
      data.studentId.toString() === studentId.toString()
    );

    const resumeEntry = {
      studentId,
      lastActivity: new Date(),
      timeRemaining,
      answers,
      violations,
      browserFingerprint
    };

    if (existingIndex >= 0) {
      test.resumeData[existingIndex] = resumeEntry;
    } else {
      test.resumeData.push(resumeEntry);
    }

    await test.save();

    res.json({
      success: true,
      message: 'Resume data saved'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to save resume data'
    });
  }
});

// ============================================
// STUDENT PROFILE ENDPOINTS
// ============================================

// Get student profile
// In routes/student.js
router.get('/profile', async (req, res) => {
  try {
    const student = await Student.findById(req.user.id).select('-password name email class board rollNo school');
    res.json({ success: true, student });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch profile' });
  }
});
// In your Express route for getting answer sheets
router.get('/answer-sheet/:key', async (req, res) => {
  try {
    test.questionPaperURL = test.questionPaperURL || null; // 1 hour
    res.json({ success: true, url });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to generate URL' });
  }
});


// Update student profile
router.put('/profile', [
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
  body('phoneNumber').optional().isMobilePhone().withMessage('Invalid phone number'),
  body('school').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const allowedUpdates = ['name', 'phoneNumber', 'parentPhoneNumber', 'address', 'school', 'preferences'];
    const updates = {};

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const student = await Student.findByIdAndUpdate(
      req.user.id,
      updates,
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Profile updated successfully',
      student
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
});

// IMPORTANT: Export the router - this is what was missing!
module.exports = router;
