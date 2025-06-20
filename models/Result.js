// models/Result.js
const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema({
  studentId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  testId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Test',    required: true },
  testTitle:   { type: String },                     // store the title for easy admin view
  startedAt:   { type: Date,   default: null },      // when student began
  submittedAt: { type: Date,   default: null },      // when they exited or submitted
  answerSheetUrl: { type: String, default: null },   // optional URL
  marksObtained:  { type: Number, min: 0, default: 0 },
  totalMarks:     { type: Number, required: true },
  questionWiseMarks: [{
    questionNo:   { type: Number, required: true },
    maxMarks:     { type: Number, required: true },
    obtainedMarks:{ type: Number, default: 0 },
    remarks:      { type: String, default: '' },
    markedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    markedAt:     { type: Date }
  }],
   violations: {
    type: [mongoose.Schema.Types.Mixed],
    default: []
  },
  browserInfo: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  adminComments:{ type: String, default: '' },
  status:       { type: String, enum: ['pending','reviewed','published','under review'], default: 'pending' }
},
 {
  timestamps: true,
  toJSON:    { virtuals: true },
  toObject:  { virtuals: true }
});
resultSchema.virtual('student', {
  ref:         'Student',
  localField:  'studentId',
  foreignField:'_id',
  justOne:     true
});
// Virtual to fetch full Test document (including title, subject, etc.)
resultSchema.virtual('test', {
  ref: 'Test',
  localField:  'testId',
  foreignField:'_id',
  justOne:     true
});

module.exports = mongoose.model('Result', resultSchema);
