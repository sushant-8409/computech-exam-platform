// Simple database check script to see ALL test entries
const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB using the same URI as server
mongoose.connect(process.env.MONGODB_URI)
.then(() => {
  console.log('✅ Connected to MongoDB');
  checkAllEntries();
}).catch(error => {
  console.error('❌ MongoDB connection error:', error);
  process.exit(1);
});

const testSchema = new mongoose.Schema({}, { collection: 'tests', strict: false });
const resultSchema = new mongoose.Schema({}, { collection: 'results', strict: false });

const Test = mongoose.model('Test', testSchema);
const Result = mongoose.model('Result', resultSchema);

async function checkAllEntries() {
  try {
    console.log('\n🔍 Checking ALL test and result entries...');
    
    // Check total counts
    const totalTests = await Test.countDocuments();
    const totalResults = await Result.countDocuments();
    
    console.log(`📋 Total Tests in DB: ${totalTests}`);
    console.log(`📊 Total Results in DB: ${totalResults}`);
    
    // Get recent tests (any type)
    const recentTests = await Test.find({})
      .sort({ createdAt: -1 })
      .limit(5)
      .select('_id title questionPaperURL answerKeyURL isManualEntry createdBy createdAt');
    
    console.log('\n📋 Recent Tests (any type):');
    recentTests.forEach((test, index) => {
      console.log(`${index + 1}. ${test.title || 'No Title'}`);
      console.log(`   ID: ${test._id}`);
      console.log(`   Manual Entry: ${test.isManualEntry || false}`);
      console.log(`   Created By: ${test.createdBy || 'Unknown'}`);
      console.log(`   Created: ${test.createdAt}`);
      console.log(`   Question Paper URL: ${test.questionPaperURL || 'NOT SET'}`);
      console.log(`   Answer Key URL: ${test.answerKeyURL || 'NOT SET'}`);
      console.log('   ---');
    });
    
    // Get recent results (any type)
    const recentResults = await Result.find({})
      .sort({ createdAt: -1 })
      .limit(5)
      .select('_id testTitle answerSheetURL status marksObtained totalMarks isManualEntry enteredBy createdAt');
    
    console.log('\n📊 Recent Results (any type):');
    recentResults.forEach((result, index) => {
      console.log(`${index + 1}. ${result.testTitle || 'No Title'}`);
      console.log(`   ID: ${result._id}`);
      console.log(`   Manual Entry: ${result.isManualEntry || false}`);
      console.log(`   Entered By: ${result.enteredBy || 'Unknown'}`);
      console.log(`   Created: ${result.createdAt}`);
      console.log(`   Status: ${result.status}`);
      console.log(`   Marks: ${result.marksObtained}/${result.totalMarks}`);
      console.log(`   Answer Sheet URL: ${result.answerSheetURL || 'NOT SET'}`);
      console.log('   ---');
    });
    
    // Check manual entries specifically
    const manualTests = await Test.find({ isManualEntry: true }).countDocuments();
    const manualResults = await Result.find({ isManualEntry: true }).countDocuments();
    
    console.log(`\n🎯 Manual Entries Summary:`);
    console.log(`📋 Manual Tests: ${manualTests}`);
    console.log(`📊 Manual Results: ${manualResults}`);
    
  } catch (error) {
    console.error('❌ Error checking database:', error);
  } finally {
    mongoose.connection.close();
    console.log('\n✅ Database connection closed');
  }
}
