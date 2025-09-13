// Updated Result model with proper violations schema
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
let sharp;
try { sharp = require('sharp'); } catch(e) { sharp = null; }

const resultSchema = new mongoose.Schema({
  studentId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Student', 
    required: true 
  },
  testId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Test', 
    required: true 
  },
  // ✅ FIXED: Make testTitle required and add testSubject
  testTitle: { 
    type: String, 
    required: true  // ✅ Now required
  },
  testSubject: { 
    type: String,
    default: 'General' // ✅ Added with default
  },
  startedAt: { 
    type: Date, 
    default: Date.now  // ✅ Default to current time
  },
  submittedAt: { 
    type: Date, 
    default: null,
    // Ensure submittedAt is set when result is saved with certain statuses
    validate: {
      validator: function(value) {
        // If status indicates completion but no submittedAt, warn (but don't fail)
        if (['completed', 'done', 'published', 'reviewed'].includes(this.status) && !value) {
          console.warn(`Result ${this._id} has completion status but no submittedAt`);
        }
        return true;
      }
    }
  },
  answerSheetUrl: { 
    type: String, 
    default: null 
  },
  marksObtained: { 
    type: Number, 
    min: 0, 
    default: 0 
  },
  totalMarks: { 
    type: Number, 
    required: true,
    min: 0  // ✅ Added validation
  },
  // ✅ ADDED: Track submission method and reasons
  submissionType: {
    type: String,
    enum: ['manual_submit', 'auto_submit', 'manual_exit', 'auto_exit', 'multi_question_coding'],
    default: 'manual_submit'
  },
  exitReason: {
    type: String,
    default: null
  },
  timeTaken: {
    type: Number,
    default: 0,
    min: 0
  },
  answers: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  questionWiseMarks: [{
    questionNo: { type: Number, required: true },
    maxMarks: { type: Number, required: true },
    obtainedMarks: { type: Number, default: 0 },
    remarks: { type: String, default: '' },
    markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    markedAt: { type: Date }
  }],
  browserInfo: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  adminComments: { 
    type: String, 
    default: '' 
  },
  status: { 
    type: String, 
    enum: ['pending', 'done', 'completed', 'reviewed', 'published', 'under review'], 
    default: 'pending' 
  },
  
  // Manual entry fields
  isManualEntry: { type: Boolean, default: false },
  enteredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  answerSheetURL: { type: String },
  remarks: { type: String, default: '' },
  grade: { type: String },
  percentage: { type: Number },
  
  // Monitoring and proctoring data
  monitoringImages: [{
    url: String,
    data: String, // base64 data if url not available
    timestamp: { type: Date, default: Date.now },
    type: { type: String, enum: ['monitoring', 'suspicious'], default: 'monitoring' },
    flagged: { type: Boolean, default: false },
    driveFileId: String
  }],
  suspiciousActivities: [{
    timestamp: { type: Date, default: Date.now },
    type: String, // 'multiple_faces', 'unusual_eye_movement', etc.
    confidence: Number,
    description: String,
    severity: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' }
  }],
  violations: [{
    type: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    details: { type: String, default: '' },
    severity: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    sessionTime: { type: Number, default: 0 }
  }],
  totalViolations: { type: Number, default: 0 }, // Total count of violations
  proctoringSettings: { // Store the proctoring settings used for this test
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  cameraMonitoring: { type: Boolean, default: false },
  browserLockdown: { type: Boolean, default: false },
  fullscreenViolations: { type: Number, default: 0 },
  tabSwitchCount: { type: Number, default: 0 },
  testStartTime: Date,
  testEndTime: Date,
  
  // Resume functionality fields
  resumeAllowed: { type: Boolean, default: false },
  resumeApprovedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  resumeApprovedAt: { type: Date },
  
  // Coding test results
  codingResults: {
    totalQuestions: { type: Number, default: 0 },
    questionsAttempted: { type: Number, default: 0 },
    questionsCompleted: { type: Number, default: 0 },
    totalTestCases: { type: Number, default: 0 },
    passedTestCases: { type: Number, default: 0 },
    totalScore: { type: Number, default: 0 },
    maxScore: { type: Number, default: 0 },
    questionResults: [{
      questionId: { type: String, required: true },
      questionTitle: { type: String, required: true },
      language: { type: String, required: true },
      code: { type: String, required: true },
      testCases: [{
        input: String,
        expectedOutput: String,
        actualOutput: String,
        passed: Boolean,
        executionTime: Number,
        memory: Number,
        points: { type: Number, default: 0 },
        error: String
      }],
      totalTestCases: { type: Number, default: 0 },
      passedTestCases: { type: Number, default: 0 },
      score: { type: Number, default: 0 },
      maxScore: { type: Number, default: 0 },
      percentage: { type: Number, default: 0 },
      submittedAt: { type: Date, default: Date.now },
      executionTime: { type: Number, default: 0 }, // Total execution time
      codeQuality: {
        linesOfCode: Number,
        complexity: String,
        efficiency: String
      }
    }],
    overallPerformance: {
      accuracy: { type: Number, default: 0 }, // Percentage of test cases passed
      efficiency: { type: String, enum: ['excellent', 'good', 'average', 'poor'], default: 'average' },
      codeQuality: { type: String, enum: ['excellent', 'good', 'average', 'poor'], default: 'average' },
      timeManagement: { type: String, enum: ['excellent', 'good', 'average', 'poor'], default: 'average' }
    }
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ✅ ADDED: Pre-save middleware to ensure test info is populated
resultSchema.pre('save', async function(next) {
  // Only populate test info if testTitle is missing
  if (!this.testTitle || !this.totalMarks) {
    try {
      const Test = mongoose.model('Test');
      const test = await Test.findById(this.testId).select('title subject totalMarks duration');
      
      if (test) {
        if (!this.testTitle) this.testTitle = test.title;
        if (!this.testSubject) this.testSubject = test.subject;
        if (!this.totalMarks) this.totalMarks = test.totalMarks;
      }
    } catch (error) {
      console.error('Error populating test info in pre-save:', error);
    }
  }
  next();
});

// ✅ NEW: Persist base64 monitoring images to /tmp/monitoring/<resultId>/ ensuring <25kb each
resultSchema.pre('save', async function(next) {
  try {
    if (!this.isModified('monitoringImages') || !Array.isArray(this.monitoringImages) || this.monitoringImages.length === 0) {
      return next();
    }
    const resultId = this._id || new mongoose.Types.ObjectId();
    const baseDir = path.join(__dirname, '..', 'tmp', 'monitoring', resultId.toString());
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }
    await Promise.all(this.monitoringImages.map(async (img, idx) => {
      if (img && !img.url && (img.data || img.imageData)) {
        const b64 = (img.data || img.imageData);
        const match = b64.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/);
        if (!match) return; // skip invalid
        const ext = match[1] === 'png' ? 'jpg' : match[1];
        const buffer = Buffer.from(match[2], 'base64');
        let outBuffer = buffer;
        if (sharp) {
          try {
            let quality = 70;
            // iterative compression until <=25kb or quality floor
            for (; quality >= 30; quality -= 10) {
              const compressed = await sharp(buffer)
                .rotate()
                .resize({ width: 640, withoutEnlargement: true })
                .jpeg({ quality, mozjpeg: true })
                .toBuffer();
              if (compressed.length <= 25000) { outBuffer = compressed; break; }
              outBuffer = compressed; // keep latest even if >25kb
            }
          } catch (err) {
            // fallback keep original buffer
          }
        }
        const filename = `${idx}_${Date.now()}.jpg`;
        const filePath = path.join(baseDir, filename);
        fs.writeFileSync(filePath, outBuffer);
        img.url = `/tmp/monitoring/${resultId.toString()}/${filename}`;
        // Remove large inline data to reduce document size
        delete img.data; delete img.imageData; 
      }
    }));
  } catch (err) {
    console.error('Monitoring image persist error:', err.message);
  }
  next();
});

// Pre-save middleware to calculate percentage
resultSchema.pre('save', function(next) {
  if (this.totalMarks && this.totalMarks > 0 && this.marksObtained !== undefined) {
    this.percentage = Math.round((this.marksObtained / this.totalMarks) * 100 * 100) / 100; // Round to 2 decimals
  }
  next();
});

// Existing virtuals
resultSchema.virtual('student', {
  ref: 'Student',
  localField: 'studentId',
  foreignField: '_id',
  justOne: true
});

resultSchema.virtual('test', {
  ref: 'Test',
  localField: 'testId',
  foreignField: '_id',
  justOne: true
});

module.exports = mongoose.model('Result', resultSchema);
