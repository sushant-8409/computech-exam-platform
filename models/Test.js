
const mongoose = require('mongoose');

const testSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  subject: { type: String, required: true },
  class: { type: String, required: true },
  board: { type: String, required: true },
  school: { type: String },
  duration: { type: Number, required: true },
  totalMarks: { type: Number, required: true },
  passingMarks: { type: Number, required: true },
  questionsCount: { type: Number, required: true },
  questionPaperURL: { type: String },
  answerKeyURL: { type: String, required: false },
  answerKeyVisible: { type: Boolean, default: false },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  active: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  blockedStudents: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: 'Student',
    default: []
    },

  // Manual entry fields
  isManualEntry: { type: Boolean, default: false },
  testType: { type: String, enum: ['online', 'offline', 'hybrid'], default: 'online' },
  testDate: { type: Date },
  instructions: { type: String, default: '' },
  status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft' },

  // Additional fields
  proctoringSettings: {
    strictMode: { type: Boolean, default: true },
    allowTabSwitch: { type: Number, default: 0 },
    requireFullscreen: { type: Boolean, default: true },
    blockRightClick: { type: Boolean, default: true },
    blockKeyboardShortcuts: { type: Boolean, default: true },
    maxViolations: { type: Number, default: 10, max: 10 } // Max 10 violations allowed
  },
  resumeEnabled: { type: Boolean, default: true },
  resumeData: [{ type: mongoose.Schema.Types.Mixed }],

  // Camera Monitoring Settings
  cameraMonitoring: {
    enabled: { type: Boolean, default: false },
    captureInterval: { type: Number, default: 60 }, // seconds between captures
    saveToGoogleDrive: { type: Boolean, default: true },
    requireCameraAccess: { type: Boolean, default: false },
    faceDetection: { type: Boolean, default: false },
    suspiciousActivityDetection: { type: Boolean, default: true }
  },

  // Paper submission settings
  paperSubmissionRequired: { type: Boolean, default: false },
  paperUploadTimeLimit: { type: Number, default: 15 }, // in minutes
  paperUploadAllowedDuringTest: { type: Boolean, default: false },

  // Coding test settings - Enhanced for multiple questions
  type: { 
    type: String, 
    enum: ['traditional', 'coding'], 
    default: 'traditional' 
  },
  coding: {
    questions: [{
      id: { type: String, required: true },
      title: { type: String, required: true },
      description: { type: String, required: true },
      inputFormat: { type: String },
      outputFormat: { type: String },
      constraints: { type: String },
      examples: [{
        input: { type: String },
        output: { type: String },
        explanation: { type: String }
      }],
      testCases: [{
        input: { type: String, required: true },
        expectedOutput: { type: String, required: true },
        points: { type: Number, default: 1 },
        isHidden: { type: Boolean, default: true }
      }],
      starterCode: {
        python: { type: String },
        java: { type: String },
        c: { type: String },
        cpp: { type: String },
        javascript: { type: String }
      },
      marks: { type: Number, required: true, default: 10 },
      timeLimit: { type: Number, default: 2 }, // seconds per test case
      memoryLimit: { type: Number, default: 256 }, // MB
      difficulty: { 
        type: String, 
        enum: ['easy', 'medium', 'hard'], 
        default: 'medium' 
      }
    }],
    totalQuestions: { type: Number, default: 1 },
    allowQuestionSwitching: { type: Boolean, default: true },
    showQuestionProgress: { type: Boolean, default: true }
  },
  
  // Legacy coding test fields (for backward compatibility)
  isCodingTest: { type: Boolean, default: false },
  codingLanguage: { 
    type: String, 
    enum: ['python', 'java', 'c', 'cpp', 'javascript'], 
    default: 'python' 
  },
  codingProblem: {
    title: { type: String },
    description: { type: String },
    inputFormat: { type: String },
    outputFormat: { type: String },
    constraints: { type: String },
    examples: [{
      input: { type: String },
      output: { type: String },
      explanation: { type: String }
    }],
    testCases: [{
      input: { type: String, required: true },
      expectedOutput: { type: String, required: true },
      points: { type: Number, default: 1 },
      isHidden: { type: Boolean, default: true }
    }],
    starterCode: {
      python: { type: String },
      java: { type: String },
      c: { type: String },
      cpp: { type: String },
      javascript: { type: String }
    },
    timeLimit: { type: Number, default: 2 }, // seconds
    memoryLimit: { type: Number, default: 256 } // MB
  }
}, {
  collection: 'tests',
  timestamps: true,
  strict: false
});
// Add this pre-save hook to ensure proper key storage
// In models/Test.js pre-save hook
testSchema.pre('save', function(next) {
  if (this.isModified('questionPaperURL')) {
    // Remove any Backblaze key processing
    // Just store the URL as-is
    this.questionPaperURL = this.questionPaperURL;
  }
  if (this.totalMarks <= 0) {
    this.invalidate('totalMarks', 'Total marks must be greater than zero');
  }
  next();
});



module.exports = mongoose.model('Test', testSchema);
