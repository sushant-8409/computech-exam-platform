const mongoose = require('mongoose');

const mockTestResultSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  testId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MockTest',
    required: true
  },
  testTitle: {
    type: String,
    required: true
  },
  subject: {
    type: String,
    required: true
  },
  questionType: {
    type: String,
    enum: ['mcq', 'subjective'],
    required: true
  },
  answers: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  marksObtained: {
    type: Number,
    default: 0
  },
  totalMarks: {
    type: Number,
    required: true
  },
  percentage: {
    type: Number,
    default: 0
  },
  timeTaken: {
    type: Number, // in seconds
    required: true
  },
  questionWiseMarks: [{
    questionNo: Number,
    question: String,
    studentAnswer: String,
    correctAnswer: String,
    isCorrect: Boolean,
    maxMarks: Number,
    obtainedMarks: Number,
    feedback: String
  }],
  submittedAt: {
    type: Date,
    default: Date.now
  },
  evaluatedAt: Date,
  status: {
    type: String,
    enum: ['pending_evaluation', 'completed', 'evaluated'],
    default: 'pending_evaluation'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('MockTestResult', mockTestResultSchema);
