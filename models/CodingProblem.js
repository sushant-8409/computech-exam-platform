const mongoose = require('mongoose');

// Separate connection for coding practice database
let codingConnection = null;

const getCodingConnection = () => {
  if (!codingConnection) {
    // Use global questions database connection if available
    if (global.questionsDb) {
      codingConnection = global.questionsDb;
      console.log('✅ Using global questions database connection');
    } else {
      // Fallback to creating new connection
      const mongoUri2 = process.env.MONGOURI2 || process.env.MONGODB_URI;
      codingConnection = mongoose.createConnection(mongoUri2, {
        bufferCommands: false,
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });
      console.log('✅ Connected to coding practice MongoDB');
    }
  }
  return codingConnection;
};

const testCaseSchema = new mongoose.Schema({
  input: { type: String, required: true },
  expectedOutput: { type: String, required: true },
  isHidden: { type: Boolean, default: false }, // Sample test cases vs hidden
  points: { type: Number, default: 1 }
});

const codingProblemSchema = new mongoose.Schema({
  problemNumber: { type: Number, required: true, unique: true },
  title: { type: String, required: true },
  difficulty: { 
    type: String, 
    enum: ['Easy', 'Medium', 'Hard'], 
    required: true 
  },
  description: { type: String, required: true },
  constraints: { type: String },
  examples: [{
    input: String,
    output: String,
    explanation: String
  }],
  testCases: [testCaseSchema],
  
  // Language-specific starter code
  starterCode: {
    python: { type: String, default: '' },
    java: { type: String, default: '' },
    cpp: { type: String, default: '' },
    c: { type: String, default: '' }
  },
  
  // Official solution provided by admin (unlocked after correct submission)
  solution: {
    approach: { type: String, default: '' },
    code: {
      python: { type: String, default: '' },
      java: { type: String, default: '' },
      cpp: { type: String, default: '' },
      c: { type: String, default: '' }
    },
    timeComplexity: { type: String, default: '' },
    spaceComplexity: { type: String, default: '' },
    explanation: { type: String, default: '' }
  },
  
  // Problem metadata
  topics: [{ type: String }], // Array, Data Structures, etc.
  companies: [{ type: String }], // Google, Microsoft, etc.
  
  // Statistics
  totalSubmissions: { type: Number, default: 0 },
  acceptedSubmissions: { type: Number, default: 0 },
  acceptanceRate: { type: Number, default: 0 },
  
  // Admin fields
  createdBy: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  
}, { 
  timestamps: true,
  collection: 'coding_problems'
});

// Indexes for efficient queries (problemNumber index auto-created by unique: true)
codingProblemSchema.index({ difficulty: 1 });
codingProblemSchema.index({ topics: 1 });
codingProblemSchema.index({ title: 'text', description: 'text' });

// Auto-numbering middleware
codingProblemSchema.pre('save', async function(next) {
  if (this.isNew && !this.problemNumber) {
    try {
      const lastProblem = await this.constructor.findOne({}, {}, { sort: { problemNumber: -1 } });
      this.problemNumber = lastProblem ? lastProblem.problemNumber + 1 : 1;
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// Update acceptance rate middleware
codingProblemSchema.methods.updateAcceptanceRate = function() {
  if (this.totalSubmissions > 0) {
    this.acceptanceRate = (this.acceptedSubmissions / this.totalSubmissions) * 100;
  }
  return this.save();
};

// Get next problem number
codingProblemSchema.statics.getNextProblemNumber = async function() {
  const lastProblem = await this.findOne({}, {}, { sort: { problemNumber: -1 } });
  return lastProblem ? lastProblem.problemNumber + 1 : 1;
};

module.exports = getCodingConnection().model('CodingProblem', codingProblemSchema);