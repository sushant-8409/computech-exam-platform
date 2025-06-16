
const mongoose = require('mongoose');

const testSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  subject: { type: String, required: true },
  class: { type: String, required: true },
  board: { type: String, required: true },
  duration: { type: Number, required: true },
  totalMarks: { type: Number, required: true },
  passingMarks: { type: Number, required: true },
  questionsCount: { type: Number, required: true },
  questionPaperURL: { type: String },
  answerSheetURL: { type: String, required: false },
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

  // Additional fields
  proctoringSettings: {
    strictMode: { type: Boolean, default: true },
    allowTabSwitch: { type: Number, default: 0 },
    requireFullscreen: { type: Boolean, default: true },
    blockRightClick: { type: Boolean, default: true },
    blockKeyboardShortcuts: { type: Boolean, default: true }
  },
  resumeEnabled: { type: Boolean, default: true },
  resumeData: [{ type: mongoose.Schema.Types.Mixed }]
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
  next();
});



module.exports = mongoose.model('Test', testSchema);
