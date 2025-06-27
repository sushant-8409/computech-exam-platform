// routes/analytics.js
const express  = require('express');
const router   = express.Router();
const Result   = require('../models/Result');
const Student  = require('../models/Student');

/* -------------------------------------------------
   GET  /api/admin/analytics
   -------------------------------------------------*/
router.get('/admin/analytics', async (req, res) => {
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
            $avg: { $multiply: [ { $divide: ['$marksObtained', '$totalMarks'] }, 100 ] }
          },
          passRate: {
            $avg: {
              $cond: [ { $gte: ['$marksObtained', '$test.passingMarks'] }, 1, 0 ]
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          averageScore: { $round: ['$averageScore', 2] },
          passRate:     { $round: [ { $multiply: ['$passRate', 100] }, 2 ] }
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
            $avg: { $multiply: [ { $divide: ['$marksObtained', '$totalMarks'] }, 100 ] }
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
        passRate:     overall[0]?.passRate     || 0
      },
      subjectPerformance
    });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ success:false, message:'Failed to generate analytics' });
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
            { name:   { $regex: term, $options: 'i' } },
            { email:  { $regex: term, $options: 'i' } },
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
                testTitle:     '$testTitle',
                marksObtained: '$marksObtained',
                totalMarks:    '$totalMarks',
                status:        '$status',
                submittedAt:   '$submittedAt',
                subject:       '$test.subject'
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
    res.status(500).json({ success:false, message:'Student search failed' });
  }
});
// In your analytics.js router file

// Grade distribution endpoint
router.get('/admin/analytics/grade-distribution', async (req, res) => {
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

// Recent activity endpoint
router.get('/admin/recent-activity', async (req, res) => {
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
