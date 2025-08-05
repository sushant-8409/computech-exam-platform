const express = require('express');
const router = express.Router();

// Models
const Result = require('../models/Result');
const ReviewResult = require('../models/ReviewResult');
const Test = require('../models/Test');

// Middleware
const { authenticateAdmin } = require('../middleware/auth');


/* ==========================================================================
   1. GET PENDING & UNDER-REVIEW RESULTS FOR THE ADMIN LIST
   ========================================================================== */
router.get('/results-for-review', authenticateAdmin, async (req, res) => {
    try {
        const pending = await Result.find({ status: 'pending' }).populate('studentId', 'name').populate('testId', 'title').lean();
        const under = await ReviewResult.find({ status: 'under review' }).populate('studentId', 'name').populate('testId', 'title').lean();

        const makeItem = (row, reviewMode = false) => ({
            _id: row._id, reviewMode, status: row.status,
            studentName: row.studentId?.name || 'N/A',
            testTitle: row.testId?.title || row.testTitle || 'N/A',
            answerSheetUrl: row.answerSheetUrl ?? null, adminComments: row.adminComments ?? '',
            questionWiseMarks: row.questionWiseMarks || [],
            studentComments: row.studentComments || '',
        });

        const list = [...pending.map(r => makeItem(r, false)), ...under.map(r => makeItem(r, true))]
            .sort((a, b) => new Date(b._id.getTimestamp()) - new Date(a._id.getTimestamp()));

        res.json({ success: true, results: list });
    } catch (err) {
        console.error('Error fetching results for review:', err);
        res.status(500).json({ success: false, message: 'Server error fetching review list.' });
    }
});


/* ==========================================================================
   2. GET QUESTION DETAILS FOR THE GRADING GRID
   ========================================================================== */

router.get('/results/:id/questions', authenticateAdmin, async (req, res) => {
    try {
        const result = await Result.findById(req.params.id).select('testId').lean();
        if (!result) return res.status(404).json({ success: false, message: 'Result not found.' });

        const test = await Test.findById(result.testId).select('questions questionsCount questionPaperURL answerKeyURL').lean();
        if (!test) return res.status(404).json({ success: false, message: 'Associated test not found.' });

        let questionsToGrade = [];
        if (test.questions && test.questions.length > 0) {
            questionsToGrade = test.questions.map(q => ({ questionNo: q.questionNo, maxMarks: q.marks }));
        } else if (test.questionsCount > 0) {
            questionsToGrade = Array.from({ length: test.questionsCount }, (_, i) => ({ questionNo: i + 1, maxMarks: 0 }));
        }

        questionsToGrade.sort((a, b) => a.questionNo - b.questionNo);
        res.json({ 
            success: true, 
            questions: questionsToGrade.map(q => q.questionNo), 
            maxMarks: questionsToGrade.map(q => q.maxMarks),
            questionPaperUrl: test.questionPaperURL || null,
            answerKeyUrl: test.answerKeyURL || null
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch question data.' });
    }
});

router.get('/review-results/:id/questions', authenticateAdmin, async (req, res) => {
    try {
        const reviewResult = await ReviewResult.findById(req.params.id).select('questionWiseMarks testId').lean();
        if (!reviewResult) return res.status(404).json({ success: false, message: 'Review request not found.' });
        
        // Get test details for URLs
        const test = await Test.findById(reviewResult.testId).select('questionPaperURL answerKeyURL').lean();
        
        const questionsToGrade = (reviewResult.questionWiseMarks || []).sort((a, b) => a.questionNo - b.questionNo);
        res.json({ 
            success: true, 
            questions: questionsToGrade.map(q => q.questionNo), 
            maxMarks: questionsToGrade.map(q => q.maxMarks),
            questionPaperUrl: test?.questionPaperURL || null,
            answerKeyUrl: test?.answerKeyURL || null
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch question data.' });
    }
});


/* ==========================================================================
   3. SAVE GRADED RESULTS
   ========================================================================== */

// Save a 'pending' result, which marks it as 'published'
router.patch('/results/:id/marks', authenticateAdmin, async (req, res) => {
    try {
        // ✅ Your auth middleware provides req.user with an email. We will use that.
        if (!req.user || !req.user.email) {
            return res.status(401).json({ success: false, message: 'Authentication error: Admin email not found.' });
        }

        const { questionWiseMarks, adminComments } = req.body;
        const marksObtained = (questionWiseMarks || []).reduce((sum, q) => sum + (Number(q.obtainedMarks) || 0), 0);

        const result = await Result.findById(req.params.id).populate('testId', 'totalMarks').orFail();
        const totalMarks = result.testId?.totalMarks || (questionWiseMarks || []).reduce((sum, q) => sum + (Number(q.maxMarks) || 0), 0);

        Object.assign(result, {
            questionWiseMarks, marksObtained, totalMarks, adminComments, status: 'published',
            markedBy: req.user.email, // ✅ Use the admin's email as the marker
            markedAt: new Date()
        });
        await result.save();

        res.json({ success: true, result });
    } catch (e) {
        console.error("Error patching result marks:", e);
        res.status(400).json({ success: false, message: e.message });
    }
});

// Save an 'under review' result, which marks it as 'reviewed'
router.patch('/review-results/:id/marks',
  authenticateAdmin,                           // or whoever is allowed
  async (req, res) => {
    try {
      const { id } = req.params;
      const { questionWiseMarks = [], adminComments = '' } = req.body;

      if (!questionWiseMarks.length) {
        return res.status(400).json({
          success: false,
          message: 'questionWiseMarks is required'
        });
      }

      /* -----------------------------------------------------------
       * 1️⃣  Load the review doc (must still be “under review”)
       * --------------------------------------------------------- */
      const review = await ReviewResult.findById(id);
      if (!review)
        return res.status(404).json({ success:false, message:'ReviewResult not found' });

      if (review.status !== 'under review')
        return res.status(400).json({ success:false,
          message:`Cannot update marks; current status is ${review.status}` });

      /* -----------------------------------------------------------
       * 2️⃣  Overwrite ONLY the questions that came in the payload
       * --------------------------------------------------------- */
      review.questionWiseMarks = review.questionWiseMarks.map(q => {
        const incoming = questionWiseMarks.find(i => i.questionNo === q.questionNo);
        if (incoming) {
          q.obtainedMarks = incoming.obtainedMarks;
          if (incoming.maxMarks !== undefined) q.maxMarks = incoming.maxMarks;
          q.remarks  = incoming.remarks ?? q.remarks;
          q.markedBy = req.user._id;
          q.markedAt = new Date();
        }
        return q;
      });

      /* ---------- 3️⃣  Re-aggregate the review doc ---------- */
      review.marksObtained = review.questionWiseMarks.reduce(
        (sum, q) => sum + (Number(q.obtainedMarks) || 0), 0);
      review.totalMarks    = review.questionWiseMarks.reduce(
        (sum, q) => sum + (Number(q.maxMarks)      || 0), 0);

      review.adminComments = adminComments;
      review.status        = 'reviewed';          // or leave “under review” if you want 2-step approval
      await review.save();


      /* -----------------------------------------------------------
       * 4️⃣  Mirror the same changes into the MAIN Result document
       * --------------------------------------------------------- */
      const result = await Result.findOne({
        studentId : review.studentId,
        testId    : review.testId
      });

      if (!result)
        return res.status(404).json({ success:false, message:'Parent Result not found' });

      // overwrite the same questions inside Result.questionWiseMarks
      result.questionWiseMarks = result.questionWiseMarks.map(q => {
        const upd = review.questionWiseMarks.find(rq => rq.questionNo === q.questionNo);
        if (upd) {
          q.obtainedMarks = upd.obtainedMarks;
          q.maxMarks      = upd.maxMarks;
          q.remarks       = upd.remarks;
          q.markedBy      = upd.markedBy;
          q.markedAt      = upd.markedAt;
        }
        return q;
      });

      // 🔥  THE CORE REQUIREMENT  🔥
      result.marksObtained = result.questionWiseMarks.reduce(
        (s, q) => s + (Number(q.obtainedMarks) || 0), 0);
      result.totalMarks    = result.questionWiseMarks.reduce(
        (s, q) => s + (Number(q.maxMarks)      || 0), 0);

      result.status = 'reviewed';                 // or whatever your flow dictates
      await result.save();

      return res.json({ success:true, message:'Marks updated successfully',
                        data:{ reviewId:review._id, resultId:result._id } });
    }
    catch (err) {
      console.error('Update-review-marks error:', err);
      res.status(500).json({ success:false, message:'Server error' });
    }
});


module.exports = router;