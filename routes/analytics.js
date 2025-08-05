// routes/analytics.js
const express = require('express');
const router = express.Router();
const Result = require('../models/Result');
const Student = require('../models/Student');
const Test = require('../models/Test');
const { authenticateAdmin } = require('../middleware/auth');

/* -------------------------------------------------
   GET  /api/admin/analytics
   -------------------------------------------------*/
router.get('/admin/analytics', authenticateAdmin, async (req, res) => {
  try {
    console.log('📊  /admin/analytics hit');

    /* ---- basic counts ------------------------------------ */
    const totalStudents = await Student.countDocuments();

    /* ---- overall performance ----------------------------- */
    const overall = await Result.aggregate([
      /* convert testId → ObjectId in case it was saved as a string */
      { $addFields: { testId: { $convert: { input: '$testId', to: 'objectId', onError: '$testId', onNull: '$testId' } } } },

      { $match: { totalMarks: { $gt: 0 }, marksObtained: { $gte: 0 } } },

      /* join with tests collection so we know the passing marks */
      { $lookup: { from: 'tests', localField: 'testId', foreignField: '_id', as: 'test' } },
      { $unwind: '$test' },

      /* calculate averages */
      {
        $group: {
          _id: null,
          averageScore: {
            $avg: { $multiply: [{ $divide: ['$marksObtained', '$totalMarks'] }, 100] }
          },
          passRate: {
            $avg: {
              $cond: [{ $gte: ['$marksObtained', '$test.passingMarks'] }, 1, 0]
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          averageScore: { $round: ['$averageScore', 2] },
          passRate: { $round: [{ $multiply: ['$passRate', 100] }, 2] }
        }
      }
    ]);

    /* ---- subject-wise performance ------------------------- */
    const subjectPerformance = await Result.aggregate([
      { $addFields: { testId: { $convert: { input: '$testId', to: 'objectId', onError: '$testId', onNull: '$testId' } } } },
      { $match: { totalMarks: { $gt: 0 }, marksObtained: { $gte: 0 } } },
      { $lookup: { from: 'tests', localField: 'testId', foreignField: '_id', as: 'test' } },
      { $unwind: '$test' },
      {
        $group: {
          _id: '$test.subject',
          average: {
            $avg: { $multiply: [{ $divide: ['$marksObtained', '$totalMarks'] }, 100] }
          }
        }
      },
      {
        $project: {
          _id: 0,
          subject: '$_id',
          average: { $round: ['$average', 2] }
        }
      },
      { $sort: { average: -1 } }
    ]);

    res.json({
      overall: {
        totalStudents,
        averageScore: overall[0]?.averageScore || 0,
        passRate: overall[0]?.passRate || 0
      },
      subjectPerformance
    });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ success: false, message: 'Failed to generate analytics' });
  }
});

/* -------------------------------------------------
   GET  /api/students/search?query=...
   -------------------------------------------------*/
router.get('/students/search', async (req, res) => {
  try {
    const term = req.query.query?.trim();
    if (!term) return res.json(null);

    const [student] = await Student.aggregate([
      {
        $match: {
          $or: [
            { name: { $regex: term, $options: 'i' } },
            { email: { $regex: term, $options: 'i' } },
            { rollNo: { $regex: term, $options: 'i' } }
          ]
        }
      },
      /* pull recent test results */
      {
        $lookup: {
          from: 'results',
          localField: '_id',
          foreignField: 'studentId',
          as: 'results',
          pipeline: [
            { $lookup: { from: 'tests', localField: 'testId', foreignField: '_id', as: 'test' } },
            { $unwind: '$test' },
            {
              $project: {
                testTitle: '$testTitle',
                marksObtained: '$marksObtained',
                totalMarks: '$totalMarks',
                status: '$status',
                submittedAt: '$submittedAt',
                subject: '$test.subject'
              }
            }
          ]
        }
      },
      { $limit: 1 }
    ]);

    res.json(student || null);
  } catch (err) {
    console.error('Student search error:', err);
    res.status(500).json({ success: false, message: 'Student search failed' });
  }
});
// In your analytics.js router file

// Grade distribution endpoint
router.get('/admin/analytics/grade-distribution', authenticateAdmin, async (req, res) => {
  try {
    const gradeDistribution = await Result.aggregate([
      { $match: { totalMarks: { $gt: 0 }, marksObtained: { $gte: 0 } } },
      {
        $addFields: {
          percentage: { $multiply: [{ $divide: ['$marksObtained', '$totalMarks'] }, 100] }
        }
      },
      {
        $addFields: {
          grade: {
            $switch: {
              branches: [
                { case: { $gte: ['$percentage', 90] }, then: 'A+' },
                { case: { $gte: ['$percentage', 80] }, then: 'A' },
                { case: { $gte: ['$percentage', 70] }, then: 'B+' },
                { case: { $gte: ['$percentage', 60] }, then: 'B' },
                { case: { $gte: ['$percentage', 50] }, then: 'C' }
              ],
              default: 'F'
            }
          }
        }
      },
      {
        $group: {
          _id: '$grade',
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          grade: '$_id',
          count: 1,
          _id: 0
        }
      }
    ]);

    const totalStudents = gradeDistribution.reduce((sum, item) => sum + item.count, 0);
    const result = gradeDistribution.map(item => ({
      ...item,
      percentage: totalStudents > 0 ? Math.round((item.count / totalStudents) * 100) : 0
    }));

    res.json(result);
  } catch (error) {
    console.error('Grade distribution error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch grade distribution' });
  }
});
// Add these endpoints to your analytics.js file

/* -------------------------------------------------
   GET  /api/admin/dashboard/charts
   Monthly submissions and score distribution data
   -------------------------------------------------*/
router.get('/admin/dashboard/charts', authenticateAdmin, async (req, res) => {
  try {
    console.log('📊 /admin/dashboard/charts hit');

    // Monthly test submissions (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlySubmissions = await Result.aggregate([
      { $match: { submittedAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: {
            year: { $year: '$submittedAt' },
            month: { $month: '$submittedAt' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          month: '$_id.month',
          year: '$_id.year',
          count: 1
        }
      },
      { $sort: { year: 1, month: 1 } }
    ]);

    // Create monthly data array for last 6 months
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthly = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthData = monthlySubmissions.find(m =>
        m.month === date.getMonth() + 1 && m.year === date.getFullYear()
      );
      monthly.push(monthData ? monthData.count : 0);
    }

    // Score distribution
    const scoreDistribution = await Result.aggregate([
      { $match: { totalMarks: { $gt: 0 }, marksObtained: { $gte: 0 } } },
      {
        $addFields: {
          percentage: { $multiply: [{ $divide: ['$marksObtained', '$totalMarks'] }, 100] }
        }
      },
      {
        $addFields: {
          scoreRange: {
            $switch: {
              branches: [
                { case: { $gte: ['$percentage', 90] }, then: '90-100%' },
                { case: { $gte: ['$percentage', 80] }, then: '80-89%' },
                { case: { $gte: ['$percentage', 70] }, then: '70-79%' },
                { case: { $gte: ['$percentage', 60] }, then: '60-69%' }
              ],
              default: '<60%'
            }
          }
        }
      },
      {
        $group: {
          _id: '$scoreRange',
          count: { $sum: 1 }
        }
      }
    ]);

    // Create distribution array in correct order
    const ranges = ['90-100%', '80-89%', '70-79%', '60-69%', '<60%'];
    const distribution = ranges.map(range => {
      const found = scoreDistribution.find(item => item._id === range);
      return found ? found.count : 0;
    });

    res.json({
      charts: {
        monthly,
        distribution,
        labels: monthNames.slice(-6) // Last 6 month names
      }
    });

  } catch (error) {
    console.error('Charts data error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch charts data',
      charts: { monthly: [0, 0, 0, 0, 0, 0], distribution: [0, 0, 0, 0, 0] }
    });
  }
});

/* -------------------------------------------------
   GET  /api/admin/analytics/subject-performance
   Subject-wise performance data
   -------------------------------------------------*/
router.get('/admin/analytics/subject-performance', authenticateAdmin, async (req, res) => {
  try {
    console.log('📚 /admin/analytics/subject-performance hit');

    const subjectPerformance = await Result.aggregate([
      { $addFields: { testId: { $convert: { input: '$testId', to: 'objectId', onError: '$testId', onNull: '$testId' } } } },
      { $match: { totalMarks: { $gt: 0 }, marksObtained: { $gte: 0 } } },
      { $lookup: { from: 'tests', localField: 'testId', foreignField: '_id', as: 'test' } },
      { $unwind: '$test' },
      {
        $group: {
          _id: '$test.subject',
          averageScore: {
            $avg: { $multiply: [{ $divide: ['$marksObtained', '$totalMarks'] }, 100] }
          },
          totalTests: { $addToSet: '$testId' },
          totalSubmissions: { $sum: 1 },
          passedSubmissions: {
            $sum: {
              $cond: [{ $gte: ['$marksObtained', { $multiply: ['$totalMarks', 0.4] }] }, 1, 0]
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          subject: '$_id',
          averageScore: { $round: ['$averageScore', 2] },
          average: { $round: ['$averageScore', 2] }, // For compatibility
          totalTests: { $size: '$totalTests' },
          participationRate: {
            $round: [
              {
                $multiply: [
                  { $divide: ['$passedSubmissions', '$totalSubmissions'] },
                  100
                ]
              },
              2
            ]
          }
        }
      },
      { $sort: { averageScore: -1 } }
    ]);

    console.log('Subject performance result:', subjectPerformance);
    res.json(subjectPerformance);

  } catch (error) {
    console.error('Subject performance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subject performance',
      data: []
    });
  }
});

/* -------------------------------------------------
   GET  /api/admin/dashboard/stats
   Dashboard statistics
   -------------------------------------------------*/
router.get('/admin/dashboard/stats', authenticateAdmin, async (req, res) => {
  try {
    console.log('📊 /admin/dashboard/stats hit');

    const [
      totalStudents,
      totalTests,
      totalResults,
      pendingResults,
      todayResults
    ] = await Promise.all([
      Student.countDocuments(),
      require('../models/Test').countDocuments(),
      Result.countDocuments(),
      Result.countDocuments({ status: 'pending' }),
      Result.countDocuments({
        submittedAt: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0))
        }
      })
    ]);

    // Calculate average score
    const avgScoreResult = await Result.aggregate([
      { $match: { totalMarks: { $gt: 0 }, marksObtained: { $gte: 0 } } },
      {
        $group: {
          _id: null,
          averageScore: {
            $avg: { $multiply: [{ $divide: ['$marksObtained', '$totalMarks'] }, 100] }
          }
        }
      }
    ]);

    // Calculate pass rate
    const passRateResult = await Result.aggregate([
      { $match: { totalMarks: { $gt: 0 }, marksObtained: { $gte: 0 } } },
      {
        $group: {
          _id: null,
          passRate: {
            $avg: {
              $cond: [
                { $gte: ['$marksObtained', { $multiply: ['$totalMarks', 0.4] }] },
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    res.json({
      stats: {
        totalStudents,
        totalTests,
        activeTests: totalTests, // You can filter active tests if needed
        pendingResults,
        totalSubmissions: totalResults,
        submissionsToday: todayResults,
        averageScore: Math.round(avgScoreResult[0]?.averageScore || 0),
        passRate: Math.round((passRateResult[0]?.passRate || 0) * 100),
        newStudentsThisMonth: 0, // Add logic to calculate this if needed
        totalViolations: 0 // Add logic to calculate this if needed
      }
    });

  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard stats',
      stats: {}
    });
  }
});

// Recent activity endpoint
router.get('/admin/recent-activity', authenticateAdmin, async (req, res) => {
  try {
    const recentResults = await Result.find()
      .populate('studentId', 'name')
      .populate('testId', 'title')
      .sort({ submittedAt: -1 })
      .limit(10);

    const activities = recentResults.map(result => ({
      type: 'test_submitted',
      studentName: result.studentId?.name || 'Unknown Student',
      testTitle: result.testTitle || result.testId?.title || 'Unknown Test',
      timestamp: result.submittedAt || result.createdAt,
      status: result.status
    }));

    res.json(activities);
  } catch (error) {
    console.error('Recent activity error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch recent activity' });
  }
});

module.exports = router;
