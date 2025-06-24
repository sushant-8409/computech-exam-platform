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

/* ─────────── 3. ★ MAIN ROUTE: Questions for the grid ─────────── */
router.get('/reviews/:id/questions', guard, aw(async (req, res) => {
  const result = await Result.findById(req.params.id).lean();
  if (!result) return res.status(404).json({ msg: 'Result not found' });

  let questions = [];
  let maxMarks  = [];

  if (result.status === 'pending') {
    /* ── PENDING: Show ALL questions from Test model ── */
    const test = await Test.findById(result.testId).lean();
    if (!test) return res.status(404).json({ msg: 'Test not found' });

    const totalQuestions = test.questionsCount || 0;
    const totalTestMarks = test.totalMarks || 0;

    if (totalQuestions > 0) {
      // Build questions array [1, 2, 3, ..., N]
      questions = Array.from({ length: totalQuestions }, (_, i) => i + 1);
      
      // Distribute total marks equally among all questions
      const marksPerQuestion = totalTestMarks / totalQuestions;
      maxMarks = Array(totalQuestions).fill(marksPerQuestion);
    }

  } else if (result.status === 'under review') {
    /* ── UNDER REVIEW: Show only flagged questions ── */
    const rev = await ReviewResult.findOne({
      studentId: result.studentId,
      testId:    result.testId
    }).lean();

    if (rev && Array.isArray(rev.questions) && rev.questions.length) {
      // ReviewResult has a 'questions' array with question numbers
      questions = rev.questions;
      maxMarks  = rev.questions.map(qNo => {
        const row = (result.questionWiseMarks || []).find(r => r.questionNo === qNo);
        return row ? row.maxMarks : 0;
      });
    } else if (rev && Array.isArray(rev.questionWiseMarks) && rev.questionWiseMarks.length) {
      // ReviewResult stores questions in questionWiseMarks array
      questions = rev.questionWiseMarks.map(r => r.questionNo);
      maxMarks  = rev.questionWiseMarks.map(r => r.maxMarks || 0);
    }
  }

  res.json({ questions, maxMarks });
}));

/* ─────────── 4. Save marks and update status ─────────── */
/* ─────────── 4. Save marks, maxMarks, and remarks ─────────── */
router.put('/reviews/:id/grade', guard, aw(async (req, res) => {
  const { marks } = req.body;                 // [{ q, maxMarks, obtainedMarks, remarks }]
  if (!Array.isArray(marks))
    return res.status(400).json({ msg: 'marks must be an array' });

  const result = await Result.findById(req.params.id);
  if (!result) return res.status(404).json({ msg: 'Result not found' });

  let totalObtained = 0;
  let totalMax = 0;
  const currentMap = new Map();
  
  // Build map of existing questionWiseMarks
  (result.questionWiseMarks || []).forEach(item => {
    currentMap.set(item.questionNo, item);
  });

  // Process the submitted marks
  marks.forEach(({ q, maxMarks: newMaxMarks, obtainedMarks, remarks }) => {
    let item = currentMap.get(q);
    
    if (!item) {
      // Create new entry if it doesn't exist (for pending status)
      item = {
        questionNo:    q,
        maxMarks:      newMaxMarks || 0,
        obtainedMarks: obtainedMarks || 0,
        remarks:       remarks || '',
        markedBy:      null,
        markedAt:      new Date()
      };
      result.questionWiseMarks.push(item);
    } else {
      // Update existing entry
      item.maxMarks = newMaxMarks !== undefined ? newMaxMarks : item.maxMarks;
      item.obtainedMarks = obtainedMarks !== undefined ? obtainedMarks : item.obtainedMarks;
      item.remarks = remarks !== undefined ? remarks : item.remarks;
      item.markedAt = new Date();
    }
    
    totalObtained += item.obtainedMarks;
    totalMax += item.maxMarks;
  });

  // Calculate totals from ALL questions in result
  const allObtained = (result.questionWiseMarks || []).reduce((sum, item) => {
    return sum + (item.obtainedMarks || 0);
  }, 0);

  const allMaxMarks = (result.questionWiseMarks || []).reduce((sum, item) => {
    return sum + (item.maxMarks || 0);
  }, 0);

  result.marksObtained = allObtained;
  result.totalMarks = allMaxMarks;
  result.percentage = allMaxMarks > 0 ? Math.round((allObtained / allMaxMarks) * 100) : 0;

  // Update status based on current state
  if (result.status === 'pending') {
    result.status = 'published';
  } else if (result.status === 'under review') {
    result.status = 'reviewed';
    // Delete the ReviewResult document
    await ReviewResult.deleteOne({ 
      studentId: result.studentId, 
      testId: result.testId 
    });
  }

  await result.save();
  res.json({ 
    msg: 'Saved', 
    totalObtained: allObtained,
    totalMax: allMaxMarks,
    percentage: result.percentage
  });
}));


module.exports = router;
