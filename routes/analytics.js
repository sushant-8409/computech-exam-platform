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
    const totalTests = await Test.countDocuments();
    const totalSubmissions = await Result.countDocuments();
    const pendingReviews = await Result.countDocuments({ status: 'done' });

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

    /* ---- top performers ----------------------------- */
    const topPerformers = await Result.aggregate([
      { $match: { totalMarks: { $gt: 0 }, marksObtained: { $gte: 0 } } },
      {
        $group: {
          _id: '$studentId',
          avgScore: {
            $avg: { $multiply: [{ $divide: ['$marksObtained', '$totalMarks'] }, 100] }
          },
          testCount: { $sum: 1 },
          totalMarks: { $sum: '$marksObtained' }
        }
      },
      { $sort: { avgScore: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'students',
          localField: '_id',
          foreignField: '_id',
          as: 'studentInfo'
        }
      },
      { $unwind: '$studentInfo' },
      {
        $project: {
          _id: 1,
          name: '$studentInfo.name',
          email: '$studentInfo.email',
          rollNo: '$studentInfo.rollNo',
          avgScore: { $round: ['$avgScore', 2] },
          testCount: 1,
          totalMarks: 1
        }
      }
    ]);

    res.json({
      overall: {
        totalStudents,
        totalTests,
        totalSubmissions,
        pendingReviews,
        averageScore: overall[0]?.averageScore || 0,
        passRate: overall[0]?.passRate || 0
      },
      subjectPerformance,
      topPerformers
    });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ success: false, message: 'Failed to generate analytics' });
  }
});

/* -------------------------------------------------
   GET  /api/admin/analytics/recent-activity
   -------------------------------------------------*/
router.get('/admin/analytics/recent-activity', authenticateAdmin, async (req, res) => {
  try {
    console.log('🕒 /admin/analytics/recent-activity hit');

    const recentActivity = await Result.aggregate([
      { $match: { submittedAt: { $exists: true } } },
      { $sort: { submittedAt: -1 } },
      { $limit: 20 },
      {
        $lookup: {
          from: 'students',
          localField: 'studentId',
          foreignField: '_id',
          as: 'studentInfo'
        }
      },
      { $unwind: '$studentInfo' },
      {
        $lookup: {
          from: 'tests',
          localField: 'testId',
          foreignField: '_id',
          as: 'testInfo'
        }
      },
      { $unwind: { path: '$testInfo', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          studentName: '$studentInfo.name',
          testTitle: { $ifNull: ['$testInfo.title', '$testTitle'] },
          subject: 1,
          submittedAt: 1,
          percentage: {
            $multiply: [{ $divide: ['$marksObtained', '$totalMarks'] }, 100]
          }
        }
      }
    ]);

    // Return array directly so frontend can rely on response.data being an array
    console.log('🕒 Recent activity data:', { count: recentActivity.length, data: recentActivity.slice(0, 3) });
    res.json(recentActivity);
  } catch (err) {
    console.error('Recent activity error:', err);
    res.status(500).json({ success: false, message: 'Failed to load recent activity' });
  }
});


/* -------------------------------------------------
   GET  /api/admin/analytics/grade-distribution
   Returns an array of { grade, count, percentage }
   -------------------------------------------------*/
router.get('/admin/analytics/grade-distribution', authenticateAdmin, async (req, res) => {
  try {
    console.log('📊 /admin/analytics/grade-distribution hit');

    const results = await Result.find({
      marksApproved: true,
      marksObtained: { $exists: true },
      totalMarks: { $exists: true }
    }).select('marksObtained totalMarks');

    const gradeDistribution = { 'A+': 0, 'A': 0, 'B+': 0, 'B': 0, 'C': 0, 'F': 0 };
    let total = 0;

    results.forEach(r => {
      const mo = Number(r.marksObtained);
      const tm = Number(r.totalMarks);
      if (!Number.isFinite(mo) || !Number.isFinite(tm) || tm <= 0) return;
      total++;
      const percentage = (mo / tm) * 100;
      if (percentage >= 90) gradeDistribution['A+']++;
      else if (percentage >= 80) gradeDistribution['A']++;
      else if (percentage >= 70) gradeDistribution['B+']++;
      else if (percentage >= 60) gradeDistribution['B']++;
      else if (percentage >= 50) gradeDistribution['C']++;
      else gradeDistribution['F']++;
    });

    const array = Object.keys(gradeDistribution).map(k => ({
      grade: k,
      count: gradeDistribution[k],
      percentage: total ? Math.round((gradeDistribution[k] / total) * 100) : 0
    }));

    console.log('📊 Grade distribution data:', { total, array });
    res.json(array);
  } catch (err) {
    console.error('Grade distribution error:', err);
    res.status(500).json([]);
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
                _id: 1,
                testTitle: '$testTitle',
                marksObtained: '$marksObtained',
                totalMarks: '$totalMarks',
                status: '$status',
                subject: '$subject',
                submittedAt: '$submittedAt',
                percentage: {
                  $multiply: [{ $divide: ['$marksObtained', '$totalMarks'] }, 100]
                }
              }
            },
            { $sort: { submittedAt: -1 } }
          ]
        }
      },
      /* calculate student analytics */
      {
        $addFields: {
          avgScore: {
            $avg: {
              $map: {
                input: '$results',
                as: 'result',
                in: {
                  $multiply: [
                    { $divide: ['$$result.marksObtained', '$$result.totalMarks'] },
                    100
                  ]
                }
              }
            }
          },
          passRate: {
            $multiply: [
              {
                $divide: [
                  {
                    $size: {
                      $filter: {
                        input: '$results',
                        as: 'result',
                        cond: {
                          $gte: [
                            { $divide: ['$$result.marksObtained', '$$result.totalMarks'] },
                            0.6
                          ]
                        }
                      }
                    }
                  },
                  { $max: [{ $size: '$results' }, 1] }
                ]
              },
              100
            ]
          }
        }
      }
    ]);

    res.json(student || null);
  } catch (err) {
    console.error('Student search error:', err);
    res.status(500).json({ success: false, message: 'Student search failed' });
  }
});

module.exports = router;
