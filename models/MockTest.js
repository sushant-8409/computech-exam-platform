const mongoose = require('mongoose');

const mockTestSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  title: { type: String, required: true },
  subject: { type: String, required: true },
  chapters: [{ type: String, required: true }],
  studentClass: { type: String, required: true },
  studentBoard: { type: String, required: true },
  questionType: { type: String, enum: ['mcq', 'subjective', 'coding'], required: true },
  difficultyLevel: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
  timeLimit: { type: Number, required: true },
  questions: [{
    question: { type: String, required: true },
    marks: { type: Number, required: true },
    difficulty: String,
    chapter: String,
    // MCQ-specific
    options: [String],
    correctAnswer: String,
    explanation: String,
    // Subjective & Coding
    expectedAnswer: String,
    markingScheme: String,
    // Coding-specific
    boilerplate: String,
    expectedOutput: String,
  }],
  totalMarks: { type: Number, required: true },
  generatedAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('MockTest', mockTestSchema);