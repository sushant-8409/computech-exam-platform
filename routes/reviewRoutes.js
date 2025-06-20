// routes/reviewRoutes.js
const express = require('express');
const router  = express.Router();

const Result       = require('../models/Result');
const Test         = require('../models/Test');
const ReviewResult = require('../models/ReviewResult');

/* ─────────── Admin guard ─────────── */
let guard = (_req, _res, next) => next();
try {
  const { isAdmin } = require('../middleware/auth');
  if (typeof isAdmin === 'function') guard = isAdmin;
} catch {
  console.warn('⚠  isAdmin not found – routes left open');
}

const aw = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/* ─────────── 1. List results needing review ─────────── */
router.get('/reviews', guard, aw(async (_req, res) => {
  const rows = await Result.find({ status: { $in: ['pending', 'under review'] } })
    .populate({ path: 'student', select: 'name email' })
    .populate({ path: 'test',    select: 'title' })
    .lean();
  res.json(rows);
}));

/* ─────────── 2. Single result meta ─────────── */
router.get('/reviews/:id', guard, aw(async (req, res) => {
  const doc = await Result.findById(req.params.id)
    .populate({ path: 'student', select: 'name email' })
    .populate('test')
    .lean();
  if (!doc) return res.status(404).json({ msg: 'Result not found' });
  res.json(doc);
}));

/* ─────────── 3. Questions for the grid ─────────── */
router.get('/reviews/:id/questions', guard, aw(async (req, res) => {
  const result = await Result.findById(req.params.id).lean();
  if (!result) return res.status(404).json({ msg: 'Result not found' });

  let questions = [];
  let maxMarks  = [];

  if (result.status === 'pending') {
    /* ── PENDING: build 1…N from test.questionsCount ── */
    const test = await Test.findById(result.testId).lean();
    if (!test || typeof test.questionsCount !== 'number') {
      return res.status(404).json({ msg: 'Test not found or questionsCount missing' });
    }

    const totalQuestions = test.questionsCount;
    const totalMarks = test.totalMarks || 0;

    // Build questions array [1, 2, 3, ..., N]
    questions = Array.from({ length: totalQuestions }, (_, i) => i + 1);
    
    // Distribute totalMarks equally among all questions
    const marksPerQuestion = totalQuestions > 0 ? totalMarks / totalQuestions : 0;
    maxMarks = Array(totalQuestions).fill(marksPerQuestion);

  } else if (result.status === 'under review') {
    /* ── UNDER REVIEW: use ReviewResult logic ── */
    const rev = await ReviewResult.findOne({
      studentId: result.studentId,
      testId:    result.testId
    }).lean();

    if (rev && Array.isArray(rev.questions) && rev.questions.length) {
      questions = rev.questions;
      maxMarks  = rev.questions.map(qNo => {
        const row = (result.questionWiseMarks || []).find(r => r.questionNo === qNo);
        return row ? row.maxMarks : 0;
      });
    } else if (rev && Array.isArray(rev.questionWiseMarks) && rev.questionWiseMarks.length) {
      questions = rev.questionWiseMarks.map(r => r.questionNo);
      maxMarks  = rev.questionWiseMarks.map(r => r.maxMarks || 0);
    }
  }

  res.json({ questions, maxMarks });
}));

/* ─────────── 4. Save marks and update status ─────────── */
/* ─────────── 4. Save marks and update status ─────────── */
router.put('/reviews/:id/grade', guard, aw(async (req, res) => {
  const { marks } = req.body;                 // [{ q, maxMarks, obtainedMarks }]
  if (!Array.isArray(marks))
    return res.status(400).json({ msg: 'marks must be an array' });

  const result = await Result.findById(req.params.id);
  if (!result) return res.status(404).json({ msg: 'Result not found' });

  let total = 0;
  marks.forEach(({ q, maxMarks: newMaxMarks, obtainedMarks }) => {
    let row = (result.questionWiseMarks || []).find(r => r.questionNo === q);

    if (!row) {
      // Create new entry if it doesn't exist
      row = {
        questionNo:    q,
        maxMarks:      newMaxMarks || 0,
        obtainedMarks: obtainedMarks || 0,
        remarks:       ''
      };
      result.questionWiseMarks.push(row);
    } else {
      // Update existing entry
      row.maxMarks = newMaxMarks || row.maxMarks;
      row.obtainedMarks = obtainedMarks;
    }

    total += row.obtainedMarks;
  });

  result.marksObtained = total;
  
  // Update totalMarks to reflect new maxMarks sum
  const newTotalMarks = result.questionWiseMarks.reduce((sum, item) => sum + item.maxMarks, 0);
  result.totalMarks = newTotalMarks;

  // Update status based on current state
  if (result.status === 'pending') {
    result.status = 'published';
  } else if (result.status === 'under review') {
    result.status = 'reviewed';
    await ReviewResult.deleteOne({ studentId: result.studentId, testId: result.testId });
  }

  await result.save();
  res.json({ msg: 'Saved', total: result.marksObtained, totalMarks: result.totalMarks });
}));


module.exports = router;
