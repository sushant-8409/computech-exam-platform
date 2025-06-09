// models/ReviewResult.js
const mongoose = require('mongoose');

const reviewResultSchema = new mongoose.Schema({
  studentId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  testId:           { type: mongoose.Schema.Types.ObjectId, ref: 'Test',    required: true },
  answerSheetUrl:   { type: String, default: null },
  questionPaperUrl: { type: String, default: null },
  marksObtained:    { type: Number, min: 0, default: 0 },
  totalMarks:       { type: Number, required: true },
  questionWiseMarks:[{
    questionNo:    { type: Number, required: true },
    maxMarks:      { type: Number, required: true },
    obtainedMarks: { type: Number, default: 0 },
    remarks:       { type: String, default: '' },
    markedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    markedAt:      { type: Date }
  }],
  adminComments:    { type: String, default: '' },
  status:           { type: String, enum: ['pending','reviewed','published','under review'], default: 'pending' }
}, {
  timestamps: true
});

module.exports = mongoose.model('ReviewResult', reviewResultSchema);
