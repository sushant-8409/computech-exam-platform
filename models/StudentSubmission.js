const mongoose = require('mongoose');

// Get connection from CodingProblem model
const CodingProblem = require('./CodingProblem');
const connection = CodingProblem.db;

const studentSubmissionSchema = new mongoose.Schema({
  studentId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Student',
    required: true 
  },
  problemId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'CodingProblem',
    required: true 
  },
  
  // Submission details
  language: { 
    type: String, 
    enum: ['python', 'java', 'cpp', 'c'], 
    required: true 
  },
  code: { type: String, required: true },
  
  // Execution results
  status: { 
    type: String, 
    enum: ['Accepted', 'Wrong Answer', 'Time Limit Exceeded', 'Runtime Error', 'Compilation Error', 'Running'],
    default: 'Running'
  },
  
  // Test case results
  totalTestCases: { type: Number, default: 0 },
  passedTestCases: { type: Number, default: 0 },
  failedTestCases: { type: Number, default: 0 },
  
  // Performance metrics
  executionTime: { type: Number }, // in milliseconds
  memoryUsed: { type: Number }, // in KB
  
  // Score
  score: { type: Number, default: 0 },
  maxScore: { type: Number, default: 0 },
  percentage: { type: Number, default: 0 },
  
  // Detailed results
  testCaseResults: [{
    testCaseNumber: Number,
    input: String,
    expectedOutput: String,
    actualOutput: String,
    stderr: String,
    passed: Boolean,
    executionTime: Number,
    memory: Number,
    points: Number
  }],
  
  // Submission metadata
  submissionType: { 
    type: String, 
    enum: ['run', 'submit'], 
    default: 'submit' 
  }, // 'run' for testing, 'submit' for final
  
  // Practice session info
  timeSpent: { type: Number, default: 0 }, // in seconds
  attempts: { type: Number, default: 1 },
  
}, { 
  timestamps: true,
  collection: 'student_submissions'
});

// Indexes for efficient queries
studentSubmissionSchema.index({ studentId: 1, problemId: 1 });
studentSubmissionSchema.index({ studentId: 1, status: 1 });
studentSubmissionSchema.index({ problemId: 1, status: 1 });
studentSubmissionSchema.index({ language: 1 });
studentSubmissionSchema.index({ createdAt: -1 });

// Get student's best submission for a problem
studentSubmissionSchema.statics.getBestSubmission = async function(studentId, problemId) {
  return await this.findOne({
    studentId,
    problemId,
    status: 'Accepted'
  }).sort({ score: -1, createdAt: -1 });
};

// Get student's latest submission for a problem
studentSubmissionSchema.statics.getLatestSubmission = async function(studentId, problemId) {
  return await this.findOne({
    studentId,
    problemId
  }).sort({ createdAt: -1 });
};

// Get student's problem solving statistics
studentSubmissionSchema.statics.getStudentStats = async function(studentId) {
  // Get overall submission stats (only count 'submit' type, not 'run')
  const overallStats = await this.aggregate([
    { $match: { 
      studentId: new mongoose.Types.ObjectId(studentId),
      submissionType: 'submit' // Only count actual submissions, not run attempts
    }},
    {
      $group: {
        _id: null,
        totalSubmissions: { $sum: 1 },
        acceptedSubmissions: { $sum: { $cond: [{ $eq: ['$status', 'Accepted'] }, 1, 0] } },
        languagesUsed: { $addToSet: '$language' }
      }
    }
  ]);

  // Get problem-based stats (unique problems attempted and solved, only count 'submit' type)
  const problemStats = await this.aggregate([
    { $match: { 
      studentId: new mongoose.Types.ObjectId(studentId),
      submissionType: 'submit' // Only count actual submissions, not run attempts
    }},
    {
      $group: {
        _id: '$problemId',
        hasAccepted: { $max: { $cond: [{ $eq: ['$status', 'Accepted'] }, 1, 0] } }
      }
    },
    {
      $group: {
        _id: null,
        totalProblems: { $sum: 1 },
        solvedProblems: { $sum: '$hasAccepted' }
      }
    }
  ]);

  if (overallStats.length === 0) {
    return {
      totalProblems: 0,
      solvedProblems: 0,
      totalSubmissions: 0,
      acceptedSubmissions: 0,
      languagesUsed: [],
      accuracyRate: 0
    };
  }

  const overall = overallStats[0];
  const problems = problemStats[0] || { totalProblems: 0, solvedProblems: 0 };
  
  return {
    totalProblems: problems.totalProblems,
    solvedProblems: problems.solvedProblems,
    totalSubmissions: overall.totalSubmissions,
    acceptedSubmissions: overall.acceptedSubmissions,
    languagesUsed: overall.languagesUsed,
    accuracyRate: overall.totalSubmissions > 0 ? (overall.acceptedSubmissions / overall.totalSubmissions) * 100 : 0
  };
};

// Get language-wise submission statistics (only count 'submit' type)
studentSubmissionSchema.statics.getLanguageStats = async function(studentId) {
  return await this.aggregate([
    { $match: { 
      studentId: new mongoose.Types.ObjectId(studentId),
      submissionType: 'submit' // Only count actual submissions, not run attempts
    }},
    {
      $group: {
        _id: '$language',
        totalSubmissions: { $sum: 1 },
        acceptedSubmissions: { 
          $sum: { $cond: [{ $eq: ['$status', 'Accepted'] }, 1, 0] } 
        },
        avgScore: { $avg: '$score' }
      }
    },
    {
      $project: {
        language: '$_id',
        totalSubmissions: 1,
        acceptedSubmissions: 1,
        successRate: { 
          $multiply: [
            { $divide: ['$acceptedSubmissions', '$totalSubmissions'] }, 
            100
          ] 
        },
        avgScore: { $round: ['$avgScore', 2] }
      }
    },
    { $sort: { totalSubmissions: -1 } }
  ]);
};

// Get student rankings based on problems solved * difficulty rating
studentSubmissionSchema.statics.getStudentRankings = async function() {
  const CodingProblem = require('./CodingProblem');
  
  const rankings = await this.aggregate([
    // Match only accepted submissions of type 'submit' (not run attempts)
    { $match: { 
      status: 'Accepted',
      submissionType: 'submit'
    }},
    
    // Group by student and problem to avoid counting duplicate solves
    {
      $group: {
        _id: { studentId: '$studentId', problemId: '$problemId' },
        firstSolved: { $min: '$createdAt' }
      }
    },
    
    // Lookup problem details for difficulty
    {
      $lookup: {
        from: 'coding_problems',
        localField: '_id.problemId',
        foreignField: '_id',
        as: 'problem'
      }
    },
    
    // Unwind problem data
    { $unwind: '$problem' },
    
    // Add difficulty rating (Easy=1, Medium=2, Hard=3)
    {
      $addFields: {
        difficultyRating: {
          $switch: {
            branches: [
              { case: { $eq: ['$problem.difficulty', 'Easy'] }, then: 1 },
              { case: { $eq: ['$problem.difficulty', 'Medium'] }, then: 2 },
              { case: { $eq: ['$problem.difficulty', 'Hard'] }, then: 3 }
            ],
            default: 1
          }
        }
      }
    },
    
    // Group by student to calculate total score
    {
      $group: {
        _id: '$_id.studentId',
        totalScore: { $sum: '$difficultyRating' },
        problemsSolved: { $sum: 1 },
        easyProblems: {
          $sum: { $cond: [{ $eq: ['$problem.difficulty', 'Easy'] }, 1, 0] }
        },
        mediumProblems: {
          $sum: { $cond: [{ $eq: ['$problem.difficulty', 'Medium'] }, 1, 0] }
        },
        hardProblems: {
          $sum: { $cond: [{ $eq: ['$problem.difficulty', 'Hard'] }, 1, 0] }
        },
        lastSolved: { $max: '$firstSolved' }
      }
    },
    
    // Lookup student details
    {
      $lookup: {
        from: 'students',
        localField: '_id',
        foreignField: '_id',
        as: 'student'
      }
    },
    
    // Project final fields (handle missing student data gracefully)
    {
      $project: {
        studentId: '$_id',
        studentName: { 
          $ifNull: [
            { $arrayElemAt: ['$student.name', 0] }, 
            'Unknown Student'
          ]
        },
        email: { 
          $ifNull: [
            { $arrayElemAt: ['$student.email', 0] }, 
            'unknown@example.com'
          ]
        },
        totalScore: 1,
        problemsSolved: 1,
        easyProblems: 1,
        mediumProblems: 1,
        hardProblems: 1,
        lastSolved: 1
      }
    },
    
    // Sort by total score (descending), then by problems solved (descending)
    { $sort: { totalScore: -1, problemsSolved: -1, lastSolved: 1 } }
  ]);
  
  // Add rank to each student
  return rankings.map((student, index) => ({
    ...student,
    rank: index + 1
  }));
};

// Get specific student's ranking
studentSubmissionSchema.statics.getStudentRank = async function(studentId) {
  const rankings = await this.getStudentRankings();
  return rankings.find(ranking => ranking.studentId.toString() === studentId.toString()) || null;
};

module.exports = connection.model('StudentSubmission', studentSubmissionSchema);