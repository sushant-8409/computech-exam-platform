const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const QRCode = require('qrcode');
const https = require('https');

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
    
    // Get attempted test IDs, but exclude those that are allowed for resume
    const attemptedResults = await Result.find({ 
        studentId, 
        resumeAllowed: { $ne: true }  // Exclude tests that can be resumed
    }).select('testId').lean();
    const attemptedTestIds = attemptedResults.map(result => result.testId);
    
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
        
        // Check for resumable tests for this student first
        const resumableResults = await Result.find({ 
            studentId: req.student._id, 
            resumeAllowed: true 
        }).populate('testId', 'title subject duration totalMarks endDate').lean();
        
        // Get resumable test IDs to exclude from available tests
        const resumableTestIds = resumableResults
            .filter(result => result.testId && new Date() <= new Date(result.testId.endDate))
            .map(result => result.testId._id);
        
        // Add resumable test IDs to exclusion list to avoid duplicates
        const finalTestQuery = {
            ...testQuery,
            _id: { $nin: [...testQuery._id.$nin, ...resumableTestIds] }
        };
        
        // Get available tests (excluding resumable ones)
        const availableTestsFromQuery = await Test.find({ 
            ...finalTestQuery, 
            startDate: { $lte: now }, 
            endDate: { $gte: now } 
        }).select('title subject duration totalMarks endDate').lean();
        
        // Add resumable tests to available tests with resume flag
        const resumableTests = resumableResults
            .filter(result => result.testId && new Date() <= new Date(result.testId.endDate)) // Only if test hasn't ended
            .map(result => ({
                ...result.testId,
                canResume: true,
                resultId: result._id
            }));
        
        const availableTests = [...availableTestsFromQuery, ...resumableTests];
        
        const [upcomingTests, completedResults, stats] = await Promise.all([
            Test.find({ ...testQuery, startDate: { $gt: now } }).select('title subject startDate').sort({ startDate: 1 }).limit(5).lean(),
            Result.find({ 
                studentId: req.student._id,
                resumeAllowed: { $ne: true }  // Exclude resumable results from completed
            }).select('testTitle status marksObtained totalMarks percentage submittedAt').sort({ submittedAt: -1 }).limit(5).lean(),
            Result.aggregate([
                { $match: { 
                    studentId: mongoose.Types.ObjectId(req.student._id),
                    resumeAllowed: { $ne: true }  // Only count truly completed tests
                } },
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
        
        // Get available tests from query
        const availableTestsFromQuery = await Test.find({ ...testQuery, startDate: { $lte: now }, endDate: { $gte: now } }).select('title subject duration totalMarks passingMarks class board startDate endDate type isCodingTest coding').lean();
        
        // Get resumable tests for this student
        const resumableResults = await Result.find({ 
            studentId: req.student._id, 
            resumeAllowed: true 
        }).populate('testId', 'title subject duration totalMarks passingMarks class board startDate endDate type isCodingTest coding').lean();
        
        // Add resumable tests to available tests with resume flag
        const resumableTests = resumableResults
            .filter(result => result.testId && new Date() <= new Date(result.testId.endDate)) // Only if test hasn't ended
            .map(result => ({
                ...result.testId,
                canResume: true,
                resultId: result._id
            }));
        
        // Merge tests, ensuring no duplicates (prioritize resumable versions)
        const resumableTestIds = new Set(resumableTests.map(test => test._id.toString()));
        const availableTestsFiltered = availableTestsFromQuery.filter(test => 
            !resumableTestIds.has(test._id.toString())
        );
        
        const tests = [...availableTestsFiltered, ...resumableTests];
        
        res.json({ success: true, tests });
    } catch (error) {
        console.error('Get Available Tests Error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch available tests.' });
    }
});


/* ==========================================================================
   TEST TAKING & SUBMISSION
   ========================================================================== */


/**
 * Fetches the current UTC time from an external API for high accuracy.
 * Falls back to the server's local time if the API is unreachable.
 * @returns {Promise<number>} The current Unix timestamp in milliseconds.
 */
function getAccurateTime() {
    return new Promise((resolve) => {
        const request = https.get('https://worldtimeapi.org/api/timezone/Etc/UTC', (res) => {
            if (res.statusCode !== 200) {
                console.warn(`WorldTimeAPI failed with status: ${res.statusCode}. Falling back to server time.`);
                resolve(Date.now());
                return;
            }
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    // The API returns unixtime in seconds, convert to milliseconds
                    resolve(JSON.parse(data).unixtime * 1000);
                } catch (e) {
                    console.warn('Failed to parse WorldTimeAPI response. Falling back to server time.');
                    resolve(Date.now());
                }
            });
        });
        request.on('error', (e) => {
            console.warn(`WorldTimeAPI request failed: ${e.message}. Falling back to server time.`);
            resolve(Date.now());
        });
        request.setTimeout(2000, () => { // 2-second timeout
            request.destroy();
            console.warn('WorldTimeAPI request timed out. Falling back to server time.');
            resolve(Date.now());
        });
    });
}

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
        const currentTime = await getAccurateTime();
        const remainingSeconds = Math.max(0, Math.round((endTime - currentTime) / 1000));

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
        const currentTime = await getAccurateTime();
        const remainingSeconds = Math.max(0, Math.round((endTime - currentTime) / 1000));

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
            // Check if this is a resumable test that was previously exited
            if (existingResult.status === 'in_progress' && existingResult.resumeAllowed === true) {
                // Check if timer has expired for this resume session
                const timeElapsed = existingResult.timeTaken || 0;
                const testDurationMinutes = test.duration || 60;
                const testDurationSeconds = testDurationMinutes * 60;
                
                if (timeElapsed >= testDurationSeconds) {
                    // Timer already expired, auto-submit the test
                    console.log(`⏰ Timer expired for resumed test ${testId}, auto-submitting`);
                    
                    // Update the result to submitted
                    await Result.findByIdAndUpdate(existingResult._id, {
                        status: 'pending',
                        submittedAt: new Date(),
                        submissionType: 'auto_submit',
                        adminComments: 'Auto-submitted due to time expiry on resume attempt'
                    });
                    
                    return res.status(409).json({ 
                        success: false, 
                        message: 'Time has expired for this test. It has been automatically submitted.', 
                        attempted: true,
                        timeExpired: true
                    });
                }
                
                // Allow resume - return test with resume flag
                return res.json({ 
                    success: true, 
                    test,
                    canResume: true,
                    existingResult: {
                        id: existingResult._id,
                        startedAt: existingResult.startedAt,
                        answers: existingResult.answers || {},
                        timeTaken: existingResult.timeTaken || 0
                    }
                });
            }
            return res.status(409).json({ 
                success: false, 
                message: 'You have already attempted this test.', 
                attempted: true 
            });
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
        const { 
            answers, 
            answerSheetUrl, 
            violations = [], 
            autoSubmit = false, 
            timeTaken = 0, 
            browserInfo = {},
            monitoringData = {}
        } = req.body;
        
        const test = await Test.findById(testId).select('title subject totalMarks').lean();
        if (!test) return res.status(404).json({ success: false, message: 'Test not found.' });
        
        // Prepare monitoring data for database storage
        const monitoringFields = {};
        if (monitoringData.monitoringImages) {
            monitoringFields.monitoringImages = monitoringData.monitoringImages;
        }
        if (monitoringData.suspiciousActivities) {
            monitoringFields.suspiciousActivities = monitoringData.suspiciousActivities;
        }
        if (monitoringData.cameraMonitoring !== undefined) {
            monitoringFields.cameraMonitoring = monitoringData.cameraMonitoring;
        }
        if (monitoringData.testStartTime) {
            monitoringFields.testStartTime = new Date(monitoringData.testStartTime);
        }
        if (monitoringData.testEndTime) {
            monitoringFields.testEndTime = new Date(monitoringData.testEndTime);
        }
        
        const result = await Result.findOneAndUpdate(
            { studentId: req.student._id, testId: testId },
            { 
                $set: {
                    submittedAt: new Date(), 
                    answers, 
                    answerSheetUrl, 
                    violations, 
                    timeTaken, 
                    browserInfo, 
                    status: 'pending',
                    submissionType: autoSubmit ? 'auto_submit' : 'manual_submit',
                    adminComments: autoSubmit ? `Auto-submitted due to: ${req.body.autoSubmitReason || 'time limit'}` : '',
                    ...monitoringFields // Include monitoring data
                },
                $setOnInsert: {
                    studentId: req.student._id, 
                    testId: testId,
                    testTitle: test.title, 
                    testSubject: test.subject, 
                    totalMarks: test.totalMarks,
                    startedAt: new Date(),
                }
            }, 
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        
        console.log(`📊 Test submission completed for student ${req.student._id}:`, {
            testId,
            answersCount: Object.keys(answers || {}).length,
            violationsCount: violations.length,
            monitoringImagesCount: monitoringData.monitoringImages?.length || 0,
            suspiciousActivitiesCount: monitoringData.suspiciousActivities?.length || 0
        });
        
        res.status(201).json({ success: true, message: 'Test submitted successfully.', resultId: result._id });
    } catch (error) {
        console.error('Test Submission Error:', error);
        res.status(500).json({ success: false, message: 'Failed to submit the test.' });
    }
});

router.post('/test/:testId/exit', authenticateStudent, async (req, res) => {
    try {
        const { testId } = req.params;
        const { 
            violations = [], 
            autoExit = false, 
            exitReason = '', 
            timeTaken = 0, 
            browserInfo = {},
            monitoringData = {} // Include monitoring data for traditional tests
        } = req.body;
        
        const test = await Test.findById(testId).select('title subject totalMarks').lean();
        if (!test) return res.status(404).json({ success: false, message: 'Test not found.' });
        
        // Prepare monitoring fields for traditional tests
        const monitoringFields = {};
        if (monitoringData.monitoringImages) {
            monitoringFields.monitoringImages = monitoringData.monitoringImages;
        }
        if (monitoringData.suspiciousActivities) {
            monitoringFields.suspiciousActivities = monitoringData.suspiciousActivities;
        }
        if (monitoringData.cameraMonitoring !== undefined) {
            monitoringFields.cameraMonitoring = monitoringData.cameraMonitoring;
        }
        if (monitoringData.testStartTime) {
            monitoringFields.testStartTime = new Date(monitoringData.testStartTime);
        }
        if (monitoringData.testEndTime) {
            monitoringFields.testEndTime = new Date(monitoringData.testEndTime);
        }
        
        const result = await Result.findOneAndUpdate(
            { studentId: req.student._id, testId: testId },
            {
                $set: {
                    submittedAt: new Date(), 
                    violations, 
                    timeTaken, 
                    browserInfo, 
                    status: 'pending',
                    submissionType: autoExit ? 'auto_exit' : 'manual_exit',
                    adminComments: `Test exited by student. ${autoExit ? `Auto-exit reason: ${exitReason}` : ''}`.trim(),
                    ...monitoringFields // Include monitoring data for traditional tests
                },
                $setOnInsert: {
                    studentId: req.student._id, testId: testId,
                    testTitle: test.title, testSubject: test.subject, totalMarks: test.totalMarks,
                    startedAt: new Date(),
                }
            }, { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        
        console.log(`📊 Test exit completed for student ${req.student._id}:`, {
            testId,
            violationsCount: violations.length,
            monitoringImagesCount: monitoringData.monitoringImages?.length || 0,
            suspiciousActivitiesCount: monitoringData.suspiciousActivities?.length || 0
        });
        
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

        // 2. Upload the file to Google Drive using OAuth (Always use admin's drive)
        const fileName = `answersheet_${req.student._id}_${testId}_${Date.now()}.pdf`;
        
        // Always use admin OAuth tokens for centralized file management
        let uploadResult;
        const User = require('../models/User');
        const adminUser = await User.findOne({ role: 'admin', googleConnected: true });
        
        if (adminUser && adminUser.googleTokens && adminUser.googleTokens.refresh_token) {
            const oauthDrive = require('../services/oauthDrive');
            console.log('📁 Uploading to admin\'s Google Drive:', adminUser.email);
            uploadResult = await oauthDrive.uploadToGDrive(adminUser.googleTokens, req.file.buffer, fileName, req.file.mimetype);
        } else {
            // No admin OAuth tokens available - system not configured
            return res.status(500).json({
                success: false,
                message: 'Google Drive not configured. Please contact administrator to set up Google OAuth.',
                error: 'GOOGLE_OAUTH_NOT_CONFIGURED'
            });
        }
        
        const { url, fileId } = uploadResult;

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
        const results = await Result.find({ 
            studentId: req.student._id 
        }).select('testTitle status marksObtained totalMarks percentage submittedAt submissionType codingResults testId')
        .populate('testId', 'type title')
        .sort({ submittedAt: -1 }).lean();

        // Add coding test identification and status display logic
        const processedResults = results.map(result => {
            const isCodingTest = result.testId?.type === 'coding' || 
                               result.submissionType === 'multi_question_coding' ||
                               result.testTitle?.toLowerCase().includes('coding') ||
                               (result.codingResults && Object.keys(result.codingResults).length > 0);
            
            return {
                ...result,
                isCodingTest,
                // Show different actions based on status
                canViewResults: result.status === 'completed',
                showViewCodingResults: isCodingTest && result.status === 'completed',
                hideViewCodingResults: isCodingTest && result.status === 'done',
                statusDisplay: result.status === 'done' ? 'Under Review' : 
                              result.status === 'completed' ? 'Completed' : 
                              result.status
            };
        });

        res.json({ success: true, results: processedResults });
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
            .populate({ 
                path: 'testId', 
                select: 'title subject totalMarks passingMarks questionsCount duration timeLimit questions totalQuestions questionPaperURL answerKeyURL answerKeyVisible testType type class board school' 
            })
            .populate({ path: 'studentId', select: 'name class board school rollNo' })
            .lean();
        if (!result || result.studentId._id.toString() !== req.student._id.toString()) {
            return res.status(404).json({ success: false, message: 'Result not found or access denied.' });
        }
        const { testId: testData, studentId: populatedStudentData, ...resultFields } = result;
        
        console.log('📊 Result API Debug:', {
            requestedBy: req.student._id,
            studentName: req.student.name,
            testData: testData ? {
                title: testData.title,
                subject: testData.subject,
                duration: testData.duration,
                timeLimit: testData.timeLimit,
                questions: testData.questions,
                totalQuestions: testData.totalQuestions,
                questionsCount: testData.questionsCount,
                testType: testData.testType,
                type: testData.type
            } : null,
            resultData: {
                totalMarks: resultFields.totalMarks,
                marksObtained: resultFields.marksObtained,
                totalQuestions: resultFields.totalQuestions
            },
            studentData: {
                name: req.student.name,
                class: req.student.class,
                board: req.student.board,
                school: req.student.school,
                rollNo: req.student.rollNo
            },
            populatedStudentData
        });
        
        res.json({
            success: true,
            result: { ...resultFields, studentId: populatedStudentData },
            test: testData,
            student: { 
                name: req.student.name, 
                class: req.student.class, 
                board: req.student.board,
                school: req.student.school,
                rollNo: req.student.rollNo
            }
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

// ✅ NEW: Check push notification status
router.get('/push/status', authenticateStudent, async (req, res) => {
    try {
        const PushSubscription = require('../models/PushSubscription');
        
        // Check if student has an active push subscription
        // ✅ FIXED: Use 'userId' not 'studentId' to match the model
        const subscription = await PushSubscription.findOne({ 
            userId: req.student._id,
            active: true 
        });

        console.log(`📱 Push status check for student ${req.student.email}: ${subscription ? 'subscribed' : 'not subscribed'}`);

        res.json({
            success: true,
            subscribed: !!subscription,
            userId: req.student._id,
            email: req.student.email
        });

    } catch (error) {
        console.error('❌ Error checking push status:', error);
        res.status(500).json({ 
            success: false, 
            subscribed: false,
            message: 'Failed to check push notification status'
        });
    }
});

// ✅ NEW: Unsubscribe from push notifications
router.post('/push/unsubscribe', authenticateStudent, async (req, res) => {
    try {
        const PushSubscription = require('../models/PushSubscription');
        
        // Deactivate all push subscriptions for this student
        // ✅ FIXED: Use 'userId' not 'studentId' to match the model
        await PushSubscription.updateMany(
            { userId: req.student._id },
            { $set: { active: false } }
        );

        console.log(`📱 Push unsubscribe for student ${req.student.email}`);

        res.json({
            success: true,
            message: 'Successfully unsubscribed from push notifications'
        });

    } catch (error) {
        console.error('❌ Error unsubscribing from push notifications:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to unsubscribe from push notifications'
        });
    }
});

// Google Drive connection status
router.get('/google-drive-status', authenticateStudent, async (req, res) => {
    try {
        const Student = require('../models/Student');
        
        // Handle admin users who might not have a student record
        if (!req.student) {
            return res.json({
                success: true,
                connected: false,
                message: 'Admin user - no student Google Drive status'
            });
        }
        
        const studentId = req.student._id || req.student.id;
        if (!studentId) {
            return res.json({
                success: true,
                connected: false,
                message: 'Student ID not found'
            });
        }
        
        const student = await Student.findById(studentId);
        
        const connected = !!(student && student.googleTokens && student.googleTokens.refresh_token);
        
        res.json({ 
            success: true,
            connected: connected,
            hasTokens: !!student.googleConnected
        });
    } catch (error) {
        console.error('Error checking Google Drive status:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to check Google Drive status',
            connected: false
        });
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

// ✅ NEW: Get student notifications
router.get('/notifications', authenticateStudent, async (req, res) => {
    try {
        console.log('📨 Student notifications request from:', req.student.email);
        
        const Notification = require('../models/Notification');
        
        // Find notifications that include this student's email in recipients
        const notifications = await Notification.find({
            'recipients.email': req.student.email,
            createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
        })
        .sort({ createdAt: -1 })
        .limit(50)
        .select('title message type createdAt emailSent appNotificationSent recipients');

        console.log(`📋 Found ${notifications.length} notifications for student`);

        // Filter to only include relevant recipient data
        const studentNotifications = notifications.map(notification => {
            const studentRecipient = notification.recipients.find(r => r.email === req.student.email);
            return {
                _id: notification._id,
                title: notification.title,
                message: notification.message,
                type: notification.type,
                createdAt: notification.createdAt,
                emailSent: notification.emailSent,
                appNotificationSent: notification.appNotificationSent,
                status: studentRecipient?.status || 'unknown',
                sentAt: studentRecipient?.sentAt || null
            };
        });

        console.log('✅ Sending student notifications response');
        res.json({
            success: true,
            notifications: studentNotifications,
            count: studentNotifications.length
        });

    } catch (error) {
        console.error('❌ Error fetching student notifications:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch notifications',
            error: error.message,
            notifications: [] 
        });
    }
});

/* ==========================================================================
   ANSWER SHEET UPLOAD
   ========================================================================== */
router.post('/upload-answer-sheet', authenticateStudent, upload.single('answerSheet'), async (req, res) => {
    try {
        const { testId, studentId } = req.body;
        
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No answer sheet file provided'
            });
        }

        if (!testId) {
            return res.status(400).json({
                success: false,
                message: 'Test ID is required'
            });
        }

        // Verify test exists and supports paper submission
        const test = await Test.findById(testId);
        if (!test) {
            return res.status(404).json({
                success: false,
                message: 'Test not found'
            });
        }

        if (!test.paperSubmissionRequired) {
            return res.status(400).json({
                success: false,
                message: 'This test does not require paper submission'
            });
        }

        // Verify student has permission to upload for this test
        if (req.student._id.toString() !== studentId) {
            return res.status(403).json({
                success: false,
                message: 'You can only upload your own answer sheet'
            });
        }

        // Upload to Google Drive
        const fileName = `answer-sheet-${req.student.name.replace(/[^a-zA-Z0-9]/g, '-')}-${testId}-${Date.now()}.pdf`;
        const uploadResult = await uploadToGDrive(
            req.file.buffer,
            fileName,
            req.file.mimetype
        );

        // Update or create result with answer sheet URL
        let result = await Result.findOne({ studentId: req.student._id, testId });
        
        if (result) {
            result.answerSheetUrl = uploadResult.url;
            result.answerSheetURL = uploadResult.url; // Handle both naming conventions
            await result.save();
        } else {
            // Create new result if doesn't exist (for paper-only submissions)
            result = new Result({
                studentId: req.student._id,
                testId,
                testTitle: test.title,
                testSubject: test.subject,
                totalMarks: test.totalMarks,
                answerSheetUrl: uploadResult.url,
                answerSheetURL: uploadResult.url,
                submissionType: 'paper_upload',
                submittedAt: new Date(),
                status: 'pending'
            });
            await result.save();
        }

        res.json({
            success: true,
            message: 'Answer sheet uploaded successfully',
            url: uploadResult.url,
            fileId: uploadResult.fileId,
            result: result._id
        });

    } catch (error) {
        console.error('❌ Answer sheet upload error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to upload answer sheet',
            error: error.message
        });
    }
});

// Monitoring image upload route
router.post('/monitoring/upload', authenticateStudent, upload.single('monitoringImage'), async (req, res) => {
    try {
        const { timestamp, testId, purpose, saveToGoogleDrive } = req.body;
        
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No monitoring image file provided'
            });
        }

        console.log('📸 Processing monitoring image upload:', {
            testId,
            purpose,
            saveToGoogleDrive,
            studentId: req.student._id
        });

        // Store monitoring image to Google Drive if requested
        if (saveToGoogleDrive === 'true') {
            try {
                console.log('📤 Uploading monitoring image to Google Drive...');
                
                // Get admin's Google Drive tokens for upload
                const User = require('../models/User');
                const adminUser = await User.findOne({ role: 'admin' });
                
                if (!adminUser || !adminUser.googleTokens) {
                    console.log('❌ No admin Google tokens found');
                    return res.json({
                        success: false,
                        message: 'Google Drive authentication required for monitoring'
                    });
                }

                const tokens = adminUser.googleTokens;
                const fileName = `monitoring_${testId}_${req.student._id}_${timestamp}.jpg`;
                
                const uploadResult = await uploadViaOauth(
                    tokens,
                    req.file.buffer,
                    fileName,
                    req.file.mimetype
                );

                console.log('📸 Monitoring image uploaded to Google Drive:', uploadResult.url);
                
                // Update or create result with monitoring image
                const result = await Result.findOneAndUpdate(
                    { testId, studentId: req.student._id },
                    { 
                        $push: { 
                            monitoringImages: {
                                url: uploadResult.url,
                                timestamp: new Date(parseInt(timestamp)),
                                type: purpose || 'monitoring',
                                driveFileId: uploadResult.fileId
                            }
                        },
                        $setOnInsert: {
                            testTitle: 'Test in Progress',
                            totalMarks: 0,
                            cameraMonitoring: true
                        }
                    },
                    { upsert: true, new: true }
                );

                console.log('📸 Monitoring image URL saved to result:', result._id);
                console.log('📸 Total monitoring images for this result:', result.monitoringImages.length);
                
                res.json({
                    success: true,
                    message: 'Monitoring image uploaded silently',
                    fileUrl: uploadResult.url
                });
            } catch (uploadError) {
                console.error('Failed to upload monitoring image to Google Drive:', uploadError);
                res.json({
                    success: false,
                    message: 'Failed to upload monitoring image'
                });
            }
        } else {
            // Just acknowledge receipt without storage
            res.json({
                success: true,
                message: 'Monitoring image processed'
            });
        }

    } catch (error) {
        console.error('❌ Monitoring upload error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process monitoring image',
            error: error.message
        });
    }
});

/* ==========================================================================
   CODING TEST ENDPOINTS (Multi-Question Support)
   ========================================================================== */

// Get coding test details (wrapper for /api/coding-test/:testId)
router.get('/coding-test/:testId', authenticateStudent, async (req, res) => {
    try {
        const CodingTestController = require('../controllers/CodingTestController');
        await CodingTestController.getCodingTest(req, res);
    } catch (error) {
        console.error('Error in coding test route:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Test code for a specific question
router.post('/test-code', authenticateStudent, async (req, res) => {
    try {
        const CodingTestController = require('../controllers/CodingTestController');
        // Set testId from body for this endpoint
        req.params.testId = req.body.testId;
        await CodingTestController.testQuestionCode(req, res);
    } catch (error) {
        console.error('Error in test code route:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Run code with custom input (for example test cases - Ctrl+')
router.post('/run-code', authenticateStudent, async (req, res) => {
    try {
        const { code, language, input } = req.body;
        
        console.log('🔍 Student run-code request:', {
            language,
            codeLength: code?.length,
            inputLength: input?.length
        });
        
        if (!code || !language) {
            console.log('❌ Missing code or language');
            return res.status(400).json({
                success: false,
                message: 'Code and language are required'
            });
        }

        const judge0Service = require('../services/judge0Service');
        const languageId = judge0Service.getLanguageId(language);
        
        if (!languageId) {
            console.log('❌ Unsupported language:', language);
            return res.status(400).json({
                success: false,
                message: `Unsupported language: ${language}`
            });
        }

        console.log('🚀 Submitting code to Judge0:', { language, languageId });
        
        const result = await judge0Service.submitCode(code, languageId, input || '');
        
        console.log('✅ Judge0 result:', {
            statusId: result.status?.id,
            statusDescription: result.status?.description,
            hasOutput: !!result.stdout,
            hasError: !!result.stderr
        });
        
        res.json({
            success: true,
            output: result.stdout || '',
            error: result.stderr || result.compile_output || '',
            time: result.time,
            memory: result.memory
        });
        
    } catch (error) {
        console.error('💥 Error running code:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to execute code',
            error: error.message 
        });
    }
});

// Submit multi-question coding test
router.post('/submit-coding-test', authenticateStudent, async (req, res) => {
    try {
        const CodingTestController = require('../controllers/CodingTestController');
        // Set testId from body for this endpoint
        req.params.testId = req.body.testId;
        await CodingTestController.submitMultiQuestionTest(req, res);
    } catch (error) {
        console.error('Error in submit coding test route:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

module.exports = router;