const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const QRCode = require('qrcode');

// Middleware & Services
const { authenticateStudent } = require('../middleware/auth');
const notificationService = require('../services/notificationService');
const { uploadToGDrive } = require('../services/gdrive');

// Mongoose Models
const Test = require('../models/Test');
const Result = require('../models/Result');
const Student = require('../models/Student');
const ReviewResult = require('../models/ReviewResult');

// Configure Multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });


/* ==========================================================================
   STUDENT DASHBOARD & TEST LISTING
   ========================================================================== */

const createTestQueryForStudent = async (studentId) => {
    const student = await Student.findById(studentId).lean();
    if (!student) throw new Error('Student not found.');
    const attemptedTestIds = await Result.distinct('testId', { studentId });
    const studentClass = (student.class || '').replace(/^Class\s*/i, '').trim();
    return {
        query: {
            active: true,
            board: student.board,
            $or: [{ class: studentClass }, { class: `Class ${studentClass}` }],
            _id: { $nin: attemptedTestIds },
            blockedStudents: { $nin: [studentId] },
        }
    };
};

router.get('/dashboard', authenticateStudent, async (req, res) => {
    try {
        const { query: testQuery } = await createTestQueryForStudent(req.student._id);
        const now = new Date();
        const [availableTests, upcomingTests, completedResults, stats] = await Promise.all([
            Test.find({ ...testQuery, startDate: { $lte: now }, endDate: { $gte: now } }).select('title subject duration totalMarks endDate').lean(),
            Test.find({ ...testQuery, startDate: { $gt: now } }).select('title subject startDate').sort({ startDate: 1 }).limit(5).lean(),
            Result.find({ studentId: req.student._id }).select('testTitle status marksObtained totalMarks percentage submittedAt').sort({ submittedAt: -1 }).limit(5).lean(),
            Result.aggregate([
                { $match: { studentId: mongoose.Types.ObjectId(req.student._id) } },
                { $group: { _id: null, totalTestsTaken: { $sum: 1 }, averageScore: { $avg: '$percentage' } } },
            ])
        ]);
        res.json({
            success: true,
            data: { availableTests, upcomingTests, completedResults, statistics: { totalTestsTaken: stats[0]?.totalTestsTaken || 0, averageScore: stats[0]?.averageScore || 0 } },
        });
    } catch (error) {
        console.error('Student Dashboard Error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch dashboard data.' });
    }
});

router.get('/tests', authenticateStudent, async (req, res) => {
    try {
        const { query: testQuery } = await createTestQueryForStudent(req.student._id);
        const now = new Date();
        const tests = await Test.find({ ...testQuery, startDate: { $lte: now }, endDate: { $gte: now } }).select('title subject duration totalMarks passingMarks class board startDate endDate').lean();
        res.json({ success: true, tests });
    } catch (error) {
        console.error('Get Available Tests Error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch available tests.' });
    }
});


/* ==========================================================================
   TEST TAKING & SUBMISSION
   ========================================================================== */

// ✅ NEW: Start or restore a test session, creating a server-authoritative start time.
router.post('/test/:testId/start', authenticateStudent, async (req, res) => {
    try {
        const { testId } = req.params;
        const studentId = req.student._id;

        const test = await Test.findById(testId).select('duration title subject totalMarks').lean();
        if (!test) {
            return res.status(404).json({ success: false, message: 'Test not found.' });
        }

        // Find or create the result document to establish a server-side start time.
        // This makes the session resilient to browser cache clearing or tab closing.
        const result = await Result.findOneAndUpdate(
            { studentId, testId },
            { 
                $setOnInsert: {
                    studentId,
                    testId,
                    testTitle: test.title,
                    testSubject: test.subject,
                    totalMarks: test.totalMarks,
                    startedAt: new Date(),
                    status: 'pending'
                }
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        ).lean();

        const startTime = result.startedAt.getTime();
        const durationInSeconds = test.duration * 60;
        const endTime = startTime + (durationInSeconds * 1000);
        const remainingSeconds = Math.max(0, Math.round((endTime - Date.now()) / 1000));

        res.json({ success: true, message: 'Test session initiated.', remainingSeconds, startTime });
    } catch (error) {
        console.error('Test Start Error:', error);
        res.status(500).json({ success: false, message: 'Failed to start the test session.' });
    }
});

// ✅ NEW: Get the authoritative remaining time from the server.
router.get('/test/:testId/time', authenticateStudent, async (req, res) => {
    try {
        const { testId } = req.params;
        const studentId = req.student._id;

        const [test, result] = await Promise.all([
            Test.findById(testId).select('duration').lean(),
            Result.findOne({ studentId, testId }).select('startedAt').lean()
        ]);

        if (!test) return res.status(404).json({ success: false, message: 'Test not found.' });
        if (!result || !result.startedAt) return res.status(404).json({ success: false, message: 'Test session not started or found.' });

        const endTime = new Date(result.startedAt).getTime() + (test.duration * 60 * 1000);
        const remainingSeconds = Math.max(0, Math.round((endTime - Date.now()) / 1000));

        res.json({ success: true, remainingSeconds });
    } catch (error) {
        console.error('Fetch Time Error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch remaining time.' });
    }
});

router.get('/test/:testId', authenticateStudent, async (req, res) => {
    try {
        const { testId } = req.params;
        const test = await Test.findById(testId).select('-questions.correctAnswer').lean();
        if (!test) return res.status(404).json({ success: false, message: 'Test not found.' });
        const now = new Date();
        if (!test.active || now < new Date(test.startDate) || now > new Date(test.endDate)) {
            return res.status(403).json({ success: false, message: 'This test is not currently available.' });
        }
        if (test.blockedStudents?.some(id => id.equals(req.student._id))) {
            return res.status(403).json({ success: false, message: 'You are blocked from taking this test.' });
        }
        const existingResult = await Result.findOne({ studentId: req.student._id, testId }).lean();
        if (existingResult) {
            return res.status(409).json({ success: false, message: 'You have already attempted this test.', attempted: true });
        }
        res.json({ success: true, test });
    } catch (error) {
        console.error('Get Single Test Error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch test details.' });
    }
});

router.post('/test/:testId/submit', authenticateStudent, async (req, res) => {
    try {
        const { testId } = req.params;
        const { answers, answerSheetUrl, violations = [], autoSubmit = false, timeTaken = 0, browserInfo = {} } = req.body;
        const test = await Test.findById(testId).select('title subject totalMarks').lean();
        if (!test) return res.status(404).json({ success: false, message: 'Test not found.' });
        const result = await Result.findOneAndUpdate(
            { studentId: req.student._id, testId: testId },
            { 
                $set: {
                    submittedAt: new Date(), answers, answerSheetUrl, violations, timeTaken, browserInfo, status: 'pending',
                    submissionType: autoSubmit ? 'auto_submit' : 'manual_submit',
                    adminComments: autoSubmit ? `Auto-submitted due to: ${req.body.autoSubmitReason || 'time limit'}` : '',
                },
                $setOnInsert: {
                    studentId: req.student._id, testId: testId,
                    testTitle: test.title, testSubject: test.subject, totalMarks: test.totalMarks,
                    startedAt: new Date(),
                }
            }, { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        res.status(201).json({ success: true, message: 'Test submitted successfully.', resultId: result._id });
    } catch (error) {
        console.error('Test Submission Error:', error);
        res.status(500).json({ success: false, message: 'Failed to submit the test.' });
    }
});

router.post('/test/:testId/exit', authenticateStudent, async (req, res) => {
    try {
        const { testId } = req.params;
        const { violations = [], autoExit = false, exitReason = '', timeTaken = 0, browserInfo = {} } = req.body;
        const test = await Test.findById(testId).select('title subject totalMarks').lean();
        if (!test) return res.status(404).json({ success: false, message: 'Test not found.' });
        const result = await Result.findOneAndUpdate(
            { studentId: req.student._id, testId: testId },
            {
                $set: {
                    submittedAt: new Date(), violations, timeTaken, browserInfo, status: 'pending',
                    submissionType: autoExit ? 'auto_exit' : 'manual_exit',
                    adminComments: `Test exited by student. ${autoExit ? `Auto-exit reason: ${exitReason}` : ''}`.trim(),
                },
                $setOnInsert: {
                    studentId: req.student._id, testId: testId,
                    testTitle: test.title, testSubject: test.subject, totalMarks: test.totalMarks,
                    startedAt: new Date(),
                }
            }, { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        res.json({ success: true, message: 'Test exited successfully.', resultId: result._id });
    } catch (error) {
        console.error('Test Exit Error:', error);
        res.status(500).json({ success: false, message: 'Failed to exit the test.' });
    }
});

// ✅ FIXED UPLOAD ROUTE
router.post('/test/:testId/upload', authenticateStudent, upload.single('answerSheet'), async (req, res) => {
    try {
        const { testId } = req.params;
        if (!req.file?.buffer) {
            return res.status(400).json({ success: false, message: 'No file was uploaded.' });
        }

        // 1. Fetch all necessary fields from the Test model, including totalMarks
        const test = await Test.findById(testId).select('title subject totalMarks').lean();
        if (!test) {
            return res.status(404).json({ success: false, message: 'Test not found.' });
        }

        // 2. Upload the file to Google Drive
        const fileName = `answersheet_${req.student._id}_${testId}_${Date.now()}.pdf`;
        const { url, fileId } = await uploadToGDrive(req.file.buffer, fileName, req.file.mimetype);

        // 3. Update the result, providing all required fields for an upsert operation
        const result = await Result.findOneAndUpdate(
            { studentId: req.student._id, testId: testId },
            {
                $set: { answerSheetUrl: url },
                // $setOnInsert is used ONLY when a new document is created (upsert: true)
                $setOnInsert: {
                    studentId: req.student._id,
                    testId: testId,
                    testTitle: test.title,
                    testSubject: test.subject,
                    totalMarks: test.totalMarks, // ✅ Provide the required totalMarks
                    startedAt: new Date(),
                }
            },
            {
                upsert: true, // Create the document if it doesn't exist
                new: true,
                setDefaultsOnInsert: true
            }
        );

        res.status(201).json({ success: true, answerSheetUrl: url, fileId, resultId: result._id });
    } catch (error) {
        console.error('File Upload Error:', error);
        res.status(500).json({ success: false, message: 'Failed to upload answer sheet.', error: error.message });
    }
});


/* ==========================================================================
   RESULTS & REVIEW
   ========================================================================== */

router.get('/results', authenticateStudent, async (req, res) => {
    try {
        const results = await Result.find({ studentId: req.student._id }).select('testTitle status marksObtained totalMarks percentage submittedAt').sort({ submittedAt: -1 }).lean();
        res.json({ success: true, results });
    } catch (error) {
        console.error('Get Results List Error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch results.' });
    }
});

router.get('/results/:resultId', authenticateStudent, async (req, res) => {
    try {
        const { resultId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(resultId)) {
            return res.status(400).json({ success: false, message: 'Invalid Result ID format.' });
        }
        const result = await Result.findById(resultId)
            .populate({ path: 'testId', select: 'title subject totalMarks passingMarks questionsCount questionPaperURL answerKeyURL answerKeyVisible' })
            .lean();
        if (!result || !result.studentId.equals(req.student._id)) {
            return res.status(404).json({ success: false, message: 'Result not found or access denied.' });
        }
        const { testId: testData, studentId: studentData, ...resultFields } = result;
        res.json({
            success: true,
            result: resultFields,
            test: testData,
            student: { name: req.student.name, class: req.student.class, school: req.student.school }
        });
    } catch (error) {
        console.error('Get Detailed Result Error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch result details.' });
    }
});


// Request a review for a submitted result
router.post('/results/:resultId/request-review', authenticateStudent, async (req, res) => {
    try {
        const { resultId } = req.params;
        const { questionNumbers = [], comments = '' } = req.body;

        if (questionNumbers.length === 0) {
            return res.status(400).json({ success: false, message: 'Please select at least one question to review.' });
        }

        const resultForRead = await Result.findOne({ _id: resultId, studentId: req.student._id })
            .populate('testId', 'questionPaperURL startDate endDate totalMarks')
            .lean();

        if (!resultForRead) {
            return res.status(404).json({ success: false, message: 'Result not found.' });
        }
        if (!['published', 'reviewed'].includes(resultForRead.status)) {
            return res.status(400).json({ success: false, message: `Cannot request review for a result with status: ${resultForRead.status}` });
        }
        if (!resultForRead.testId) {
             return res.status(404).json({ success: false, message: 'Could not find the original test associated with this result.' });
        }

        const reviewQuestions = resultForRead.questionWiseMarks.filter(q => questionNumbers.includes(q.questionNo));

        const reviewDoc = await ReviewResult.create({
            studentId: resultForRead.studentId,
            testId: resultForRead.testId._id,
            answerSheetUrl: resultForRead.answerSheetUrl,
            questionPaperUrl: resultForRead.testId.questionPaperURL,
            marksObtained: resultForRead.marksObtained,
            totalMarks: resultForRead.testId.totalMarks,
            questionWiseMarks: reviewQuestions,
            studentComments: comments,
            status: 'under review',
            testVisibility: {
                startDate: resultForRead.testId.startDate,
                endDate: resultForRead.testId.endDate,
            },
        });

        // Update the original result's status
        const originalResultToUpdate = await Result.findById(resultId);
        
        // ✅ FIX: Initialize the 'reviewRequests' array if it doesn't exist.
        if (!Array.isArray(originalResultToUpdate.reviewRequests)) {
            originalResultToUpdate.reviewRequests = [];
        }

        originalResultToUpdate.reviewRequests.push({
            questionNumbers,
            comments,
            requestedAt: new Date()
        });
        
        originalResultToUpdate.status = 'under review';
        await originalResultToUpdate.save();

        res.status(201).json({ success: true, message: 'Review requested successfully.', reviewResultId: reviewDoc._id });
    } catch (error) {
        console.error('Review Request Error:', error);
        res.status(500).json({ success: false, message: 'Failed to submit review request.' });
    }
});



/* ==========================================================================
   STUDENT PROFILE
   ========================================================================== */

router.get('/profile', authenticateStudent, async (req, res) => {
    try {
        const student = await Student.findById(req.student._id).select('-passwordHash -password -resetOtp').lean();
        if (!student) {
            return res.status(404).json({ success: false, message: 'Student profile not found.' });
        }
        res.json({ success: true, student });
    } catch (error) {
        console.error('Get Profile Error:', error);
        res.status(500).json({ success: false, message: 'Failed to retrieve profile.' });
    }
});

router.put('/profile', authenticateStudent, [
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
    body('school').optional().trim(),
    body('parentPhoneNumber').optional().isMobilePhone('any', { strictMode: false }).withMessage('Invalid parent phone number format.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }
    try {
        const allowedUpdates = ['name', 'school', 'dateOfBirth', 'gender', 'address', 'parentPhoneNumber', 'profilePicture'];
        const updates = {};
        for (const key of allowedUpdates) {
            if (req.body[key] !== undefined) {
                updates[key] = req.body[key];
            }
        }
        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ success: false, message: 'No valid fields provided for update.' });
        }
        const updatedStudent = await Student.findByIdAndUpdate(req.student._id, { $set: updates }, { new: true }).select('-passwordHash -password').lean();
        res.json({ success: true, message: 'Profile updated successfully.', student: updatedStudent });
    } catch (error) {
        console.error('Update Profile Error:', error);
        res.status(500).json({ success: false, message: 'Failed to update profile.' });
    }
});


/* ==========================================================================
   PUSH NOTIFICATIONS & MISC
   ========================================================================== */

router.post('/push/subscribe', authenticateStudent, async (req, res) => {
    try {
        const { subscription } = req.body;
        if (!subscription || !subscription.endpoint) {
            return res.status(400).json({ success: false, message: 'Invalid subscription object provided.' });
        }
        await notificationService.subscribeToPush(req.student._id, subscription, req.headers['user-agent']);
        res.status(201).json({ success: true, message: 'Successfully subscribed to push notifications.' });
    } catch (error) {
        console.error('Push Subscription Error:', error);
        res.status(500).json({ success: false, message: 'Failed to subscribe.' });
    }
});

router.get('/qr', authenticateStudent, async (req, res) => {
    const { data } = req.query;
    if (!data) return res.status(400).send('QR code data is required.');
    try {
        const qrCodeBuffer = await QRCode.toBuffer(data, { width: 200, margin: 1 });
        res.type('png').send(qrCodeBuffer);
    } catch (err) {
        console.error("QR Generation Failed:", err);
        res.status(500).send('Failed to generate QR code.');
    }
});

// In routes/student.js

router.get('/results/:resultId', authenticateStudent, async (req, res) => {
    try {
        const { resultId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(resultId)) {
            return res.status(400).json({ success: false, message: 'Invalid Result ID format.' });
        }
        
        const result = await Result.findById(resultId)
            .populate({
                path: 'testId',
                // ✅ ACTION: Add 'questionsCount' to this line
                select: 'title subject totalMarks passingMarks questionPaperURL answerKeyURL answerKeyVisible questionsCount'
            })
            .lean();

        // ... rest of the function remains the same

        if (!result || !result.studentId.equals(req.student._id)) {
            return res.status(404).json({ success: false, message: 'Result not found or access denied.' });
        }

        const { testId: testData, ...resultFields } = result;
        res.json({
            success: true,
            result: resultFields,
            test: testData,
            student: { name: req.student.name, class: req.student.class, school: req.student.school }
        });

    } catch (error) {
        console.error('Get Detailed Result Error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch result details.' });
    }
});
module.exports = router;