const express = require('express');
const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const multer = require('multer');
const router = express.Router();
const moment = require('moment-timezone');
const nowIST = moment().tz('Asia/Kolkata').toDate();
const testController = require('../controllers/testController'); // Adjust path as neede
const studentController = require('../controllers/StudentController');
const manualTestEntryRoutes = require('./manualTestEntry');
// Adjust path as needed
const Notification = require('../models/Notification');
const NotificationSettings = require('../models/NotificationSettings');
const { uploadToGDrive: uploadViaOauth } = require('../services/oauthDrive');
 // Adjust path as neede
const upload = multer({ storage: multer.memoryStorage() });
const notificationService = require('../services/notificationService');
const SYSTEM_ADMIN_ID = '000000000000000000000001';
const ReviewResult   = require('../models/ReviewResult');
const { authenticateAdmin } = require('../middleware/auth');
const judge0Service = require('../services/judge0Service');

// Apply authentication middleware to all admin routes
router.use(authenticateAdmin);

// Test route for Google Drive upload debugging
router.post('/tests/test-drive-access', async (req, res) => {
  try {
    console.log('🧪 Testing Google Drive access...');
    
    // Check session tokens
    const tokens = req.session.googleTokens || req.session.tokens;
    if (!tokens) {
      return res.status(401).json({ 
        success: false, 
        message: 'No Google tokens found. Please connect to Google Drive first.',
        step: 'authentication'
      });
    }

    console.log('✅ Tokens found, testing Drive API...');

    // Test Drive API access
    const { google } = require('googleapis');
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_OAUTH_CLIENT_ID,
      process.env.GOOGLE_OAUTH_CLIENT_SECRET
    );
    oauth2Client.setCredentials(tokens);

    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // Test 1: Check user access
    const aboutResponse = await drive.about.get({ fields: 'user, storageQuota' });
    console.log('✅ Drive API access successful');

    // Test 2: List files (limited)
    const filesResponse = await drive.files.list({ pageSize: 5, fields: 'files(id, name)' });
    console.log('✅ File listing successful');

    // Test 3: Check folder access if specified
    let folderAccess = null;
    if (process.env.GOOGLE_DRIVE_FOLDER_ID) {
      try {
        const folderResponse = await drive.files.get({
          fileId: process.env.GOOGLE_DRIVE_FOLDER_ID,
          fields: 'id, name, permissions, capabilities'
        });
        folderAccess = {
          success: true,
          folder: folderResponse.data
        };
      } catch (folderError) {
        folderAccess = {
          success: false,
          error: folderError.message
        };
      }
    }

    res.json({
      success: true,
      message: 'Google Drive access test successful',
      results: {
        user: aboutResponse.data.user,
        storageQuota: aboutResponse.data.storageQuota,
        fileCount: filesResponse.data.files.length,
        folderAccess,
        tokenScopes: tokens.scope || 'unknown'
      }
    });

  } catch (error) {
    console.error('❌ Drive access test failed:', error);
    res.status(500).json({
      success: false,
      message: 'Google Drive access test failed',
      error: error.message,
      code: error.code,
      details: error.errors
    });
  }
});

// validation rules for creating a test
const validators = [
  body('title').notEmpty(),
  body('subject').notEmpty(),
  body('class').notEmpty(),
  body('board').notEmpty(),
  body('duration').isNumeric(),
  body('totalMarks').isNumeric(),
  body('passingMarks').isNumeric(),
  body('questionsCount').isNumeric(),
  body('startDate').isISO8601(),
  body('endDate').isISO8601(),
];

// Import models with proper error handling
let Test, Student, Result, User;

try {
  Test = require('../models/Test');
  Student = require('../models/Student');
  Result = require('../models/Result');
  User = require('../models/User');
  console.log('✅ All models loaded successfully');
} catch (error) {
  console.error('❌ Error loading models:', error.message);
}

// Simple authentication middleware (bypass for debugging)
const authenticate = (req, res, next) => {
  req.user = {
    _id: SYSTEM_ADMIN_ID,      // always supply _id
    role: 'admin',
    name: "CompuTech's Administrator",
    email: 'computechmailer@gmail.com'
  };
  next();
};

const requireAdmin = (req, res, next) => {
  next();
};

// Apply middleware
router.use(authenticate);
router.use(requireAdmin);

// ============================================
// DASHBOARD ENDPOINTS WITH REAL DATABASE QUERIES
// ============================================

// Dashboard Statistics with proper database queries
router.get('/dashboard/stats', authenticateAdmin, async (req, res) => {
  try {
    console.log('📊 Dashboard stats requested');
    console.log('🔗 MongoDB connection state:', mongoose.connection.readyState);

    // Initialize stats with defaults
    let stats = {
      totalStudents: 0,
      totalTests: 0,
      activeTests: 0,
      pendingResults: 0,
      todaySubmissions: 0,
      averageScore: 0,
      passRate: 0,
      totalViolations: 0
    };

    // Check if models are available and database is connected
    if (mongoose.connection.readyState === 1 && Student && Test && Result) {
      try {
        console.log('🔍 Querying database...');

        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

        // Execute queries individually with detailed logging
        console.log('👥 Counting students...');
        const totalStudents = await Student.countDocuments();
        console.log(`📊 Total students found: ${totalStudents}`);

        console.log('📝 Counting tests...');
        const totalTests = await Test.countDocuments();
        console.log(`📊 Total tests found: ${totalTests}`);

        console.log('⚡ Counting active tests...');
        const activeTests = await Test.countDocuments({
          active: true,
          startDate: { $lte: today },
          endDate: { $gte: today }
        });
        console.log(`📊 Active tests found: ${activeTests}`);

        console.log('⏳ Counting pending results...');
        const pendingResults = await Result.countDocuments({
          $or: [
            { marksApproved: false },
            { marksApproved: { $exists: false } }
          ]
        });
        console.log(`📊 Pending results found: ${pendingResults}`);

        console.log('📅 Counting today submissions...');
        const todaySubmissions = await Result.countDocuments({
          submittedAt: { $gte: startOfDay }
        });
        console.log(`📊 Today submissions found: ${todaySubmissions}`);

        // Calculate average score from approved results
        console.log('📊 Calculating average score...');
        const approvedResults = await Result.find({
          marksApproved: true,
          marksObtained: { $exists: true, $ne: null },
          totalMarks: { $exists: true, $gt: 0 }
        }).select('marksObtained totalMarks');

        let averageScore = 0;
        let passRate = 0;

        if (approvedResults.length > 0) {
          const totalScore = approvedResults.reduce((sum, result) => sum + result.marksObtained, 0);
          const totalMarks = approvedResults.reduce((sum, result) => sum + result.totalMarks, 0);
          averageScore = totalMarks > 0 ? Math.round((totalScore / totalMarks) * 100) : 0;

          const passedResults = approvedResults.filter(result => {
            const percentage = (result.marksObtained / result.totalMarks) * 100;
            return percentage >= 40;
          });
          passRate = Math.round((passedResults.length / approvedResults.length) * 100);
        }

        // Count violations
        console.log('⚠️ Counting violations...');
        const violationsCount = await Result.aggregate([
          { $unwind: { path: '$violations', preserveNullAndEmptyArrays: false } },
          { $count: 'totalViolations' }
        ]);

        const totalViolations = violationsCount.length > 0 ? violationsCount[0].totalViolations : 0;

        // Update stats with real data
        stats = {
          totalStudents,
          totalTests,
          activeTests,
          pendingResults,
          todaySubmissions,
          averageScore,
          passRate,
          totalViolations
        };

        console.log('✅ Real database stats calculated:', stats);

      } catch (dbError) {
        console.error('❌ Database query error:', dbError.message);
        console.error('📍 Error stack:', dbError.stack);

        // Provide realistic mock data when DB queries fail
        stats = {
          totalStudents: 0,
          totalTests: 0,
          activeTests: 0,
          pendingResults: 0,
          todaySubmissions: 0,
          averageScore: 0,
          passRate: 0,
          totalViolations: 0
        };
      }
    } else {
      console.log('⚠️ Database not ready or models not loaded');
      console.log('- Connection state:', mongoose.connection.readyState);
      console.log('- Student model:', !!Student);
      console.log('- Test model:', !!Test);
      console.log('- Result model:', !!Result);
    }

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('❌ Dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics',
      error: error.message
    });
  }
});
// In routes/admin.js
router.get('/result/:resultId', authenticateAdmin, async (req, res) => {
  try {
    const { resultId } = req.params;
    const result = await Result.findById(resultId)
      .populate('studentId', 'name email class board school')
      .populate('testId', 'title subject totalMarks passingMarks questionsCount questionPaperURL answerKeyURL answerKeyVisible')
      .lean();
    if (!result) {
      return res.status(404).json({ success: false, message: 'Result not found' });
    }
    
    // Extract test and student data, similar to student endpoint
    const { testId: testData, studentId: studentData, ...resultFields } = result;
    
    res.json({ 
      success: true, 
      result: resultFields,
      test: testData,
      student: { 
        name: studentData.name, 
        class: studentData.class, 
        school: studentData.school,
        email: studentData.email,
        board: studentData.board
      }
    });
  } catch (error) {
    console.error('Admin Get Result Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch result details' });
  }
});

// Get All Tests with real database query

router.get('/students/:id', studentController.getStudent);
router.patch('/students/:id/approval', studentController.setApproval);

// Partial update of student record
// PATCH /api/admin/students/:id
router.patch('/students/:id', studentController.updateStudent);
// Get All Students with real database query
router.get('/students', async (req, res) => {
  try {
    console.log('👥 Students requested');

    let students = [];

    if (mongoose.connection.readyState === 1 && Student) {
      try {
        console.log('🔍 Querying students from database...');

        // Use aggregation to get students with test statistics
        students = await Student.aggregate([
          {
            $lookup: {
              from: 'results',
              localField: '_id',
              foreignField: 'studentId',
              as: 'results'
            }
          },
          {
            $addFields: {
              testsTaken: { $size: '$results' },
              averageScore: {
                $cond: {
                  if: { $gt: [{ $size: '$results' }, 0] },
                  then: {
                    $avg: {
                      $map: {
                        input: '$results',
                        as: 'result',
                        in: {
                          $cond: {
                            if: { $and: ['$$result.marksObtained', '$$result.totalMarks'] },
                            then: { $multiply: [{ $divide: ['$$result.marksObtained', '$$result.totalMarks'] }, 100] },
                            else: 0
                          }
                        }
                      }
                    }
                  },
                  else: 0
                }
              }
            }
          },
          {
            $project: {
              password: 0,
              passwordHash: 0,
              results: 0
            }
          },
          { $sort: { createdAt: -1 } }
        ]);

        console.log(`📊 Found ${students.length} students in database`);

      } catch (dbError) {
        console.error('❌ Student query failed:', dbError.message);
        students = [];
      }
    }

    console.log(`✅ Retrieved ${students.length} students`);

    res.json({
      success: true,
      students
    });
  } catch (error) {
    console.error('❌ Get students error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch students',
      error: error.message
    });
  }
});
// fetch one test by ID
router.get('/tests/:id', testController.getTest);

// apply partial updates
router.patch('/tests/:id', testController.updateTest);

// Get All Results with real database query
router.get('/results', async (req, res) => {
  try {
    console.log('📊 Results requested');

    let results = [];

    if (mongoose.connection.readyState === 1 && Result) {
      try {
        console.log('🔍 Querying results from database...');

        results = await Result.find()
          .populate('studentId', 'name email rollNo class board')
          .populate('testId', 'title subject questionsCount totalMarks type coding')
          .sort({ submittedAt: -1 })
          .lean();

        console.log(`📊 Found ${results.length} results in database`);

        // Enrich results with computed fields
        results = results.map(result => ({
          ...result,
          questionsCount: result.testId?.questionsCount || 0,
          hasViolations: result.violations && result.violations.length > 0,
          violationCount: result.violations ? result.violations.length : 0,
          hasAnswerSheet: !!result.answerSheetUrl
        }));

      } catch (dbError) {
        console.error('❌ Results query failed:', dbError.message);
        results = [];
      }
    }

    console.log(`✅ Retrieved ${results.length} results`);

    res.json({
      success: true,
      results
    });
  } catch (error) {
    console.error('❌ Get results error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch results',
      error: error.message
    });
  }
});

// Get single result details for review
router.get('/results/:resultId', authenticateAdmin, async (req, res) => {
  try {
    const { resultId } = req.params;
    console.log(`📊 Fetching result details for ID: ${resultId}`);

    if (!mongoose.connection.readyState || !Result) {
      return res.status(503).json({
        success: false,
        message: 'Database not available'
      });
    }

    const result = await Result.findById(resultId)
      .populate('studentId', 'name email rollNo class board')
      .populate('testId', 'title subject type questionsCount totalMarks')
      .lean();

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Result not found'
      });
    }

    console.log(`✅ Result details retrieved for ${result.studentId?.name || 'Unknown'}`);

    res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('❌ Get result details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch result details',
      error: error.message
    });
  }
});

// Update result comments
router.patch('/results/:resultId/comments', authenticateAdmin, async (req, res) => {
  try {
    const { resultId } = req.params;
    const { comments } = req.body;
    
    console.log(`📝 Updating comments for result: ${resultId}`);

    if (!mongoose.connection.readyState || !Result) {
      return res.status(503).json({
        success: false,
        message: 'Database not available'
      });
    }

    const result = await Result.findByIdAndUpdate(
      resultId,
      { adminComments: comments },
      { new: true }
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Result not found'
      });
    }

    console.log(`✅ Comments updated for result: ${resultId}`);

    res.json({
      success: true,
      message: 'Comments updated successfully',
      result
    });
  } catch (error) {
    console.error('❌ Update comments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update comments',
      error: error.message
    });
  }
});

// Update result status
router.patch('/results/:resultId/status', authenticateAdmin, async (req, res) => {
  try {
    const { resultId } = req.params;
    const { status } = req.body;
    
    console.log(`🔄 Updating status for result: ${resultId} to ${status}`);

    if (!mongoose.connection.readyState || !Result) {
      return res.status(503).json({
        success: false,
        message: 'Database not available'
      });
    }

    const result = await Result.findByIdAndUpdate(
      resultId,
      { status },
      { new: true, runValidators: true }
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Result not found'
      });
    }

    console.log(`✅ Status updated successfully for result: ${resultId}`);

    res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('❌ Update status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update status',
      error: error.message
    });
  }
});

// Update question marks for coding tests
router.patch('/results/:resultId/question-marks', authenticateAdmin, async (req, res) => {
  try {
    const { resultId } = req.params;
    const { questionIndex, marks } = req.body;
    
    console.log(`📝 Updating marks for result: ${resultId}, question: ${questionIndex}, marks: ${marks}`);

    if (!mongoose.connection.readyState || !Result) {
      return res.status(503).json({
        success: false,
        message: 'Database not available'
      });
    }

    const result = await Result.findById(resultId);
    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Result not found'
      });
    }

    // Update the specific question marks in coding results
    if (result.codingResults && result.codingResults.questionResults) {
      if (questionIndex >= 0 && questionIndex < result.codingResults.questionResults.length) {
        result.codingResults.questionResults[questionIndex].score = marks;
        
        // Recalculate total score
        result.codingResults.totalScore = result.codingResults.questionResults.reduce(
          (sum, qr) => sum + (qr.score || 0), 0
        );
        
        // Update percentage and marks obtained
        result.marksObtained = result.codingResults.totalScore;
        result.percentage = (result.codingResults.totalScore / result.codingResults.maxScore) * 100;
        
        await result.save();
        
        console.log(`✅ Question marks updated successfully for result: ${resultId}`);
        
        res.json({
          success: true,
          result
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Invalid question index'
        });
      }
    } else {
      res.status(400).json({
        success: false,
        message: 'No coding results found'
      });
    }
  } catch (error) {
    console.error('❌ Update question marks error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update question marks',
      error: error.message
    });
  }
});

// PATCH /api/admin/results/:resultId/marks - Save & Approve all marks
router.patch('/results/:resultId/marks', authenticateAdmin, async (req, res) => {
  try {
    const { resultId } = req.params;
    const { questionWiseMarks, adminComments } = req.body;
    
    console.log(`📝 Saving & approving marks for result: ${resultId}`);

    if (!mongoose.connection.readyState || !Result) {
      return res.status(503).json({
        success: false,
        message: 'Database not available'
      });
    }

    const result = await Result.findById(resultId);
    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Result not found'
      });
    }

    // Update question wise marks
    if (questionWiseMarks && Array.isArray(questionWiseMarks)) {
      result.questionWiseMarks = questionWiseMarks;
      
      // Calculate total marks obtained
      const totalObtained = questionWiseMarks.reduce((sum, qm) => sum + (qm.obtainedMarks || 0), 0);
      const totalMax = questionWiseMarks.reduce((sum, qm) => sum + (qm.maxMarks || 0), 0);
      
      result.marksObtained = totalObtained;
      result.totalMarks = totalMax;
      result.percentage = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;
    }

    // Update admin comments
    if (adminComments !== undefined) {
      result.adminComments = adminComments;
    }

    // Change status from 'done' to 'completed' when admin saves & approves
    if (result.status === 'done') {
      result.status = 'completed';
      console.log(`✅ Status changed from 'done' to 'completed' for result: ${resultId}`);
    }

    await result.save();
    
    console.log(`✅ Marks saved and approved successfully for result: ${resultId}`);
    
    res.json({
      success: true,
      message: 'Marks saved and approved successfully',
      result
    });
  } catch (error) {
    console.error('❌ Save marks error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save marks',
      error: error.message
    });
  }
});

// Dashboard Charts with real data
router.get('/dashboard/charts', async (req, res) => {
  try {
    console.log('📈 Chart data requested');

    let charts = {
      testSubmissions: {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        data: [0, 0, 0, 0, 0, 0, 0]
      },
      studentGrades: {
        labels: ['A+', 'A', 'B+', 'B', 'C', 'F'],
        data: [0, 0, 0, 0, 0, 0]
      },
      subjectPerformance: {
        labels: ['No Data'],
        data: [0]
      }
    };

    if (mongoose.connection.readyState === 1 && Result) {
      try {
        // Get last 7 days submission data
        const last7Days = Array.from({ length: 7 }, (_, i) => {
          const date = new Date();
          date.setDate(date.getDate() - i);
          return date;
        }).reverse();

        const submissionData = [];
        for (const date of last7Days) {
          const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
          const endOfDay = new Date(startOfDay);
          endOfDay.setDate(endOfDay.getDate() + 1);

          const count = await Result.countDocuments({
            submittedAt: { $gte: startOfDay, $lt: endOfDay }
          });

          submissionData.push(count);
        }

        charts.testSubmissions.data = submissionData;

        // Grade distribution
        const results = await Result.find({
          marksApproved: true,
          marksObtained: { $exists: true },
          totalMarks: { $exists: true }
        }).select('marksObtained totalMarks');

        const gradeDistribution = { 'A+': 0, 'A': 0, 'B+': 0, 'B': 0, 'C': 0, 'F': 0 };

        results.forEach(result => {
          if (result.marksObtained && result.totalMarks) {
            const percentage = (result.marksObtained / result.totalMarks) * 100;
            if (percentage >= 90) gradeDistribution['A+']++;
            else if (percentage >= 80) gradeDistribution['A']++;
            else if (percentage >= 70) gradeDistribution['B+']++;
            else if (percentage >= 60) gradeDistribution['B']++;
            else if (percentage >= 50) gradeDistribution['C']++;
            else gradeDistribution['F']++;
          }
        });

        charts.studentGrades.data = Object.values(gradeDistribution);

        // Subject performance
        const subjectPerformance = await Result.aggregate([
          { $match: { marksApproved: true, marksObtained: { $exists: true } } },
          {
            $group: {
              _id: '$subject',
              averageScore: { $avg: { $divide: ['$marksObtained', '$totalMarks'] } },
              count: { $sum: 1 }
            }
          },
          { $sort: { averageScore: -1 } },
          { $limit: 10 }
        ]);

        if (subjectPerformance.length > 0) {
          charts.subjectPerformance = {
            labels: subjectPerformance.map(s => s._id || 'Unknown'),
            data: subjectPerformance.map(s => Math.round(s.averageScore * 100))
          };
        }

      } catch (dbError) {
        console.error('❌ Chart data query failed:', dbError.message);
      }
    }

    console.log('✅ Chart data calculated');

    res.json({
      success: true,
      charts: {
        monthly: charts.testSubmissions.data,
        distribution: charts.studentGrades.data,
        labels: charts.testSubmissions.labels,
        monthlyLabels: charts.testSubmissions.labels,
        distributionLabels: charts.studentGrades.labels
      }
    });
  } catch (error) {
    console.error('❌ Chart data error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch chart data',
      error: error.message
    });
  }
});
// mounted via app.use('/api/admin', router)
router.delete('/tests/:id', testController.deleteTest);
// Health check with database status
router.get('/health', (req, res) => {
  console.log('✅ Admin health check');
  res.json({
    success: true,
    message: 'Admin routes are working!',
    timestamp: new Date().toISOString(),
    database: {
      connected: mongoose.connection.readyState === 1,
      state: mongoose.connection.readyState,
      name: mongoose.connection.name
    },
    models: {
      Student: !!Student,
      Test: !!Test,
      Result: !!Result,
      User: !!User
    }
  });
});


// Rest of the routes remain the same...


// GET /api/admin/tests  → list all for dashboard
router.get('/tests', async (req, res, next) => {
  try {
    const tests = await Test.find()
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, tests });
  } catch (err) {
    next(err);
  }
});
// 1. Upload questionPaper, answerSheet, answerKey separately
router.post(
  '/tests',
  upload.none(),           // no files here—just JSON
  validators,
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }
    try {
      // pull JSON fields, including the three URL properties
      const {
        title, description = '',
        subject, class: cls, board,
        duration, totalMarks, passingMarks, questionsCount,
        startDate, endDate,
        questionPaperURL,   // ← new   // ← new
        answerKeyURL,       // ← new
        resumeEnabled = true,
        answerKeyVisible = false,
        proctoringSettings = {},
        cameraMonitoring = {},
        paperSubmissionRequired = false,
        paperUploadTimeLimit = 15,
        paperUploadAllowedDuringTest = false,
        // Modern coding test fields
        type = 'traditional',
        coding,
        // Legacy coding test fields (for backward compatibility)
        isCodingTest = false,
        codingLanguage,
        codingProblem
      } = req.body;

      // Determine if this is a coding test from either new or old format
      const isActuallyACodingTest = type === 'coding' || isCodingTest;

      // Validate coding test specific fields for both old and new formats
      if (isActuallyACodingTest) {
        // New format validation (multi-question coding tests)
        if (coding && coding.questions && coding.questions.length > 0) {
          // Validate new format coding questions
          for (const question of coding.questions) {
            if (!question.title || !question.description) {
              return res.status(400).json({
                success: false,
                message: 'Question title and description are required for coding tests'
              });
            }
            if (!question.testCases || question.testCases.length === 0) {
              return res.status(400).json({
                success: false,
                message: 'At least one test case is required for each coding question'
              });
            }
          }
        } 
        // Legacy format validation (single question coding tests)
        else if (codingProblem) {
          if (!codingProblem.title || !codingProblem.description) {
            return res.status(400).json({
              success: false,
              message: 'Coding problem title and description are required for coding tests'
            });
          }
          
          if (!codingProblem.testCases || codingProblem.testCases.length === 0) {
            return res.status(400).json({
              success: false,
              message: 'At least one test case is required for coding tests'
            });
          }

          // Auto-detect language based on board if not provided
          if (!codingLanguage) {
            const languageInfo = judge0Service.getLanguageIdForBoard(board);
            codingLanguage = languageInfo.language;
          }

          // Generate starter code if not provided
          if (!codingProblem.starterCode) {
            const starterCode = judge0Service.getStarterCode(codingLanguage, codingProblem.title);
            codingProblem.starterCode = {
              [codingLanguage]: starterCode
            };
          }
        } else {
          return res.status(400).json({
            success: false,
            message: 'Coding test must have either coding questions or coding problem defined'
          });
        }
      }

      // build your document in one shot
      const test = await Test.create({
        title,
        description,
        subject,
        class: cls,
        board,
        duration,
        totalMarks,
        passingMarks,
        questionsCount,
        startDate,
        endDate,
        questionPaperURL,   // persisted     // persisted
        answerKeyURL,       // persisted
        resumeEnabled,
        answerKeyVisible,
        proctoringSettings,
        cameraMonitoring,
        paperSubmissionRequired,
        paperUploadTimeLimit,
        paperUploadAllowedDuringTest,
        // Modern coding test fields with backward compatibility
        type: isActuallyACodingTest ? 'coding' : 'traditional',
        coding: coding || undefined, // New multi-question format
        // Legacy coding test fields (for backward compatibility)
        isCodingTest: isActuallyACodingTest,
        codingLanguage,
        codingProblem: codingProblem || undefined,
        createdBy: req.user._id
      });

      res.status(201).json({
        success: true,
        message: `${isActuallyACodingTest ? 'Coding test' : 'Test'} created successfully`,
        test
      });
    } catch (err) {
      next(err);
    }
  }
);
router.post(
  '/tests/upload-temp',
  upload.fields([
    { name: 'questionPaper', maxCount: 1 },
    { name: 'answerKey', maxCount: 1 }
  ]),
  async (req, res, next) => {
    try {
      console.log('📁 File upload request received');
      console.log('🔍 Authentication check:', {
        hasUser: !!req.user,
        userRole: req.user?.role || 'none',
        userId: req.user?.id || 'none'
      });

      // 🛡️ Get OAuth2 tokens from database (saved during Google OAuth)
      const adminUser = await User.findOne({ role: 'admin' });
      if (!adminUser || !adminUser.googleTokens) {
        console.log('❌ No Google tokens found in database');
        return res.status(401).json({ 
          success: false, 
          message: 'Google Drive authentication required. Please connect to Google Drive first.',
          needsAuth: true
        });
      }

      console.log('✅ Google tokens found in database, proceeding with upload');
      const tokens = adminUser.googleTokens;
      const fileData = {};
      const nowIST = moment().tz('Asia/Kolkata');

      for (const field of ['questionPaper', 'answerKey']) {
        const fileArr = req.files[field];
        if (!fileArr?.[0]) continue;

        const file = fileArr[0];
        const sanitizedFilename = file.originalname.replace(/[^a-z0-9_.-]/gi, '_');
        const gdriveFileName = `${nowIST.format('YYYYMMDD-HHmmss')}_${sanitizedFilename}`;

        // ✅ Upload using OAuth tokens instead of service account
        const uploadResult = await uploadViaOauth(
          tokens,
          file.buffer,
          gdriveFileName,
          file.mimetype
        );

        fileData[field] = {
          url: uploadResult.url,
          fileId: uploadResult.fileId,
          originalName: file.originalname
        };
      }

      res.json({
        success: true,
        message: 'Files uploaded to Google Drive successfully',
        data: fileData
      });

    } catch (err) {
      console.error('⚠️ Google Drive upload error (OAuth):', err);
      res.status(500).json({
        success: false,
        message: process.env.NODE_ENV === 'development'
          ? `Google Drive upload failed: ${err.message}`
          : 'File upload failed. Please try again.'
      });
    }
  }
);

// Individual file upload endpoints for test creation
router.post('/upload/question-paper/:testId', upload.single('question-paper'), async (req, res) => {
  try {
    console.log('📄 Question paper upload for test:', req.params.testId);
    
    // Get admin user OAuth tokens from database (consistent approach)
    const adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser || !adminUser.googleTokens) {
      return res.status(401).json({ 
        success: false, 
        message: 'Google Drive authentication required. Please connect to Google Drive first.',
        needsAuth: true
      });
    }
    
    const tokens = adminUser.googleTokens;

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const nowIST = moment().tz('Asia/Kolkata');
    const sanitizedFilename = req.file.originalname.replace(/[^a-z0-9_.-]/gi, '_');
    const gdriveFileName = `${nowIST.format('YYYYMMDD-HHmmss')}_question_paper_${sanitizedFilename}`;

    const uploadResult = await uploadViaOauth(
      tokens,
      req.file.buffer,
      gdriveFileName,
      req.file.mimetype
    );

    // Update test with file info
    await Test.findByIdAndUpdate(req.params.testId, {
      questionPaper: {
        url: uploadResult.url,
        fileId: uploadResult.fileId,
        originalName: req.file.originalname
      }
    });

    res.json({
      success: true,
      message: 'Question paper uploaded successfully',
      data: {
        url: uploadResult.url,
        fileId: uploadResult.fileId,
        originalName: req.file.originalname
      }
    });

  } catch (error) {
    console.error('❌ Question paper upload error:', error);
    res.status(500).json({
      success: false,
      message: `Upload failed: ${error.message}`
    });
  }
});

router.post('/upload/answer-sheet/:testId', upload.single('answer-sheet'), async (req, res) => {
  try {
    console.log('📋 Answer sheet upload for test:', req.params.testId);
    
    // Get admin user OAuth tokens from database (consistent approach)
    const adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser || !adminUser.googleTokens) {
      return res.status(401).json({ 
        success: false, 
        message: 'Google Drive authentication required. Please connect to Google Drive first.',
        needsAuth: true
      });
    }
    
    const tokens = adminUser.googleTokens;

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const nowIST = moment().tz('Asia/Kolkata');
    const sanitizedFilename = req.file.originalname.replace(/[^a-z0-9_.-]/gi, '_');
    const gdriveFileName = `${nowIST.format('YYYYMMDD-HHmmss')}_answer_sheet_${sanitizedFilename}`;

    const uploadResult = await uploadViaOauth(
      tokens,
      req.file.buffer,
      gdriveFileName,
      req.file.mimetype
    );

    // Update test with file info
    await Test.findByIdAndUpdate(req.params.testId, {
      answerSheet: {
        url: uploadResult.url,
        fileId: uploadResult.fileId,
        originalName: req.file.originalname
      }
    });

    res.json({
      success: true,
      message: 'Answer sheet uploaded successfully',
      data: {
        url: uploadResult.url,
        fileId: uploadResult.fileId,
        originalName: req.file.originalname
      }
    });

  } catch (error) {
    console.error('❌ Answer sheet upload error:', error);
    res.status(500).json({
      success: false,
      message: `Upload failed: ${error.message}`
    });
  }
});

router.post('/upload/answer-key/:testId', upload.single('answer-key'), async (req, res) => {
  try {
    console.log('🔑 Answer key upload for test:', req.params.testId);
    
    const tokens = req.session.googleTokens || req.session.tokens;
    if (!tokens) {
      return res.status(401).json({ 
        success: false, 
        message: 'Google Drive authentication required. Please connect to Google Drive first.',
        needsAuth: true
      });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const nowIST = moment().tz('Asia/Kolkata');
    const sanitizedFilename = req.file.originalname.replace(/[^a-z0-9_.-]/gi, '_');
    const gdriveFileName = `${nowIST.format('YYYYMMDD-HHmmss')}_answer_key_${sanitizedFilename}`;

    const uploadResult = await uploadViaOauth(
      tokens,
      req.file.buffer,
      gdriveFileName,
      req.file.mimetype
    );

    // Update test with file info
    await Test.findByIdAndUpdate(req.params.testId, {
      answerKey: {
        url: uploadResult.url,
        fileId: uploadResult.fileId,
        originalName: req.file.originalname
      }
    });

    res.json({
      success: true,
      message: 'Answer key uploaded successfully',
      data: {
        url: uploadResult.url,
        fileId: uploadResult.fileId,
        originalName: req.file.originalname
      }
    });

  } catch (error) {
    console.error('❌ Answer key upload error:', error);
    res.status(500).json({
      success: false,
      message: `Upload failed: ${error.message}`
    });
  }
});

router.get('/gdrive-status', async (req, res) => {
  try {
    // Check current admin's Google connection status
    const User = require('../models/User');
    const admin = await User.findById(req.admin._id);
    
    res.json({ 
      connected: !!(req.session && req.session.tokens) || !!(admin && admin.googleConnected),
      hasStoredTokens: !!(admin && admin.googleTokens && admin.googleTokens.refresh_token)
    });
  } catch (error) {
    res.json({ connected: false, hasStoredTokens: false });
  }
});

// Route to initiate Google Drive connection
router.get('/connect-gdrive', (req, res) => {
  const { getAuthUrl } = require('../services/oauthDrive');
  const authUrl = getAuthUrl();
  res.redirect(authUrl);
});

// Bulk action for tests, students, results
router.post('/bulk-action', async (req, res) => {
  const { action, items, type } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'No items selected' });
  }

  // Determine which model to operate on
  let Model;
  switch (type) {
    case 'tests': Model = Test; break;
    case 'students': Model = Student; break;
    case 'results': Model = Result; break;
    default:
      return res.status(400).json({ success: false, message: `Unknown type: ${type}` });
  }

  try {
    switch (action) {
      case 'activate':
        // For results, “activate” means approve marks
        if (type === 'results') {
          await Model.updateMany(
            { _id: { $in: items } },
            { $set: { marksApproved: true } }
          );
        } else {
          await Model.updateMany(
            { _id: { $in: items } },
            { $set: { active: true } }
          );
        }
        break;

      case 'deactivate':
        if (type === 'results') {
          await Model.updateMany(
            { _id: { $in: items } },
            { $set: { marksApproved: false } }
          );
        } else {
          await Model.updateMany(
            { _id: { $in: items } },
            { $set: { active: false } }
          );
        }
        break;

      case 'delete':
        await Model.deleteMany({ _id: { $in: items } });
        break;

      default:
        return res.status(400).json({ success: false, message: `Unknown action: ${action}` });
    }

    return res.json({
      success: true,
      message: `${action}d ${items.length} ${type}`
    });
  } catch (err) {
    console.error('Bulk-action error:', err);
    return res.status(500).json({ success: false, message: 'Bulk action failed' });
  }
});
// PATCH  /api/admin/review-results/:id/marks



// Notification endpoints
// ✅ FIXED: Get notifications with proper error handling
router.get('/notifications', async (req, res) => {
  try {
    console.log('📋 Admin notifications request received');
    console.log('User:', req.user ? `${req.user.name} (${req.user.role})` : 'No user');

    // Validate admin access
    if (!req.user) {
      console.error('❌ No user in request');
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }

    if (req.user.role !== 'admin') {
      console.error('❌ User is not admin:', req.user.role);
      return res.status(403).json({ 
        success: false, 
        message: 'Admin access required' 
      });
    }

    // Check if Notification model exists
    if (!Notification) {
      console.error('❌ Notification model not found');
      return res.status(500).json({
        success: false,
        message: 'Notification model not available'
      });
    }

    console.log('📋 Fetching notifications from database...');

    // Fetch notifications with error handling
    const notifications = await Notification.find({})
      .sort({ createdAt: -1 })
      .limit(50)
      .lean()
      .catch(err => {
        console.error('❌ Database query error:', err);
        throw new Error(`Database error: ${err.message}`);
      });

    console.log(`📋 Found ${notifications ? notifications.length : 0} notifications`);

    // Transform notifications for frontend
    const transformedNotifications = (notifications || []).map(notification => ({
      _id: notification._id,
      title: notification.title || 'No title',
      message: notification.message || 'No message',
      type: notification.type || 'unknown',
      read: notification.read || false,
      emailSent: notification.emailSent || false,
      appNotificationSent: notification.appNotificationSent || false,
      createdAt: notification.createdAt,
      updatedAt: notification.updatedAt,
      data: notification.data || {},
      status: (notification.emailSent || notification.appNotificationSent) ? 'sent' : 'pending'
    }));

    console.log('✅ Notifications transformed successfully');

    res.json({ 
      success: true, 
      notifications: transformedNotifications,
      count: transformedNotifications.length
    });

  } catch (error) {
    console.error('❌ Error in /notifications route:', error);
    console.error('Error stack:', error.stack);

    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch notifications',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? {
        stack: error.stack,
        name: error.name
      } : undefined
    });
  }
});

// ✅ FIXED: Send notifications with better error handling
router.post('/notifications/send', async (req, res) => {
  try {
    console.log('Processing notification send request...');
    
    const { 
      studentIds = [], 
      testIds = [], 
      notificationType = 'both',
      emailTemplate = 'custom_message', 
      customMessage = '',
      context = {}
    } = req.body;

    console.log('Request payload:', {
      studentCount: studentIds.length,
      testCount: testIds.length,
      emailTemplate,
      notificationType
    });

    // Validate admin authentication
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Admin access required' 
      });
    }

    const adminId = req.user._id || req.user.id;

    // Validate input
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one student must be selected'
      });
    }

    if (!Array.isArray(testIds) || testIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one test must be selected'
      });
    }

    console.log(`Fetching ${studentIds.length} students and ${testIds.length} tests...`);

    // Fetch students and tests with error handling
    let students, tests;
    
    try {
      students = await Student.find({ _id: { $in: studentIds } }).lean();
      console.log(`Found ${students.length} students`);
    } catch (err) {
      console.error('Error fetching students:', err);
      return res.status(500).json({
        success: false,
        message: 'Error fetching students'
      });
    }

    try {
      tests = await Test.find({ _id: { $in: testIds } }).lean();
      console.log(`Found ${tests.length} tests`);
    } catch (err) {
      console.error('Error fetching tests:', err);
      return res.status(500).json({
        success: false,
        message: 'Error fetching tests'
      });
    }

    if (students.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No valid students found'
      });
    }

    if (tests.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No valid tests found'
      });
    }

    const results = [];
    
    // Process each test
    for (const test of tests) {
      try {
        console.log(`Processing notification for test: ${test.title} (type: ${emailTemplate})`);

        // Handle result_published notifications differently
        if (emailTemplate === 'result_published') {
          console.log('Processing result_published notifications...');
          
          // Process each student individually for result notifications
          for (const student of students) {
            try {
              // Try to find actual result first
              let actualResult = null;
              try {
                actualResult = await Result.findOne({
                  studentId: student._id,
                  testId: test._id,
                  status: { $in: ['published', 'reviewed'] }
                }).lean();
              } catch (resultError) {
                console.warn('Could not fetch actual result:', resultError.message);
              }

              // Create result data (use actual if available, otherwise mock)
              const resultData = actualResult ? {
                studentId: student._id,
                studentName: student.name,
                studentEmail: student.email,
                testTitle: test.title,
                testSubject: test.subject,
                status: actualResult.status,
                marksObtained: actualResult.marksObtained || 0,
                totalMarks: actualResult.totalMarks || test.totalMarks,
                percentage: actualResult.percentage || 0,
                submittedAt: actualResult.submittedAt
              } : {
                studentId: student._id,
                studentName: student.name,
                studentEmail: student.email,
                testTitle: test.title,
                testSubject: test.subject,
                status: 'published',
                marksObtained: 0,
                totalMarks: test.totalMarks,
                percentage: 0
              };

              const notificationData = {
                resultData,
                context: { 
                  ...context, 
                  isResultNotification: true,
                  fromNotificationCenter: true
                }
              };

              // Send individual result notification
              const result = await notificationService.sendNotification(
                adminId,
                'result_published', // Always use result_published type
                `Results Published: ${test.title}`,
                customMessage || `Your results for "${test.title}" have been published. Please check your dashboard to view your scores.`,
                notificationData
              );
              
              results.push({
                testId: test._id,
                studentId: student._id,
                testTitle: test.title,
                studentName: student.name,
                notificationType: 'result_published',
                success: true,
                result
              });

              console.log(`Result notification sent to ${student.name}`);
            } catch (studentError) {
              console.error(`Failed to send result notification to ${student.name}:`, studentError);
              results.push({
                testId: test._id,
                studentId: student._id,
                testTitle: test.title,
                studentName: student.name,
                notificationType: 'result_published',
                success: false,
                error: studentError.message
              });
            }
          }
        } else {
          // Handle test assignment notifications (all other types)
          console.log('Processing test assignment notification...');
          
          const notificationData = {
            students, 
            tests: [test], 
            testData: test,
            notificationType,
            context: {
              ...context,
              isTestNotification: true,
              fromNotificationCenter: true
            }
          };

          // Determine the actual notification type
          let actualType = emailTemplate;
          if (emailTemplate === 'test_assignment' || emailTemplate === 'custom_message') {
            actualType = 'test_created';
          }

          // Send notification to all students at once
          const result = await notificationService.sendNotification(
            adminId,
            actualType,
            `New Test: ${test.title} - ${test.subject}`,
            customMessage || `A new test "${test.title}" has been assigned to you. Please check your dashboard for details.`,
            notificationData
          );
          
          results.push({
            testId: test._id,
            testTitle: test.title,
            notificationType: actualType,
            studentsCount: students.length,
            success: true,
            result
          });

          console.log(`Test assignment notification sent for: ${test.title}`);
        }
        
      } catch (testError) {
        console.error(`Failed to send notification for test ${test.title}:`, testError);
        results.push({
          testId: test._id,
          testTitle: test.title,
          notificationType: emailTemplate,
          success: false,
          error: testError.message
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`Notification processing complete: ${successCount} successful, ${failCount} failed`);

    return res.json({ 
      success: true, 
      message: `Notifications processed: ${successCount} successful, ${failCount} failed`,
      results,
      notificationType: emailTemplate,
      summary: {
        studentsNotified: students.length,
        testsProcessed: tests.length,
        successCount,
        failCount,
        totalNotifications: results.length
      },
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('Send notification error:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to send notifications',
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

// ✅ Test route to verify everything is working
router.get('/test-notifications', async (req, res) => {
  try {
    console.log('🧪 Testing notifications setup...');

    const checks = {
      user: !!req.user,
      userRole: req.user?.role,
      notificationModel: !!Notification,
      notificationService: !!notificationService,
      database: false
    };

    // Test database connection
    try {
      const count = await Notification.countDocuments();
      checks.database = true;
      checks.notificationCount = count;
    } catch (dbError) {
      checks.databaseError = dbError.message;
    }

    res.json({
      success: true,
      message: 'Notification system status',
      checks
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Test failed',
      error: error.message
    });
  }
});

router.get('/notification-settings', authenticateAdmin, async (req, res) => {
  try {
    // Try to get admin-specific settings first, then global settings
    let settings = await NotificationSettings.findOne({ adminId: req.user.id });
    
    if (!settings) {
      settings = await NotificationSettings.findOne({});
    }
    
    if (!settings) {
      // Return default settings if none exist
      settings = {
        emailNotifications: true,
        appNotifications: true,
        emailTemplates: {
          test_assigned: {
            subject: 'New Test Assigned - {{testTitle}}',
            body: `Hello {{studentName}},

A new test has been assigned to you:

Test: {{testTitle}}
Subject: {{testSubject}}
Class: {{testClass}}
Start Date: {{startDate}}
End Date: {{endDate}}
Duration: {{duration}} minutes
Total Marks: {{totalMarks}}

Please login to your account to take the test.

Best regards,
CompuTech Team`
          },
          test_reminder: {
            subject: 'Reminder: Test Due Soon - {{testTitle}}',
            body: `Hello {{studentName}},

This is a reminder that the test "{{testTitle}}" is due soon.

Test Details:
- Subject: {{testSubject}}
- End Date: {{endDate}}
- Duration: {{duration}} minutes

Please complete the test before the deadline.

Best regards,
CompuTech Team`
          },
          result_published: {
            subject: 'Test Results Published - {{testTitle}}',
            body: `Hello {{studentName}},

Your test results for "{{testTitle}}" have been published.

You can view your results by logging into your account.

Best regards,
CompuTech Team`
          }
        },
        appNotificationSettings: {
          showBadge: true,
          soundEnabled: true,
          vibrationEnabled: true
        }
      };
    }
    
    res.json({ success: true, settings });
  } catch (error) {
    console.error('Error fetching notification settings:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch settings' });
  }
});

router.post('/notification-settings', authenticateAdmin, async (req, res) => {
  try {
    const { settings } = req.body;
    console.log('💾 Saving notification settings:', settings);

    // Save settings globally (not admin-specific for now)
    await NotificationSettings.findOneAndUpdate(
      {}, // Global settings
      { $set: settings },
      { upsert: true, new: true }
    );

    res.json({ success: true, message: 'Settings saved successfully' });
  } catch (error) {
    console.error('Error saving notification settings:', error);
    res.status(500).json({ success: false, message: 'Failed to save settings' });
  }
});

// Test notification endpoint
router.post('/test-notification', authenticateAdmin, async (req, res) => {
  try {
    const { type, message, students } = req.body;
    console.log('🧪 Testing notification:', { type, message, studentsCount: students?.length });
    
    if (!students || students.length === 0) {
      return res.status(400).json({ success: false, message: 'No students provided' });
    }

    const testData = {
      title: 'Test Notification',
      subject: 'Test',
      duration: 60,
      totalMarks: 100,
      startDate: new Date(),
      endDate: new Date(Date.now() + 24 * 60 * 60 * 1000) // 1 day from now
    };

    const result = await notificationService.sendNotification(
      req.user.id,
      type || 'test_created',
      'Test Notification',
      message || 'This is a test notification to verify the system is working.',
      {
        students: students,
        testData: testData,
        isTestNotification: true
      }
    );

    res.json({ 
      success: true, 
      message: 'Test notification sent', 
      result 
    });
  } catch (error) {
    console.error('Test notification error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send test notification',
      error: error.message 
    });
  }
});

// ===== CODING TEST SPECIFIC ROUTES =====

// Test Judge0 service connection
router.get('/coding/test-connection', async (req, res) => {
  try {
    const serviceInfo = await judge0Service.getAbout();
    res.json({
      success: true,
      message: 'Judge0 service connected successfully',
      service: serviceInfo
    });
  } catch (error) {
    console.error('Judge0 connection test failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to connect to Judge0 service',
      error: error.message
    });
  }
});

// Get available programming languages
router.get('/coding/languages', async (req, res) => {
  try {
    const languages = await judge0Service.getLanguages();
    res.json({
      success: true,
      languages: languages
    });
  } catch (error) {
    console.error('Error fetching languages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch programming languages'
    });
  }
});

// Get language recommendation based on education board
router.get('/coding/language-for-board/:board', (req, res) => {
  try {
    const { board } = req.params;
    const languageInfo = judge0Service.getLanguageIdForBoard(board);
    
    res.json({
      success: true,
      board: board,
      recommendedLanguage: languageInfo.language,
      languageId: languageInfo.languageId,
      description: `Recommended programming language for ${board} students`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get language recommendation'
    });
  }
});

// Generate starter code for a language
router.post('/coding/starter-code', (req, res) => {
  try {
    const { language, problemTitle } = req.body;
    
    if (!language) {
      return res.status(400).json({
        success: false,
        message: 'Programming language is required'
      });
    }

    const starterCode = judge0Service.getStarterCode(language, problemTitle || 'Coding Problem');
    
    res.json({
      success: true,
      language: language,
      starterCode: starterCode
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to generate starter code'
    });
  }
});

// Test code compilation (for admin to test their coding problems)
router.post('/coding/test-compile', async (req, res) => {
  try {
    const { sourceCode, language, testInput, expectedOutput } = req.body;
    
    if (!sourceCode || !language) {
      return res.status(400).json({
        success: false,
        message: 'Source code and language are required'
      });
    }

    const languageId = judge0Service.languageIds[language];
    if (!languageId) {
      return res.status(400).json({
        success: false,
        message: `Unsupported language: ${language}`
      });
    }

    const result = await judge0Service.submitCode(sourceCode, languageId, testInput, expectedOutput);
    
    res.json({
      success: true,
      result: {
        output: result.stdout,
        stderr: result.stderr,
        status: result.status,
        executionTime: result.time,
        memory: result.memory,
        passed: result.status?.id === 3 && result.stdout?.trim() === expectedOutput?.trim()
      }
    });

  } catch (error) {
    console.error('Code compilation test failed:', error);
    res.status(500).json({
      success: false,
      message: 'Code compilation failed',
      error: error.message
    });
  }
});

// Get coding test results with detailed analysis
router.get('/coding/test-results/:testId', async (req, res) => {
  try {
    const { testId } = req.params;
    
    const results = await Result.find({ 
      testId: testId, 
      submissionType: 'coding_submission' 
    })
    .populate('studentId', 'name email rollNumber')
    .sort({ obtainedMarks: -1 });

    const testDetails = await Test.findById(testId);
    
    if (!testDetails || !testDetails.isCodingTest) {
      return res.status(404).json({
        success: false,
        message: 'Coding test not found'
      });
    }

    // Calculate statistics
    const totalSubmissions = results.length;
    const scores = results.map(r => r.obtainedMarks);
    const averageScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const maxScore = scores.length > 0 ? Math.max(...scores) : 0;
    const minScore = scores.length > 0 ? Math.min(...scores) : 0;
    
    // Test case pass rates
    const testCaseStats = {};
    results.forEach(result => {
      if (result.codingSubmission && result.codingSubmission.testResults) {
        result.codingSubmission.testResults.results.forEach((tcResult, index) => {
          if (!testCaseStats[index]) {
            testCaseStats[index] = { passed: 0, total: 0 };
          }
          testCaseStats[index].total++;
          if (tcResult.passed) {
            testCaseStats[index].passed++;
          }
        });
      }
    });

    res.json({
      success: true,
      testDetails: {
        title: testDetails.title,
        language: testDetails.codingLanguage,
        totalMarks: testDetails.totalMarks,
        totalTestCases: testDetails.codingProblem?.testCases?.length || 0
      },
      statistics: {
        totalSubmissions,
        averageScore: Math.round(averageScore * 100) / 100,
        maxScore,
        minScore,
        passRate: totalSubmissions > 0 ? (results.filter(r => r.obtainedMarks >= testDetails.passingMarks).length / totalSubmissions * 100) : 0
      },
      testCaseStats,
      results: results.map(result => ({
        student: result.studentId,
        score: result.obtainedMarks,
        totalMarks: result.totalMarks,
        percentage: result.percentage,
        passedTests: result.codingSubmission?.passedTestCases || 0,
        totalTests: result.codingSubmission?.totalTestCases || 0,
        submittedAt: result.submittedAt,
        timeTaken: result.timeTaken,
        language: result.codingSubmission?.language
      }))
    });

  } catch (error) {
    console.error('Error fetching coding test results:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch test results'
    });
  }
});

// Mount manual test entry routes
router.use('/', manualTestEntryRoutes);

// ===============================================
// CODING ADMIN PANEL ROUTES
// ===============================================

// Get all coding tests for comprehensive admin review
router.get('/coding-tests-comprehensive', async (req, res) => {
  try {
    console.log('📊 Fetching comprehensive coding tests for admin panel...');
    
    const Result = require('../models/Result');
    const Student = require('../models/Student');
    const Test = require('../models/Test');
    
    // Find all results that are coding tests
    const codingResults = await Result.find({
      $or: [
        { 'testId.type': 'coding' },
        { submissionType: 'multi_question_coding' },
        { codingResults: { $exists: true } },
        { testTitle: { $regex: 'cpcode|coding|program', $options: 'i' } }
      ]
    })
    .populate('studentId', 'name email')
    .populate('testId', 'title type duration')
    .sort({ submittedAt: -1 })
    .lean();

    // Enrich data with additional metadata
    const enrichedResults = codingResults.map(result => ({
      ...result,
      isFlagged: result.flags?.timeViolation || result.flags?.codePatterns || result.flags?.behaviorAnomaly || false,
      adminReviewed: result.adminReviewed || false,
      adminModified: result.modifiedMarks ? true : false,
      totalScore: result.modifiedMarks?.totalScore || result.totalScore || 0,
      maxScore: result.maxScore || 100,
      timeTaken: result.timeTaken || result.duration || 0,
      testTitle: result.testTitle || result.testId?.title || 'Unknown Test',
      violations: result.violations || [],
      monitoringData: {
        tabSwitches: result.monitoringData?.tabSwitches || 0,
        fullscreenExits: result.monitoringData?.fullscreenExits || 0,
        copyPasteEvents: result.monitoringData?.copyPasteEvents || 0,
        suspiciousActivity: result.monitoringData?.suspiciousActivity || false
      }
    }));

    console.log(`✅ Found ${enrichedResults.length} coding test submissions`);
    
    res.json({
      success: true,
      tests: enrichedResults,
      summary: {
        total: enrichedResults.length,
        flagged: enrichedResults.filter(t => t.isFlagged).length,
        reviewed: enrichedResults.filter(t => t.adminReviewed).length,
        pending: enrichedResults.filter(t => !t.adminReviewed).length
      }
    });

  } catch (error) {
    console.error('❌ Error fetching comprehensive coding tests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch coding tests',
      error: error.message
    });
  }
});

// Modify coding test marks and flags
router.put('/modify-coding-marks', async (req, res) => {
  try {
    console.log('🔧 Modifying coding test marks...');
    
    const { 
      resultId, 
      modifiedMarks, 
      adminNotes, 
      cheatingFlags, 
      adminReviewed, 
      modifiedBy,
      modificationTimestamp 
    } = req.body;

    if (!resultId) {
      return res.status(400).json({
        success: false,
        message: 'Result ID is required'
      });
    }

    const Result = require('../models/Result');
    
    // Find the result
    const result = await Result.findById(resultId);
    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Result not found'
      });
    }

    // Update the result with modified data
    const updateData = {
      modifiedMarks,
      adminNotes,
      adminReviewed: true,
      modifiedBy: modifiedBy || 'admin',
      modificationTimestamp: modificationTimestamp || new Date().toISOString()
    };

    // Update flags if provided
    if (cheatingFlags) {
      updateData.flags = {
        ...result.flags,
        ...cheatingFlags,
        adminFlagged: true,
        adminFlaggedAt: new Date().toISOString()
      };
      
      // Set overall flagged status if any flag is true
      updateData.isFlagged = Object.values(cheatingFlags).some(flag => flag === true);
    }

    // If marks were modified, update the total score
    if (modifiedMarks && modifiedMarks.totalScore !== undefined) {
      updateData.totalScore = modifiedMarks.totalScore;
      updateData.isMarksModified = true;
    }

    const updatedResult = await Result.findByIdAndUpdate(
      resultId,
      updateData,
      { new: true }
    );

    console.log(`✅ Updated coding test result for result ID: ${resultId}`);

    res.json({
      success: true,
      message: 'Coding test marks updated successfully',
      result: updatedResult
    });

  } catch (error) {
    console.error('❌ Error modifying coding marks:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to modify coding marks',
      error: error.message
    });
  }
});

// Flag a test for cheating review
router.post('/flag-cheating', async (req, res) => {
  try {
    console.log('🚩 Flagging test for cheating review...');
    
    const { resultId, reason, flaggedBy, timestamp } = req.body;

    if (!resultId || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Result ID and reason are required'
      });
    }

    const Result = require('../models/Result');
    
    const updateData = {
      isFlagged: true,
      cheatingFlag: {
        reason,
        flaggedBy: flaggedBy || 'admin',
        timestamp: timestamp || new Date().toISOString(),
        status: 'pending_review'
      },
      $push: {
        adminActions: {
          action: 'flagged_for_cheating',
          reason,
          performedBy: flaggedBy || 'admin',
          timestamp: timestamp || new Date().toISOString()
        }
      }
    };

    const updatedResult = await Result.findByIdAndUpdate(
      resultId,
      updateData,
      { new: true }
    );

    if (!updatedResult) {
      return res.status(404).json({
        success: false,
        message: 'Result not found'
      });
    }

    console.log(`🚩 Flagged result ${resultId} for cheating review`);

    res.json({
      success: true,
      message: 'Test flagged for review successfully',
      result: updatedResult
    });

  } catch (error) {
    console.error('❌ Error flagging test:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to flag test',
      error: error.message
    });
  }
});

// Get detailed monitoring data for a specific result
router.get('/monitoring-details/:resultId', async (req, res) => {
  try {
    console.log('📊 Fetching detailed monitoring data...');
    
    const { resultId } = req.params;
    const Result = require('../models/Result');
    
    const result = await Result.findById(resultId)
      .populate('studentId', 'name email')
      .populate('testId', 'title type duration')
      .lean();

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Result not found'
      });
    }

    // Extract comprehensive monitoring data
    const monitoringData = {
      basic: {
        submittedAt: result.submittedAt,
        timeTaken: result.timeTaken,
        testDuration: result.testId?.duration,
        submissionType: result.submissionType
      },
      violations: result.violations || [],
      tabActivity: {
        switches: result.monitoringData?.tabSwitches || 0,
        suspiciousPatterns: result.monitoringData?.suspiciousTabActivity || []
      },
      fullscreenActivity: {
        exits: result.monitoringData?.fullscreenExits || 0,
        timeline: result.monitoringData?.fullscreenTimeline || []
      },
      copyPasteEvents: result.monitoringData?.copyPasteEvents || 0,
      codeAnalysis: {
        patterns: result.codeAnalysis?.patterns || [],
        similarity: result.codeAnalysis?.similarity || null,
        complexity: result.codeAnalysis?.complexity || null
      },
      browserInfo: result.browserInfo || {},
      geolocation: result.geolocation || null,
      deviceInfo: result.deviceInfo || {}
    };

    res.json({
      success: true,
      student: result.studentId,
      test: result.testId,
      monitoringData
    });

  } catch (error) {
    console.error('❌ Error fetching monitoring details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch monitoring details',
      error: error.message
    });
  }
});

// OAuth Disconnect endpoint
router.delete('/oauth-disconnect', async (req, res) => {
  try {
    console.log('🔒 OAuth disconnect requested');
    
    // Clear any OAuth tokens or sessions
    // Note: Adjust this based on your OAuth implementation
    if (req.session) {
      req.session.oauthTokens = null;
      req.session.googleCredentials = null;
    }
    
    console.log('✅ OAuth disconnected successfully');
    res.json({
      success: true,
      message: 'OAuth disconnected successfully'
    });

  } catch (error) {
    console.error('❌ Error disconnecting OAuth:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to disconnect OAuth',
      error: error.message
    });
  }
});

console.log('📝 Admin routes module loaded successfully');

module.exports = router;
