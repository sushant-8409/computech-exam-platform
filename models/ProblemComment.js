const mongoose = require('mongoose');

const problemCommentSchema = new mongoose.Schema({
  problemId: { 
    type: mongoose.Schema.Types.ObjectId, 
    required: true,
    ref: 'CodingProblem'
  },
  author: { 
    type: mongoose.Schema.Types.ObjectId, 
    required: true,
    ref: 'Student'
  },
  content: { 
    type: String, 
    required: true,
    maxlength: 1000
  },
  upvotes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student'
  }],
  downvotes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student'
  }],
  replies: [{
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true
    },
    content: {
      type: String,
      required: true,
      maxlength: 500
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Update the updatedAt field before saving
problemCommentSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Create indexes for efficient querying
problemCommentSchema.index({ problemId: 1, createdAt: -1 });
problemCommentSchema.index({ author: 1 });

module.exports = mongoose.model('ProblemComment', problemCommentSchema);