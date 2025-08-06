// Simple database check script to see manual test entries
const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/computech-exam-platform', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('✅ Connected to MongoDB');
  checkManualTestEntries();
}).catch(error => {
  console.error('❌ MongoDB connection error:', error);
  process.exit(1);
});

const testSchema = new mongoose.Schema({}, { collection: 'tests', strict: false });
const resultSchema = new mongoose.Schema({}, { collection: 'results', strict: false });

const Test = mongoose.model('Test', testSchema);
const Result = mongoose.model('Result', resultSchema);

async function checkManualTestEntries() {
  try {
    console.log('\n🔍 Checking recent manual test entries...');
    
    // Check recent tests with isManualEntry flag
    const recentTests = await Test.find({ isManualEntry: true })
      .sort({ createdAt: -1 })
      .limit(3)
      .select('_id title questionPaperURL answerKeyURL createdAt');
    
    console.log('\n📋 Recent Manual Tests:');
    recentTests.forEach((test, index) => {
      console.log(`${index + 1}. Test: ${test.title}`);
      console.log(`   ID: ${test._id}`);
      console.log(`   Created: ${test.createdAt}`);
      console.log(`   Question Paper URL: ${test.questionPaperURL || 'NOT SET'}`);
      console.log(`   Answer Key URL: ${test.answerKeyURL || 'NOT SET'}`);
      console.log('   ---');
    });
    
    // Check recent results with isManualEntry flag
    const recentResults = await Result.find({ isManualEntry: true })
      .sort({ createdAt: -1 })
      .limit(3)
      .select('_id testTitle answerSheetURL status marksObtained totalMarks createdAt');
    
    console.log('\n📊 Recent Manual Results:');
    recentResults.forEach((result, index) => {
      console.log(`${index + 1}. Result: ${result.testTitle}`);
      console.log(`   ID: ${result._id}`);
      console.log(`   Created: ${result.createdAt}`);
      console.log(`   Status: ${result.status}`);
      console.log(`   Marks: ${result.marksObtained}/${result.totalMarks}`);
      console.log(`   Answer Sheet URL: ${result.answerSheetURL || 'NOT SET'}`);
      console.log('   ---');
    });
    
    // Check if we have any tests with file URLs at all
    const testsWithFiles = await Test.find({
      $or: [
        { questionPaperURL: { $exists: true, $ne: null, $ne: '' } },
        { answerKeyURL: { $exists: true, $ne: null, $ne: '' } }
      ]
    }).select('_id title questionPaperURL answerKeyURL isManualEntry createdAt').limit(5);
    
    console.log('\n📁 Tests with File URLs (any type):');
    testsWithFiles.forEach((test, index) => {
      console.log(`${index + 1}. Test: ${test.title} (Manual: ${test.isManualEntry || false})`);
      console.log(`   Question Paper: ${test.questionPaperURL || 'NOT SET'}`);
      console.log(`   Answer Key: ${test.answerKeyURL || 'NOT SET'}`);
      console.log('   ---');
    });
    
    const resultsWithFiles = await Result.find({
      answerSheetURL: { $exists: true, $ne: null, $ne: '' }
    }).select('_id testTitle answerSheetURL isManualEntry createdAt').limit(5);
    
    console.log('\n📄 Results with Answer Sheet URLs:');
    resultsWithFiles.forEach((result, index) => {
      console.log(`${index + 1}. Result: ${result.testTitle} (Manual: ${result.isManualEntry || false})`);
      console.log(`   Answer Sheet: ${result.answerSheetURL || 'NOT SET'}`);
      console.log('   ---');
    });
    
    console.log('\n🎯 Summary:');
    console.log(`📋 Total manual tests: ${recentTests.length}`);
    console.log(`📊 Total manual results: ${recentResults.length}`);
    console.log(`📁 Tests with files: ${testsWithFiles.length}`);
    console.log(`📄 Results with files: ${resultsWithFiles.length}`);
    
  } catch (error) {
    console.error('❌ Error checking database:', error);
  } finally {
    mongoose.connection.close();
    console.log('\n✅ Database connection closed');
  }
}
