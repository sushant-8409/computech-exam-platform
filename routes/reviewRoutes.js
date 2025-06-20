/* routes/reviewRoutes.js  — mount once with
   app.use('/api/admin', require('./routes/reviewRoutes'));
------------------------------------------------------------------- */

const express = require('express');
const router  = express.Router();

const Result       = require('../models/Result');
const ReviewResult = require('../models/ReviewResult');

/* ─────────────────────  admin guard (no-op fallback)  ─────────────────── */
let guard = (_req, _res, next) => next();
try {
  const { isAdmin } = require('../middleware/auth');
  if (typeof isAdmin === 'function') guard = isAdmin;
} catch { console.warn('⚠ isAdmin middleware missing – review routes are open'); }

const aw = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
/* ----------------------------------------------------------------------- */

/* 1. list results needing attention ------------------------------------- */
router.get('/reviews', guard, aw(async (_req, res) => {
  const rows = await Result.find({ status: { $in: ['pending', 'under review'] } })
    .populate({ path: 'student', select: 'name email' })   // virtual in Result model
    .populate({ path: 'test',    select: 'title' })
    .lean();
  res.json(rows);
}));

/* 2. meta for a single result ------------------------------------------- */
router.get('/reviews/:id', guard, aw(async (req, res) => {
  const doc = await Result.findById(req.params.id)
    .populate({ path: 'student', select: 'name email' })
    .populate('test')
    .lean();
  if (!doc) return res.status(404).json({ msg: 'Result not found' });
  res.json(doc);
}));

/* 3. QUESTIONS TO SHOW IN THE GRID -------------------------------------- */
router.get('/reviews/:id/questions', guard, aw(async (req, res) => {
  const result = await Result.findById(req.params.id).lean();
  if (!result) return res.status(404).json({ msg: 'Result not found' });

  let questions = [];
  let maxMarks  = [];

  /* —— PENDING  → use the data already inside Result ——————————— */
  if (result.status === 'pending') {
    if (Array.isArray(result.questionWiseMarks) && result.questionWiseMarks.length) {
      questions = result.questionWiseMarks.map(q => q.questionNo);
      maxMarks  = result.questionWiseMarks.map(q => q.maxMarks ?? 0);
    }
  }

  /* —— UNDER REVIEW  → pick list from ReviewResult ——————————— */
  else if (result.status === 'under review') {
    const rev = await ReviewResult.findOne({
      studentId: result.studentId,
      testId:    result.testId
    }).lean();

    /* support either shape: {questions:[..]} or {questionWiseMarks:[..]} */
    if (rev?.questions?.length) {
      questions = rev.questions;
      maxMarks  = rev.questions.map(qNo => {
        const row = (result.questionWiseMarks || []).find(r => r.questionNo === qNo);
        return row?.maxMarks ?? 0;
      });
    } else if (rev?.questionWiseMarks?.length) {
      questions = rev.questionWiseMarks.map(r => r.questionNo);
      maxMarks  = rev.questionWiseMarks.map(r => r.maxMarks ?? 0);
    }
  }

  /* always succeed – empty arrays just render an empty table */
  res.json({ questions, maxMarks });
}));

/* 4. PATCH MARKS + FLIP STATUS + DELETE REVIEW ROW ---------------------- */
router.put('/reviews/:id/grade', guard, aw(async (req, res) => {
  const { marks } = req.body;           // [{ q:<num>, marks:<num> }]
  if (!Array.isArray(marks))
    return res.status(400).json({ msg: 'marks must be an array' });

  const result = await Result.findById(req.params.id);
  if (!result) return res.status(404).json({ msg: 'Result not found' });

  let total = 0;
  (result.questionWiseMarks || []).forEach(item => {
    const edit = marks.find(e => e.q === item.questionNo);
    if (edit) item.obtainedMarks = edit.marks;
    total += item.obtainedMarks;                 // accumulate after possible edit
  });

  result.marksObtained = total;

  if (result.status === 'pending') {            // → published
    result.status = 'published';
  } else if (result.status === 'under review') {// → reviewed & drop review row
    result.status = 'reviewed';
    await ReviewResult.deleteOne({ studentId: result.studentId, testId: result.testId });
  }

  await result.save();
  res.json({ msg: 'Saved', total });
}));

module.exports = router;
