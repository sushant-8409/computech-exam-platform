const mongoose = require('mongoose');

const studentDoubtSchema = new mongoose.Schema({
  problemId: { 
    type: mongoose.Schema.Types.ObjectId, 
    required: true,
    ref: 'CodingProblem'
  },
  studentId: { 
    type: mongoose.Schema.Types.ObjectId, 
    required: true,
    ref: 'Student'
  },
  query: { 
    type: String, 
    required: true,
    maxlength: 1000
  },
  response: { 
    type: String, 
    required: true,
    maxlength: 5000
  },
  language: {
    type: String,
    required: true,
    enum: ['python', 'java', 'cpp', 'c', 'javascript']
  },
  studentCode: {
    type: String,
    maxlength: 10000
  },
  helpful: {
    type: Boolean,
    default: null
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Create indexes for efficient querying
studentDoubtSchema.index({ problemId: 1, studentId: 1, createdAt: -1 });
studentDoubtSchema.index({ studentId: 1, createdAt: -1 });

module.exports = mongoose.model('StudentDoubt', studentDoubtSchema);