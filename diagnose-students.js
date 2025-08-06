// Diagnostic script to test student search
require('dotenv').config();
const mongoose = require('mongoose');
const Student = require('./models/Student');

async function testStudentSearch() {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Count total students
    const totalStudents = await Student.countDocuments();
    console.log(`📊 Total students in database: ${totalStudents}`);

    // Get first few students
    const sampleStudents = await Student.find({}, {
      name: 1,
      email: 1,
      rollNo: 1,
      class: 1,
      board: 1,
      school: 1,
      status: 1,
      approved: 1
    }).limit(5);

    console.log('👥 Sample students:');
    sampleStudents.forEach((student, index) => {
      console.log(`  ${index + 1}. ${student.name} (${student.email}) - Status: ${student.status || 'undefined'}, Approved: ${student.approved}`);
    });

    // Test search functionality
    console.log('\n🔍 Testing search with query "test"...');
    const searchRegex = new RegExp('test', 'i');
    
    const searchResults = await Student.find({
      $or: [
        { name: searchRegex },
        { email: searchRegex },
        { rollNo: searchRegex }
      ]
    }, {
      name: 1,
      email: 1,
      rollNo: 1,
      class: 1,
      board: 1,
      school: 1
    }).limit(10);

    console.log(`📋 Search results for "test": ${searchResults.length} found`);
    searchResults.forEach((student, index) => {
      console.log(`  ${index + 1}. ${student.name} (${student.email})`);
    });

    // Test active status filter
    console.log('\n🎯 Testing active students...');
    const activeStudents = await Student.find({ status: 'active' });
    console.log(`✅ Active students: ${activeStudents.length}`);

    const approvedStudents = await Student.find({ approved: true });
    console.log(`✅ Approved students: ${approvedStudents.length}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    mongoose.connection.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

testStudentSearch();
