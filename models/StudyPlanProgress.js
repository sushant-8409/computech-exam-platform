const mongoose = require('mongoose');

// Use the same connection helper from CodingProblem
const getCodingConnection = () => {
  const { connection } = require('./CodingProblem');
  return connection;
};

const studyPlanProgressSchema = new mongoose.Schema({
  studentId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Student', 
    required: true 
  },
  groupId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'ProblemGroup', 
    required: true 
  },
  
  // Progress tracking
  startedAt: { type: Date, default: Date.now },
  lastAccessedAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
  
  // Problem completion tracking
  solvedProblems: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'CodingProblem' 
  }],
  totalProblems: { type: Number, default: 0 },
  
  // Study plan specific metrics
  currentStreak: { type: Number, default: 0 },
  maxStreak: { type: Number, default: 0 },
  totalTimeSpent: { type: Number, default: 0 }, // in minutes
  
  // Ranking and achievements
  rank: { type: Number }, // rank within this study plan
  achievements: [{
    type: { type: String }, // 'streak', 'completion', 'speed', etc.
    unlockedAt: { type: Date, default: Date.now },
    description: String
  }],
  
  // Study plan status
  status: { 
    type: String, 
    enum: ['active', 'completed', 'paused'], 
    default: 'active' 
  },
  
  // Daily tracking for streaks
  lastSolvedDate: { type: Date },
  dailyProgress: [{
    date: { type: Date },
    problemsSolved: { type: Number, default: 0 },
    timeSpent: { type: Number, default: 0 } // in minutes
  }]
  
}, { 
  timestamps: true,
  collection: 'study_plan_progress'
});

// Indexes for performance
studyPlanProgressSchema.index({ studentId: 1, groupId: 1 }, { unique: true });
studyPlanProgressSchema.index({ groupId: 1, rank: 1 });
studyPlanProgressSchema.index({ studentId: 1 });

// Calculate progress percentage
studyPlanProgressSchema.virtual('progressPercentage').get(function() {
  if (this.totalProblems === 0) return 0;
  return Math.round((this.solvedProblems.length / this.totalProblems) * 100);
});

// Check if study plan is completed
studyPlanProgressSchema.virtual('isCompleted').get(function() {
  return this.status === 'completed' || 
         (this.totalProblems > 0 && this.solvedProblems.length >= this.totalProblems);
});

// Update progress when a problem is solved
studyPlanProgressSchema.methods.addSolvedProblem = function(problemId) {
  if (!this.solvedProblems.includes(problemId)) {
    this.solvedProblems.push(problemId);
    this.lastAccessedAt = new Date();
    
    // Update daily progress
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let todayProgress = this.dailyProgress.find(dp => 
      dp.date.toDateString() === today.toDateString()
    );
    
    if (!todayProgress) {
      todayProgress = { date: today, problemsSolved: 0, timeSpent: 0 };
      this.dailyProgress.push(todayProgress);
    }
    
    todayProgress.problemsSolved += 1;
    
    // Update streak
    const lastSolved = this.lastSolvedDate ? new Date(this.lastSolvedDate) : null;
    if (!lastSolved || lastSolved.toDateString() !== today.toDateString()) {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      if (lastSolved && lastSolved.toDateString() === yesterday.toDateString()) {
        // Continuing streak
        this.currentStreak += 1;
      } else {
        // New streak or broken streak
        this.currentStreak = 1;
      }
      
      this.maxStreak = Math.max(this.maxStreak, this.currentStreak);
      this.lastSolvedDate = today;
    }
    
    // Check if completed
    if (this.solvedProblems.length >= this.totalProblems && this.status !== 'completed') {
      this.status = 'completed';
      this.completedAt = new Date();
      
      // Add completion achievement
      this.achievements.push({
        type: 'completion',
        description: 'Completed the entire study plan!',
        unlockedAt: new Date()
      });
    }
  }
  
  return this.save();
};

// Update rank within study plan
studyPlanProgressSchema.methods.updateRank = async function() {
  const StudyPlanProgress = this.constructor;
  
  // Count students with better progress in the same group
  const betterStudents = await StudyPlanProgress.countDocuments({
    groupId: this.groupId,
    $or: [
      { 'solvedProblems.length': { $gt: this.solvedProblems.length } },
      { 
        'solvedProblems.length': this.solvedProblems.length,
        startedAt: { $lt: this.startedAt }
      }
    ]
  });
  
  this.rank = betterStudents + 1;
  return this.save();
};

// Get connection from CodingProblem model
const CodingProblem = require('./CodingProblem');
const connection = CodingProblem.db;

module.exports = connection.model('StudyPlanProgress', studyPlanProgressSchema);