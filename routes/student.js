const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateStudent } = require('../middleware/auth');
const Test = require('../models/Test');
const Result = require('../models/Result');
const Student = require('../models/Student');
const multer = require('multer');
const mongoose = require('mongoose');
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
router.get('/dashboard', async (req, res) => {
  try {
    const studentId = req.user.id;

    // Get available tests
    const now = new Date();
    const availableTests = await Test.find({
      active: true,
      startDate: { $lte: nowIST },
      endDate: { $gte: nowIST },
      blockedStudents: { $nin: [studentId] }
    }).select('title subject class board duration totalMarks startDate endDate');

    // Get completed tests
    const completedResults = await Result.find({ studentId })
      .populate('testId', 'title subject')
      .sort({ submittedAt: -1 })
      .limit(10);

    // Get upcoming tests
    const upcomingTests = await Test.find({
      active: true,
      startDate: { $gt: now },
      blockedStudents: { $nin: [studentId] }
    }).select('title subject class board startDate endDate').limit(5);

    // Calculate statistics
    const totalTestsTaken = await Result.countDocuments({ studentId });
    const averageScore = await Result.aggregate([
      { $match: { studentId, marksApproved: true } },
      { $group: { _id: null, avg: { $avg: '$percentage' } } }
    ]);

    res.json({
      success: true,
      data: {
        availableTests,
        completedResults,
        upcomingTests,
        statistics: {
          totalTestsTaken,
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
// In your student routes (backend)

// Submit route
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

    // Find or create result
    let result = await Result.findOne({ 
      studentId: student._id, 
      testId: testId 
    });

    if (!result) {
      result = new Result({
        studentId: student._id,
        testId: testId,
        startedAt: new Date(),
        totalMarks: 0,
        questionWiseMarks: []
      });
    }

    // Update result with submission data
    result.submittedAt = new Date();
    result.answerSheetUrl = answerSheetUrl;
    result.violations = violations; // Record all violations
    result.browserInfo = browserInfo;
    result.status = autoSubmit ? 'auto_submitted' : 'submitted';
    
    // Add auto-submit details if applicable
    if (autoSubmit) {
      result.autoSubmitReason = autoSubmitReason;
      result.adminComments = `Auto-submitted due to: ${autoSubmitReason}`;
    }

    await result.save();

    res.json({ 
      success: true, 
      message: 'Test submitted successfully',
      resultId: result._id 
    });

  } catch (error) {
    console.error('Submit error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to submit test' 
    });
  }
});

// Exit route
router.post('/test/:testId/exit', authenticateStudent, async (req, res) => {
  try {
    const { violations = [] } = req.body;
    const student = req.student;
    const testId = req.params.testId;

    let result = await Result.findOne({ 
      studentId: student._id, 
      testId: testId 
    });

    if (!result) {
      result = new Result({
        studentId: student._id,
        testId: testId,
        startedAt: new Date(),
        totalMarks: 0,
        questionWiseMarks: []
      });
    }

    result.submittedAt = new Date();
    result.violations = violations; // Record violations on exit too
    result.status = 'exited';
    result.adminComments = 'Test exited by student';

    await result.save();

    res.json({ 
      success: true, 
      message: 'Test exited successfully' 
    });

  } catch (error) {
    console.error('Exit error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to exit test' 
    });
  }
});


// ============================================
// TEST ENDPOINTS
// ============================================

// Get available tests
// routes/student.js

router.get('/tests', async (req, res) => {
  try {
    const studentId = req.user.id;
    const student = await Student.findById(studentId);
    const now = new Date();

    // Normalize class: remove "Class " prefix if present
    const rawClass = student.class || '';
    const clsValue = rawClass.replace(/^Class\s*/i, '').trim();; // "11"
    // Find tests that match either plain "11" or prefixed "Class 11"
    const tests = await Test.find({
      active: true,
      board: student.board,
      startDate: { $lte: now },
      endDate: { $gte: now },
      $or: [
        { class: clsValue },
        { class: `Class ${clsValue}` }
      ]
    }).select('title subject class board duration totalMarks startDate endDate');

    res.json({ success: true, tests });
  } catch (error) {
    console.error('Get tests error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch tests' });
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
router.get('/test/:testId', async (req, res) => {
  try {
    const { testId } = req.params;
    const studentId = req.user.id;

    // Check existing submissions
    const existingResult = await Result.findOne({ studentId, testId });
    if (existingResult) {
      return res.status(400).json({
        success: false,
        message: 'Test already submitted'
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

    // Generate signed URL for question paper
    // In routes/student.js (test/:testId endpoint)
    // In routes/student.js (test/:testId endpoint)
    // Modify the test/:testId endpoint's signed URL generation
    if (test.questionPaperURL) {
      try {
        // Handle both full URLs and raw keys
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
      test
    });

  } catch (error) {
    console.error('Get test error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch test'
    });
  }
});
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
