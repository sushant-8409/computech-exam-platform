const mongoose = require('mongoose');

const mockTestSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  subject: {
    type: String,
    required: true
  },
  chapters: [{
    type: String,
    required: true
  }],
  questionType: {
    type: String,
    enum: ['mcq', 'subjective'],
    required: true
  },
  difficultyLevel: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium'
  },
  timeLimit: {
    type: Number,
    required: true // in minutes
  },
  questions: [{
    question: {
      type: String,
      required: true
    },
    options: [String], // For MCQ only
    correctAnswer: String, // For MCQ only
    explanation: String, // For MCQ only
    expectedAnswer: String, // For subjective only
    markingScheme: String, // For subjective only
    marks: {
      type: Number,
      required: true
    },
    difficulty: String,
    chapter: String
  }],
  totalMarks: {
    type: Number,
    required: true
  },
  generatedAt: {
    type: Date,
    default: Date.now
  },
  geminiPrompt: String,
  geminiResponse: String,
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('MockTest', mockTestSchema);
