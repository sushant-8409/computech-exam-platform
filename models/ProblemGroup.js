const mongoose = require('mongoose');

// Use the same connection helper from CodingProblem
const getCodingConnection = () => {
  const { connection } = require('./CodingProblem');
  return connection;
};

const problemGroupSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true }, // "Class 10", "Class 11", etc.
  description: { type: String },
  problems: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'CodingProblem' 
  }],
  
  // Group settings
  isActive: { type: Boolean, default: true },
  difficulty: { 
    type: String, 
    enum: ['Beginner', 'Intermediate', 'Advanced'], 
    default: 'Beginner' 
  },
  
  // Access control
  allowedStudentClasses: [{ type: String }], // ["10", "11", "12"]
  
  // Admin fields
  createdBy: { type: String, required: true },
  
  // Statistics
  totalProblems: { type: Number, default: 0 },
  studentsEnrolled: { type: Number, default: 0 },
  
}, { 
  timestamps: true,
  collection: 'problem_groups'
});

// Indexes (name index auto-created by unique: true)
problemGroupSchema.index({ allowedStudentClasses: 1 });

// Update total problems count
problemGroupSchema.methods.updateProblemCount = function() {
  this.totalProblems = this.problems.length;
  return this.save();
};

// Add problem to group
problemGroupSchema.methods.addProblem = function(problemId) {
  if (!this.problems.includes(problemId)) {
    this.problems.push(problemId);
    this.totalProblems = this.problems.length;
  }
  return this.save();
};

// Remove problem from group
problemGroupSchema.methods.removeProblem = function(problemId) {
  this.problems = this.problems.filter(id => !id.equals(problemId));
  this.totalProblems = this.problems.length;
  return this.save();
};

// Get connection from CodingProblem model
const CodingProblem = require('./CodingProblem');
const connection = CodingProblem.db;

module.exports = connection.model('ProblemGroup', problemGroupSchema);