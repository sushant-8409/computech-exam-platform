/* routes/adminReview.js */
const express  = require('express');
const mongoose = require('mongoose');
const router   = express.Router();

const Result        = require('../models/Result');
const ReviewResult  = require('../models/ReviewResult');
const Test          = require('../models/Test');
const { authenticateAdmin } = require('../middleware/auth');
const notificationService   = require('../services/notificationService');

/* helper – compact dto for the list pane */
function dto(row, reviewMode = false) {
  return {
    ...row.toObject(),
    reviewMode,
    studentName: row.studentId?.name,
    testTitle:   row.testId?.title
  };
}

/* ────────────────────────────────────────────────────────── */
/*  GET  /results-for-review                                  */
/*    • pending results  (full marking)                       */
/*    • reviewResults (status under review)                   */
/* ────────────────────────────────────────────────────────── */
router.get('/results-for-review', authenticateAdmin, async (_req, res) => {
  try {
    /* pending results */
    const pending = await Result.find({ status: 'pending' })
      .populate('studentId', 'name email')
      .populate('testId', 'title totalMarks questionsCount');

    /* under-review subset rows */
    const under = await ReviewResult.find({ status: 'under review' })
      .populate('studentId', 'name email')
      .populate('testId', 'title totalMarks questionsCount');

    const list = [
      ...pending.map(r => dto(r, false)),
      ...under.map(r => dto(r, true))
    ];

    res.json({ success: true, results: list });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

/* ────────────────────────────────────────────────────────── */
/*  PATCH  /results/:id/marks  → PENDING → PUBLISHED          */
/* ────────────────────────────────────────────────────────── */
router.patch('/results/:id/marks', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      questionWiseMarks,
      marksObtained,
      percentage,
      adminComments
    } = req.body;

    const result = await Result.findById(id).orFail();

    /* full replace – status becomes published */
    result.questionWiseMarks = questionWiseMarks;
    result.marksObtained     = marksObtained;
    result.totalMarks        = result.testId
      ? (await Test.findById(result.testId).select('totalMarks')).totalMarks
      : result.totalMarks;
    result.percentage        = percentage;
    result.adminComments     = adminComments;
    result.status            = 'published';
    result.markedBy          = req.user._id;
    result.markedAt          = new Date();
    await result.save();

    /* notify */
    await notificationService.sendNotification(
      req.user._id,
      'result_published',
      `📊 Result Published: ${result.testTitle}`,
      `${percentage}% marks finalised.`,
      { resultData: {
          _id: result._id,
          studentName: result.studentId?.name,
          studentEmail: result.studentId?.email,
          testTitle: result.testTitle,
          marksObtained,
          totalMarks: result.totalMarks,
          percentage,
          status: 'published'
      }}
    );

    res.json({ success: true, result });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
});

/* ────────────────────────────────────────────────────────── */
/*  PATCH  /review-results/:id/marks  → UNDER → REVIEWED      */
/* ────────────────────────────────────────────────────────── */
/* PATCH  /api/admin/review-results/:id/marks
   – merges the edited questions
   – recalculates scores
   – sets status:
       • if Result.status was 'pending'      -> 'published'
       • if Result.status was 'under review' -> 'reviewed'
   – deletes the ReviewResult document
*/
/* PATCH  /api/admin/review-results/:id/marks  */
/* ──────────────────────────────────────────────────────────────── */
/* PATCH  /api/admin/review-results/:id/marks                       */
/*   • updates ONLY the questions under review                      */
/*   • recalculates totals                                          */
/*   • sets status → reviewed, deletes ReviewResult row             */
/* ──────────────────────────────────────────────────────────────── */
router.patch(
  '/review-results/:id/marks',
  authenticateAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { questionWiseMarks = [], adminComments = '' } = req.body;

      /* 1 ▸ fetch docs */
      const rr = await ReviewResult.findById(id).orFail();
      const result = await Result.findOne({
        studentId: rr.studentId,
        testId:    rr.testId
      })
        .populate('testId', 'totalMarks')
        .orFail();

      if (result.status !== 'under review') {
        return res
          .status(409)
          .json({ success: false, message: 'Not under review' });
      }

      /* 2 ▸ build a Set of question numbers under review            */
      const reviewSet = new Set(rr.questionWiseMarks.map(q => q.questionNo));

      /* 3 ▸ merge ONLY those questions                              */
      const updatedMap = new Map();
      result.questionWiseMarks.forEach(q => {
        /* clone existing */
        updatedMap.set(q.questionNo, { ...q });
      });

      /* apply incoming edits but only if that Q is in reviewSet     */
      questionWiseMarks.forEach(q => {
        if (reviewSet.has(q.questionNo)) {
          const current = updatedMap.get(q.questionNo) || {};
          updatedMap.set(q.questionNo, { ...current, ...q });
        }
      });

      const merged = [...updatedMap.values()].sort(
        (a, b) => a.questionNo - b.questionNo
      );

      /* 4 ▸ recalc totals                                            */
      const marksObtained = merged.reduce(
        (s, q) => s + (Number(q.obtainedMarks) || 0),
        0
      );
      const totalMarks =
        result.testId.totalMarks ||
        merged.reduce((s, q) => s + (Number(q.maxMarks) || 0), 0);
      const percentage = totalMarks
        ? +((marksObtained / totalMarks) * 100).toFixed(2)
        : 0;

      /* 5 ▸ persist Result                                           */
      Object.assign(result, {
        questionWiseMarks: merged,
        marksObtained,
        totalMarks,
        percentage,
        adminComments,
        status: 'reviewed',
        markedBy: req.user._id,
        markedAt: new Date()
      });
      await result.save();

      /* 6 ▸ delete ReviewResult row                                  */
      await ReviewResult.deleteOne({ _id: id });

      /* 7 ▸ notify (unchanged)                                       */
      await notificationService.sendNotification(
        req.user._id,
        'result_published',
        `📊 Result Reviewed: ${result.testTitle}`,
        `${percentage}% marks finalised.`,
        {
          resultData: {
            _id: result._id,
            studentName: result.studentId?.name,
            studentEmail: result.studentId?.email,
            testTitle: result.testTitle,
            marksObtained,
            totalMarks,
            percentage,
            status: 'reviewed'
          }
        }
      );

      return res.json({ success: true, result });
    } catch (err) {
      console.error('review-patch', err.message);
      res.status(400).json({ success: false, message: err.message });
    }
  }
);




module.exports = router;
