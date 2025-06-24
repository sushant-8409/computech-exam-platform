const mongoose = require('mongoose');

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
    default: null 
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
    enum: ['manual_submit', 'auto_submit', 'manual_exit', 'auto_exit'],
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
  violations: {
    type: [mongoose.Schema.Types.Mixed],
    default: []
  },
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
    enum: ['pending', 'reviewed', 'published', 'under review', 'submitted', 'exited', 'auto_submitted', 'auto_exited'], 
    default: 'pending' 
  }
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

// ✅ ADDED: Calculate percentage virtual
resultSchema.virtual('percentage').get(function() {
  if (this.totalMarks && this.totalMarks > 0) {
    return Math.round((this.marksObtained / this.totalMarks) * 100 * 100) / 100; // Round to 2 decimals
  }
  return 0;
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
