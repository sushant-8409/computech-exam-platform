// routes/adminReviewResults.js
const express = require('express');
const router  = express.Router();
const Result        = require('../models/Result');
const Test          = require('../models/Test');
const ReviewResult  = require('../models/ReviewResult');
const { authenticateAdmin } = require('../middleware/auth');
const mongoose = require('mongoose');
router.use(authenticateAdmin);

/**
 * POST /api/admin/review-results/:resultId
 * Creates a ReviewResult record including answerSheetUrl and questionPaperUrl.
 */
router.post(
  '/review-results/:resultId',
  async (req, res, next) => {
    try {
      const { resultId } = req.params;
      const result = await Result.findById(resultId).lean();
      if (!result) {
        return res.status(404).json({ success: false, message: 'Result not found' });
      }

      // Fetch the Test to get questionPaperUrl
      const test = await Test.findById(result.testId).lean();
      if (!test) {
        return res.status(404).json({ success: false, message: 'Test not found' });
      }

      // Assemble ReviewResult document
      const reviewDoc = {
        studentId:        result.studentId,
        testId:           result.testId,
        answerSheetUrl:   result.answerSheetUrl,
        questionPaperUrl: test.questionPaperUrl || null,
        marksObtained:    result.marksObtained,
        totalMarks:       result.totalMarks,
        questionWiseMarks: result.questionWiseMarks,
        adminComments:    result.adminComments || '',
        status:           'pending'
      };

      // Save and respond
      const reviewResult = await ReviewResult.create(reviewDoc);
      res.json({ success: true, reviewResult });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
