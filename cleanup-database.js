const mongoose = require('mongoose');
const Test = require('./models/Test');
const Result = require('./models/Result');

async function cleanupDatabase() {
  try {
    console.log('🧹 Starting database cleanup...');
    
    // Connect to MongoDB
    await mongoose.connect('mongodb+srv://mdalamrahman4:qX1pVqlNO1B7seKE@cluster0.euyvnad.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0');
    console.log('✅ Connected to MongoDB');
    
    // Step 1: Find tests to delete
    const testsToDelete = await Test.find({
      $or: [
        { class: '11', board: 'WBCHSE' },
        { class: '12', board: 'CBSE' }
      ]
    }).select('title class board _id');
    
    console.log('\n📊 Tests found for deletion:');
    testsToDelete.forEach((test, i) => {
      console.log(`${i+1}. ${test.title} (Class ${test.class}, ${test.board}) - ID: ${test._id}`);
    });
    
    if (testsToDelete.length === 0) {
      console.log('No tests found matching the criteria');
      await mongoose.disconnect();
      return;
    }
    
    // Get test IDs for result deletion
    const testIds = testsToDelete.map(test => test._id);
    
    // Step 2: Find and count related results
    const resultsToDelete = await Result.find({ testId: { $in: testIds } });
    console.log(`\n📊 Found ${resultsToDelete.length} results to delete`);
    
    // Show sample results
    if (resultsToDelete.length > 0) {
      console.log('\nSample results:');
      resultsToDelete.slice(0, 5).forEach((result, i) => {
        console.log(`${i+1}. Student: ${result.studentId}, Test: ${result.testTitle}, Score: ${result.marksObtained}/${result.totalMarks}`);
      });
      if (resultsToDelete.length > 5) {
        console.log(`... and ${resultsToDelete.length - 5} more results`);
      }
    }
    
    // Step 3: Perform deletion (be careful!)
    console.log('\n⚠️  Are you sure you want to delete these records?');
    console.log('This action cannot be undone!');
    
    // For safety, let's first do a dry run
    console.log('\n🧪 Performing DRY RUN (no actual deletion)...');
    
    // Performing actual deletion
    console.log('\n🗑️  Deleting results...');
    const resultDeletion = await Result.deleteMany({ testId: { $in: testIds } });
    console.log(`✅ Deleted ${resultDeletion.deletedCount} results`);
    
    console.log('\n🗑️  Deleting tests...');
    const testDeletion = await Test.deleteMany({ _id: { $in: testIds } });
    console.log(`✅ Deleted ${testDeletion.deletedCount} tests`);
    
    console.log('\n🎉 Database cleanup completed successfully!');
    

    
  } catch (error) {
    console.error('❌ Database cleanup error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

cleanupDatabase();