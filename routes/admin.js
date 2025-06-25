const express = require('express');
const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const multer = require('multer');
const router = express.Router();
const moment = require('moment-timezone');
const nowIST = moment().tz('Asia/Kolkata').toDate();
const testController = require('../controllers/testController'); // Adjust path as neede
const studentController = require('../controllers/StudentController');
// Adjust path as needed
const Notification = require('../models/Notification');
const NotificationSettings = require('../models/NotificationSettings');
const { uploadToGDrive } = require('../services/gdrive'); // Adjust path as neede
const upload = multer({ storage: multer.memoryStorage() });
const notificationService = require('../services/notificationService');
const SYSTEM_ADMIN_ID = '000000000000000000000001';
const ReviewResult   = require('../models/ReviewResult');
const { authenticateAdmin } = require('../middleware/auth');

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
router.get('/dashboard/stats', async (req, res) => {
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
router.get('/result/:resultId', async (req, res) => {
  try {
    const { resultId } = req.params;
    const result = await Result.findById(resultId)
      .populate('studentId', 'name email class board')
      .populate('testId', 'title subject');
    if (!result) {
      return res.status(404).json({ success: false, message: 'Result not found' });
    }
    res.json({ success: true, result });
  } catch (error) {
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
          .populate('testId', 'title subject questionsCount totalMarks')
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
      charts
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
        proctoringSettings = {}
      } = req.body;

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
        proctoringSettings
      });

      res.status(201).json({
        success: true,
        message: 'Test created successfully',
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
      const fileData = {};
      const nowIST = moment().tz('Asia/Kolkata');

      for (const field of ['questionPaper', 'answerKey']) {
        const fileArr = req.files[field];
        if (!fileArr?.[0]) continue;

        const file = fileArr[0];
        const sanitizedFilename = file.originalname.replace(/[^a-z0-9_.-]/gi, '_');
        const gdriveFileName = `${nowIST.format('YYYYMMDD-HHmmss')}_${sanitizedFilename}`;

        const uploadResult = await uploadToGDrive(
          file.buffer,
          gdriveFileName,
          file.mimetype
        );

        fileData[field] = {
          url: uploadResult.url,       // Permanent Google Drive preview URL
          fileId: uploadResult.fileId, // Google Drive file ID
          originalName: file.originalname
        };
      }

      res.json({
        success: true,
        message: 'Files uploaded to Google Drive successfully',
        data: fileData
      });

    } catch (err) {
      console.error('⚠️ Google Drive upload error:', err);
      res.status(500).json({
        success: false,
        message: process.env.NODE_ENV === 'development'
          ? `Google Drive upload failed: ${err.message}`
          : 'File upload failed. Please try again.'
      });
    }
  }
);


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

router.get('/notification-settings', async (req, res) => {
  try {
    const settings = await NotificationSettings.findOne() || {};
    res.json({ success: true, settings });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch settings' });
  }
});

router.post('/notification-settings', async (req, res) => {
  try {
    const { settings } = req.body;

    await NotificationSettings.findOneAndUpdate(
      {},
      { $set: settings },
      { upsert: true, new: true }
    );

    res.json({ success: true, message: 'Settings saved successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to save settings' });
  }
});

console.log('📝 Admin routes module loaded successfully');

module.exports = router;
