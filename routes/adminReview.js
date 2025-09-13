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
        // Include only unreviewed results, exclude completed/reviewed
        const pending = await Result.find({ 
            status: { $in: ['pending', 'done', 'exited'] },
            resumeAllowed: { $ne: true }  // Exclude tests that are allowed for resume
        }).populate('studentId', 'name').populate('testId', 'title type coding').lean();
        
        // Only include review results that are still under review, not completed
        const under = await ReviewResult.find({ 
            status: 'under review' 
        }).populate('studentId', 'name').populate('testId', 'title type coding').lean();

        const makeItem = (row, reviewMode = false) => ({
            _id: row._id, reviewMode, status: row.status,
            studentName: row.studentId?.name || 'N/A',
            testTitle: row.testId?.title || row.testTitle || 'N/A',
            answerSheetUrl: row.answerSheetURL || row.answerSheetUrl || null, // Handle both naming conventions
            adminComments: row.adminComments ?? '',
            questionWiseMarks: row.questionWiseMarks || [],
            studentComments: row.studentComments || '',
            // Add test type and coding detection - more precise logic
            testType: row.testId?.type || 'traditional',
            isCodingTest: (row.testId?.type === 'coding') || 
                         (row.testId?.coding && row.testId.coding.questions && row.testId.coding.questions.length > 0) ||
                         (row.codingResults && Object.keys(row.codingResults).length > 0 && row.codingResults.questionResults),
            codingResults: row.codingResults || null,
            submissionType: row.submissionType,
            percentage: row.percentage,
            marksObtained: row.marksObtained,
            totalMarks: row.totalMarks,
            // Add monitoring and proctoring data
            violations: row.violations || [],
            monitoringImages: row.monitoringImages || [],
            suspiciousActivities: row.suspiciousActivities || [],
            // Map session info to expected field names
            startTime: row.startedAt || row.testStartTime,
            endTime: row.submittedAt || row.testEndTime,
            timeTaken: row.timeTaken,
            focusLostCount: row.focusLostCount || 0,
            cameraMonitoring: row.cameraMonitoring || false,
            // Keep original fields too for backwards compatibility
            startedAt: row.startedAt,
            submittedAt: row.submittedAt,
            testStartTime: row.testStartTime,
            testEndTime: row.testEndTime,
            // Add resume capability flag - only for tests not already allowed for resume
            canResume: row.status === 'exited' && row.resumeAllowed !== true
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
        const result = await Result.findById(req.params.id).select('testId codingResults').lean();
        if (!result) return res.status(404).json({ success: false, message: 'Result not found.' });

        const test = await Test.findById(result.testId).select('questions questionsCount questionPaperURL answerKeyURL type coding').lean();
        if (!test) return res.status(404).json({ success: false, message: 'Associated test not found.' });

        let questionsToGrade = [];
        let codingQuestions = [];
        
        // Handle coding tests
        if (test.type === 'coding' && test.coding && test.coding.questions) {
            codingQuestions = test.coding.questions.map(q => ({
                id: q.id,
                title: q.title,
                description: q.description,
                inputFormat: q.inputFormat,
                outputFormat: q.outputFormat,
                constraints: q.constraints,
                examples: q.examples,
                testCases: q.testCases,
                marks: q.marks,
                timeLimit: q.timeLimit,
                memoryLimit: q.memoryLimit,
                difficulty: q.difficulty
            }));
            
            // For coding tests, create questions based on coding problems
            questionsToGrade = test.coding.questions.map((q, index) => ({ 
                questionNo: index + 1, 
                maxMarks: q.marks || 10,
                codingQuestion: true,
                problemId: q.id,
                problemTitle: q.title
            }));
        } else {
            // Handle traditional tests
            if (test.questions && test.questions.length > 0) {
                questionsToGrade = test.questions.map(q => ({ questionNo: q.questionNo, maxMarks: q.marks }));
            } else if (test.questionsCount > 0) {
                questionsToGrade = Array.from({ length: test.questionsCount }, (_, i) => ({ questionNo: i + 1, maxMarks: 0 }));
            }
        }

        questionsToGrade.sort((a, b) => a.questionNo - b.questionNo);
        
        res.json({ 
            success: true, 
            questions: questionsToGrade.map(q => q.questionNo), 
            maxMarks: questionsToGrade.map(q => q.maxMarks),
            questionPaperUrl: test.questionPaperURL || null,
            answerKeyUrl: test.answerKeyURL || null,
            testType: test.type || 'traditional',
            codingQuestions: codingQuestions,
            codingResults: result.codingResults || null
        });
    } catch (error) {
        console.error('Error fetching question data:', error);
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
   3A. UPDATE CODING QUESTION MARKS (NEW ROUTE FOR 'DONE' STATUS)
   ========================================================================== */

router.patch('/results/:id/question-marks', authenticateAdmin, async (req, res) => {
    try {
        if (!req.user || !req.user.email) {
            return res.status(401).json({ success: false, message: 'Authentication error: Admin email not found.' });
        }

        const { questionIndex, marks } = req.body;
        const result = await Result.findById(req.params.id).orFail();

        // Update specific question marks in codingResults
        if (result.codingResults && result.codingResults.questionResults && result.codingResults.questionResults[questionIndex]) {
            result.codingResults.questionResults[questionIndex].score = marks;
            
            // Recalculate total score
            result.codingResults.totalScore = result.codingResults.questionResults.reduce(
                (sum, qr) => sum + qr.score, 0
            );
            
            // Update overall result marks
            result.marksObtained = result.codingResults.totalScore;
            result.percentage = (result.codingResults.totalScore / result.codingResults.maxScore) * 100;
            
            // Mark as reviewed by admin
            result.reviewedBy = req.user.email;
            result.reviewedAt = new Date();
            
            await result.save();

            res.json({ 
                success: true, 
                message: 'Question marks updated successfully',
                questionScore: marks,
                totalScore: result.codingResults.totalScore,
                percentage: result.percentage
            });
        } else {
            res.status(400).json({ success: false, message: 'Invalid question index or coding results not found' });
        }
    } catch (e) {
        console.error("Error updating question marks:", e);
        res.status(400).json({ success: false, message: e.message });
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
            questionWiseMarks, marksObtained, totalMarks, adminComments, status: 'reviewed',
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

        result.status = 'reviewed';                 // Mark as reviewed after admin review
        await result.save();      return res.json({ success:true, message:'Marks updated successfully',
                        data:{ reviewId:review._id, resultId:result._id } });
    }
    catch (err) {
      console.error('Update-review-marks error:', err);
      res.status(500).json({ success:false, message:'Server error' });
    }
});

/* ==========================================================================
   4. DELETE A RESULT (ADMIN)
   ========================================================================== */
router.delete('/results/:id', authenticateAdmin, async (req, res) => {
  try {
    const resultId = req.params.id;

    // Load the result and ensure it exists
    const result = await Result.findById(resultId).lean();
    if (!result) return res.status(404).json({ success: false, message: 'Result not found.' });

    // Optionally: perform Drive cleanup if answerSheetURL or answerSheetUrl present
    try {
      const { getFileMetadata } = require('../services/gdrive');
      const driveFileIds = [];

      const extractFileId = (url) => {
        if (!url) return null;
        const m = url.match(/\/d\/(.*?)\//);
        return m ? m[1] : null;
      };

      const asId = extractFileId(result.answerSheetURL || result.answerSheetUrl || result.answerSheetURL);
      if (asId) driveFileIds.push(asId);

      // Also check for any monitoring entries stored within result.violations or elsewhere
      if (Array.isArray(result.violations)) {
        result.violations.forEach(v => {
          if (v && v.driveFileUrl) {
            const id = extractFileId(v.driveFileUrl);
            if (id) driveFileIds.push(id);
          }
        });
      }

      // Attempt to fetch metadata for discovered files (no deletion here by default)
      for (const fid of driveFileIds) {
        try { await getFileMetadata(fid); } catch (e) { /* ignore metadata errors */ }
      }
    } catch (e) {
      // Non-fatal: don't block deletion if Drive helper fails
      console.warn('Drive cleanup check failed:', e.message || e);
    }

    // Finally remove the Result document
    await Result.deleteOne({ _id: resultId });

    // Optionally: create an audit log entry - simple console log for now
    console.log(`Admin ${req.user?.email || 'unknown'} deleted result ${resultId}`);

    res.json({ success: true, message: 'Result deleted' });
  } catch (err) {
    console.error('Error deleting result:', err);
    res.status(500).json({ success: false, message: 'Server error during deletion.' });
  }
});

/* ==========================================================================
   5. ALLOW TEST RESUME (ADMIN)
   ========================================================================== */
router.patch('/results/:id/allow-resume', authenticateAdmin, async (req, res) => {
  try {
    const resultId = req.params.id;

    // Find the result
    const result = await Result.findById(resultId).populate('testId', 'title endDate resumeEnabled');
    if (!result) {
      return res.status(404).json({ success: false, message: 'Result not found.' });
    }

    // Check if test allows resume
    if (!result.testId?.resumeEnabled) {
      return res.status(400).json({ 
        success: false, 
        message: 'This test does not allow resume functionality.' 
      });
    }

    // Check if test has ended
    const now = new Date();
    if (result.testId?.endDate && now > new Date(result.testId.endDate)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot resume test - test period has ended.' 
      });
    }

    // Update the result to allow resume
    result.status = 'pending';  // Use valid enum value - pending completion
    result.resumeAllowed = true;
    // Handle admin user ID properly - 'admin' is not a valid ObjectId
    if (req.user?._id && req.user._id !== 'admin') {
      result.resumeApprovedBy = req.user._id;
    }
    result.resumeApprovedAt = new Date();
    result.adminComments = (result.adminComments || '') + `\n[${new Date().toLocaleString()}] Resume approved by admin.`;
    
    await result.save();

    console.log(`Admin ${req.user?.email || 'unknown'} allowed resume for result ${resultId} - Test: ${result.testId?.title}`);

    res.json({ 
      success: true, 
      message: 'Test resume enabled successfully. Student can now continue their test.',
      result: {
        id: result._id,
        status: result.status,
        resumeAllowed: result.resumeAllowed
      }
    });
  } catch (err) {
    console.error('Error enabling test resume:', err);
    res.status(500).json({ success: false, message: 'Server error enabling test resume.' });
  }
});

module.exports = router;

module.exports = router;