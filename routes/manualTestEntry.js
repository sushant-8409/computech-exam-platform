const express = require('express');
const multer = require('multer');
const mongoose = require('mongoose');
const router = express.Router();
const Test = require('../models/Test');
const Result = require('../models/Result');
const Student = require('../models/Student');
const User = require('../models/User');
const { authenticateAdmin } = require('../middleware/auth');
const { uploadToGDrive: uploadViaOauth } = require('../services/oauthDrive');

// Configure multer for file uploads
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only PDF, JPG, JPEG, and PNG files are allowed.'));
        }
    }
});

// POST /api/admin/manual-test/upload - Upload files for manual test entry
router.post('/manual-test/upload', authenticateAdmin, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file provided'
            });
        }

        const { fileType, category } = req.body;
        const file = req.file;

        console.log('Uploading file:', {
            filename: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            fileType,
            category
        });

        // Create a descriptive filename
        const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
        const fileName = `${category || 'manual-test'}-${fileType || 'file'}-${timestamp}-${file.originalname}`;

        let uploadResult;
        let fileUrl;

        try {
            // Get tokens for upload - priority: environment > admin database
            let tokens = null;
            let tokenSource = 'none';

            // Priority 1: Use environment tokens
            if (process.env.GOOGLE_ACCESS_TOKEN) {
                tokens = {
                    access_token: process.env.GOOGLE_ACCESS_TOKEN,
                    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
                    token_type: process.env.GOOGLE_TOKEN_TYPE || 'Bearer',
                    expiry_date: process.env.GOOGLE_TOKEN_EXPIRY ? parseInt(process.env.GOOGLE_TOKEN_EXPIRY) : undefined
                };
                tokenSource = 'environment';
                console.log('✅ Using environment tokens for manual test upload');
            } else {
                // Fallback: Get OAuth2 tokens from database
                const adminUser = await User.findOne({ role: 'admin' });
                
                if (!adminUser || !adminUser.googleTokens) {
                    console.log('❌ No Google tokens found in database or environment, falling back to local storage');
                    throw new Error('No Google tokens available');
                }

                tokens = adminUser.googleTokens;
                tokenSource = 'admin-database';
                console.log('✅ Using admin database tokens for manual test upload');
            }
            
            // Try to upload to Google Drive using tokens
            console.log(`🔄 Attempting Google Drive upload with ${tokenSource} tokens...`);
            uploadResult = await uploadViaOauth(
                tokens,
                file.buffer,
                fileName,
                file.mimetype
            );
            
            fileUrl = uploadResult.webViewLink || uploadResult.webContentLink || uploadResult.url;
            console.log('✅ File uploaded to Google Drive successfully:', uploadResult);
            
        } catch (driveError) {
            console.log('❌ Google Drive upload failed, using local storage fallback');
            console.error('Drive error details:', driveError.message);
            
            // Fallback: Save file locally in tmp directory
            const fs = require('fs').promises;
            const path = require('path');
            
            const tmpDir = path.join(__dirname, '..', 'tmp');
            const localFilePath = path.join(tmpDir, fileName);
            
            // Ensure tmp directory exists
            try {
                await fs.access(tmpDir);
            } catch {
                await fs.mkdir(tmpDir, { recursive: true });
            }
            
            // Save file locally
            await fs.writeFile(localFilePath, file.buffer);
            
            // Create a local file URL (relative to server)
            fileUrl = `/tmp/${fileName}`;
            
            console.log('✅ File saved locally:', localFilePath);
            uploadResult = {
                id: fileName,
                name: fileName,
                webViewLink: fileUrl,
                url: fileUrl,
                location: 'local'
            };
        }

        res.json({
            success: true,
            message: uploadResult.location === 'local' ? 
                'File uploaded successfully (saved locally)' : 
                'File uploaded successfully to Google Drive',
            fileUrl: fileUrl,
            fileName: fileName,
            originalName: file.originalname,
            fileId: uploadResult.id,
            storage: uploadResult.location || 'gdrive',
            url: fileUrl // Add this for consistency
        });

    } catch (error) {
        console.error('File upload error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to upload file',
            error: error.message
        });
    }
});

// GET /api/admin/manual-test/students - Get all students for manual test entry
router.get('/manual-test/students', authenticateAdmin, async (req, res) => {
    try {
        const students = await Student.find({}, {
            name: 1,
            email: 1,
            rollNo: 1,
            class: 1,
            board: 1,
            school: 1,
            status: 1
        }).sort({ name: 1 });

        res.json({
            success: true,
            students: students.filter(student => student.status === 'active')
        });
    } catch (error) {
        console.error('Error fetching students for manual entry:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch students',
            error: error.message
        });
    }
});

// GET /api/admin/manual-test/search-students - Search students for manual test entry
router.get('/manual-test/search-students', (req, res, next) => {
    console.log('🎯 SEARCH ENDPOINT HIT - Raw request received');
    console.log('🔍 Query params:', req.query);
    console.log('🔒 Headers:', req.headers.authorization ? 'Has auth token' : 'No auth token');
    next();
}, authenticateAdmin, async (req, res) => {
    try {
        const { query } = req.query;
        
        console.log('🔍 Student search endpoint called with query:', query);
        console.log('👤 User from auth:', req.user ? req.user.name : 'No user found');
        
        if (!query || query.trim().length === 0) {
            console.log('📭 Empty query, returning empty results');
            return res.json({
                success: true,
                students: []
            });
        }

        const searchRegex = new RegExp(query.trim(), 'i');
        
        console.log('🔎 Search regex pattern:', searchRegex);
        console.log('🗄️ Starting database query...');
        
        // First try a simple search without status filters to see if we have any data
        let students = await Student.find({
            $or: [
                { name: searchRegex },
                { email: searchRegex },
                { rollNo: searchRegex },
                { mobile: searchRegex },
                { phone: searchRegex }
            ]
        }, {
            name: 1,
            email: 1,
            rollNo: 1,
            class: 1,
            board: 1,
            school: 1,
            mobile: 1,
            phone: 1,
            subject: 1,
            status: 1,
            approved: 1
        }).sort({ name: 1 }).limit(20);

        console.log(`📋 Raw student search for "${query}": ${students.length} results found`);
        console.log('📊 Student statuses:', students.map(s => ({ 
            name: s.name, 
            status: s.status, 
            approved: s.approved 
        })));
        
        // Filter for active/approved students after getting results
        const filteredStudents = students.filter(student => 
            student.status === 'active' || 
            student.approved === true || 
            (!student.hasOwnProperty('status') && student.approved === true)
        );
        
        console.log(`✅ Filtered active students: ${filteredStudents.length}`);
        students = filteredStudents;
        console.log('👥 First few results:', students.slice(0, 3).map(s => ({ name: s.name, email: s.email })));
        
        // Add phone field mapping for compatibility
        const formattedStudents = students.map(student => ({
            ...student.toObject(),
            phone: student.phone || student.mobile
        }));

        res.json({
            success: true,
            students: formattedStudents
        });
    } catch (error) {
        console.error('❌ Error searching students:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to search students',
            error: error.message
        });
    }
});

// POST /api/admin/manual-test/create - Create test and result with question-wise marks
router.post('/manual-test/create', authenticateAdmin, async (req, res) => {
    try {
        const { testData, studentId, questions, fileUrls } = req.body;

        console.log('📋 Creating manual test entry with question-wise marks:');
        console.log('   - Test Title:', testData.title);
        console.log('   - Student ID:', studentId);
        console.log('   - Questions Count:', questions?.length);
        console.log('   - Total Questions:', testData.totalQuestions);
        console.log('🗂️ File URLs received:');
        console.log('   - Question Paper URL:', fileUrls?.questionPaper || 'NOT PROVIDED');
        console.log('   - Answer Sheet URL:', fileUrls?.answerSheet || 'NOT PROVIDED');
        console.log('   - Answer Key URL:', fileUrls?.answerKey || 'NOT PROVIDED');

        // Validate required fields
        if (!testData.title || !testData.subject || !testData.totalQuestions) {
            return res.status(400).json({
                success: false,
                message: 'Missing required test data: title, subject, and totalQuestions are required'
            });
        }

        if (!studentId || !questions || questions.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Missing required data: studentId and questions are required'
            });
        }

        // Validate student exists
        const student = await Student.findById(studentId);
        if (!student) {
            return res.status(404).json({
                success: false,
                message: 'Student not found'
            });
        }

        // Calculate totals from question-wise marks
        const totalMarks = questions.reduce((sum, q) => sum + (parseFloat(q.maxMarks) || 0), 0);
        const marksObtained = questions.reduce((sum, q) => sum + (parseFloat(q.obtainedMarks) || 0), 0);

        // Validate question-wise marks
        for (const question of questions) {
            if (question.obtainedMarks < 0 || question.obtainedMarks > question.maxMarks) {
                return res.status(400).json({
                    success: false,
                    message: `Question ${question.questionNo}: Obtained marks cannot exceed max marks`
                });
            }
        }

        // Prepare test dates - for manual entries, use provided testDate or current date
        const testDate = testData.testDate ? new Date(testData.testDate) : new Date();
        const startDate = new Date(testDate);
        startDate.setHours(0, 0, 0, 0); // Start of day
        const endDate = new Date(testDate);
        endDate.setHours(23, 59, 59, 999); // End of day

        // Calculate passing marks (default to 40% if not provided)
        const passingMarks = testData.passingMarks || Math.ceil(totalMarks * 0.4);

        // Create a dummy admin ObjectId for manual entries (since req.user.id is "admin" string)
        const adminObjectId = new mongoose.Types.ObjectId();

        // Create the test
        const newTest = new Test({
            ...testData,
            totalMarks,
            passingMarks,
            totalQuestions: testData.totalQuestions,
            questionsCount: testData.totalQuestions,
            duration: parseInt(testData.duration) || 60, // Default 60 minutes if not provided
            startDate,
            endDate,
            createdBy: adminObjectId, // Use proper ObjectId
            isManualEntry: true,
            testType: testData.testType || 'offline',
            status: 'published',
            questions: [], // Empty for manual entry
            questionPaperURL: fileUrls?.questionPaper,
            answerKeyURL: fileUrls?.answerKey
        });

        console.log('💾 Test object before saving:');
        console.log('   - Question Paper URL:', newTest.questionPaperURL || 'NOT SET');
        console.log('   - Answer Key URL:', newTest.answerKeyURL || 'NOT SET');

        const savedTest = await newTest.save();
        console.log('✅ Test created with ID:', savedTest._id);
        console.log('✅ Test saved with URLs:');
        console.log('   - Question Paper URL:', savedTest.questionPaperURL || 'NOT SAVED');
        console.log('   - Answer Key URL:', savedTest.answerKeyURL || 'NOT SAVED');

        // Calculate percentage and grade
        const percentage = totalMarks > 0 ? (marksObtained / totalMarks) * 100 : 0;
        const grade = percentage >= 90 ? 'A+' :
                     percentage >= 80 ? 'A' :
                     percentage >= 70 ? 'B+' :
                     percentage >= 60 ? 'B' :
                     percentage >= 50 ? 'C+' :
                     percentage >= 40 ? 'C' : 'F';

        // Prepare question-wise marks for result
        const questionWiseMarks = questions.map(q => ({
            questionNo: q.questionNo,
            maxMarks: parseFloat(q.maxMarks) || 0,
            obtainedMarks: parseFloat(q.obtainedMarks) || 0,
            remarks: q.remarks || '',
            markedBy: adminObjectId, // Use the same ObjectId as test creator
            markedAt: new Date()
        }));

        // Create the result with status as "reviewed"
        const newResult = new Result({
            testId: savedTest._id,
            studentId,
            testTitle: testData.title,
            testSubject: testData.subject,
            marksObtained,
            totalMarks,
            totalQuestions: testData.totalQuestions,
            percentage,
            grade,
            status: 'reviewed', // Automatically set as reviewed
            submittedAt: new Date(),
            startedAt: new Date(),
            questionWiseMarks, // Store question-wise marks
            answers: {}, // Empty for manual entry
            isManualEntry: true,
            enteredBy: adminObjectId, // Use proper ObjectId
            answerSheetURL: fileUrls?.answerSheet,
            adminComments: `Manual entry by ${req.user.name || 'Administrator'} on ${new Date().toLocaleString()}`,
            submissionType: 'manual_submit',
            timeTaken: 0 // Not applicable for manual entry
        });

        console.log('💾 Result object before saving:');
        console.log('   - Answer Sheet URL:', newResult.answerSheetURL || 'NOT SET');

        const savedResult = await newResult.save();
        console.log('✅ Result created with ID:', savedResult._id);
        console.log('✅ Result saved with Answer Sheet URL:', savedResult.answerSheetURL || 'NOT SAVED');

        // Populate the result with test and student data for response
        const populatedResult = await Result.findById(savedResult._id)
            .populate('testId', 'title subject totalMarks')
            .populate('studentId', 'name email rollNo class');

        res.status(201).json({
            success: true,
            message: 'Manual test entry created successfully',
            test: savedTest,
            result: populatedResult
        });

    } catch (error) {
        console.error('Error creating manual test entry:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create manual test entry',
            error: error.message
        });
    }
});

// GET /api/admin/manual-test/manual-entries - Get all manual test entries
router.get('/manual-test/manual-entries', authenticateAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const results = await Result.find({ isManualEntry: true })
            .populate('testId', 'title subject totalMarks testDate createdBy')
            .populate('studentId', 'name email rollNo class')
            .populate('enteredBy', 'name email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalResults = await Result.countDocuments({ isManualEntry: true });

        res.json({
            success: true,
            results,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalResults / limit),
                totalResults,
                hasNextPage: page < Math.ceil(totalResults / limit),
                hasPrevPage: page > 1
            }
        });

    } catch (error) {
        console.error('Error fetching manual entries:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch manual entries',
            error: error.message
        });
    }
});

// PUT /api/admin/manual-test/manual-entries/:resultId - Update manual test entry
router.put('/manual-test/manual-entries/:resultId', authenticateAdmin, async (req, res) => {
    try {
        const { resultId } = req.params;
        const { marksObtained, remarks, grade } = req.body;

        const result = await Result.findOne({ 
            _id: resultId, 
            isManualEntry: true 
        });

        if (!result) {
            return res.status(404).json({
                success: false,
                message: 'Manual test entry not found'
            });
        }

        // Validate marks if provided
        if (marksObtained !== undefined) {
            if (marksObtained < 0 || marksObtained > result.totalMarks) {
                return res.status(400).json({
                    success: false,
                    message: 'Marks obtained must be between 0 and total marks'
                });
            }

            result.marksObtained = marksObtained;
            result.percentage = (marksObtained / result.totalMarks) * 100;
            
            // Auto-calculate grade if not provided
            if (!grade) {
                const percentage = result.percentage;
                result.grade = percentage >= 90 ? 'A+' :
                              percentage >= 80 ? 'A' :
                              percentage >= 70 ? 'B+' :
                              percentage >= 60 ? 'B' :
                              percentage >= 50 ? 'C+' :
                              percentage >= 40 ? 'C' : 'F';
            }
        }

        if (grade) {
            result.grade = grade;
        }

        if (remarks !== undefined) {
            result.remarks = remarks;
        }

        result.updatedAt = new Date();
        await result.save();

        const updatedResult = await Result.findById(result._id)
            .populate('testId', 'title subject totalMarks')
            .populate('studentId', 'name email rollNo class')
            .populate('enteredBy', 'name email');

        res.json({
            success: true,
            message: 'Manual test entry updated successfully',
            result: updatedResult
        });

    } catch (error) {
        console.error('Error updating manual test entry:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update manual test entry',
            error: error.message
        });
    }
});

// DELETE /api/admin/manual-test/manual-entries/:resultId - Delete manual test entry
router.delete('/manual-test/manual-entries/:resultId', authenticateAdmin, async (req, res) => {
    try {
        const { resultId } = req.params;

        const result = await Result.findOne({ 
            _id: resultId, 
            isManualEntry: true 
        });

        if (!result) {
            return res.status(404).json({
                success: false,
                message: 'Manual test entry not found'
            });
        }

        // Also delete the associated test if it was created for manual entry
        const test = await Test.findById(result.testId);
        if (test && test.isManualEntry) {
            await Test.findByIdAndDelete(test._id);
            console.log('Deleted associated manual test:', test._id);
        }

        await Result.findByIdAndDelete(resultId);
        console.log('Deleted manual result entry:', resultId);

        res.json({
            success: true,
            message: 'Manual test entry deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting manual test entry:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete manual test entry',
            error: error.message
        });
    }
});

module.exports = router;
