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
   studentComments: { type: String, default: '' },
  // Add to ReviewResult schema
testVisibility: {
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  active: { type: Boolean, default: true }
},

  adminComments:    { type: String, default: '' },
  status:           { type: String, enum: ['pending','reviewed','published','under review'], default: 'pending' }
}, 
{
  timestamps: true
});
reviewResultSchema.virtual('student', {
  ref: 'Student',
  localField: 'studentId',
  foreignField: '_id',
  justOne: true
});

module.exports = mongoose.model('ReviewResult', reviewResultSchema);
