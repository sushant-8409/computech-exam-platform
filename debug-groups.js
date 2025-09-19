const mongoose = require('mongoose');
require('dotenv').config();

async function checkGroupsInDatabase() {
  try {
    // Connect to MONGOURI2
    const questionsDb = mongoose.createConnection(process.env.MONGOURI2);
    console.log('✅ Connected to questions database');
    
    // Define schema and model
    const problemGroupSchema = new mongoose.Schema({
      name: String,
      description: String,
      problems: [{ type: mongoose.Schema.Types.ObjectId, ref: 'CodingProblem' }],
      isActive: { type: Boolean, default: true },
      difficulty: String,
      allowedStudentClasses: [String],
      createdBy: String,
      totalProblems: { type: Number, default: 0 },
      studentsEnrolled: { type: Number, default: 0 },
    }, { 
      timestamps: true,
      collection: 'problem_groups'
    });
    
    const ProblemGroup = questionsDb.model('ProblemGroup', problemGroupSchema);
    
    // Check groups
    const groups = await ProblemGroup.find({}).lean();
    console.log('📊 Found groups:', groups.length);
    
    groups.forEach((group, index) => {
      console.log(`${index + 1}. ${group.name} - Active: ${group.isActive} - Problems: ${group.totalProblems}`);
    });
    
    // Also check for problems
    const codingProblemSchema = new mongoose.Schema({
      problemNumber: Number,
      title: String,
      difficulty: String,
      description: String,
    }, { collection: 'coding_problems' });
    
    const CodingProblem = questionsDb.model('CodingProblem', codingProblemSchema);
    const problems = await CodingProblem.find({}).lean();
    console.log('🧩 Found problems:', problems.length);
    
    await questionsDb.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkGroupsInDatabase();