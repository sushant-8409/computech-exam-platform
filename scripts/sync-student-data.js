/*
  Script to sync essential student data from MONGODB_URI to MONGOURI2
  This ensures coding practice rankings and stats work correctly.
*/

require('dotenv').config();
const { MongoClient } = require('mongodb');

const syncStudentData = async () => {
  try {
    console.log('🔄 Starting student data sync...');

    // Connect to both databases
    const mainClient = new MongoClient(process.env.MONGODB_URI);
    const codingClient = new MongoClient(process.env.MONGOURI2);

    await mainClient.connect();
    await codingClient.connect();

    const mainDb = mainClient.db();
    const codingDb = codingClient.db();

    // Get all students from main database
    const students = await mainDb.collection('students').find({}, {
      projection: {
        _id: 1,
        name: 1,
        email: 1,
        class: 1,
        approved: 1,
        joiningDate: 1
      }
    }).toArray();

    console.log(`📊 Found ${students.length} students in main database`);

    if (students.length === 0) {
      console.log('⚠️ No students found in main database');
      return;
    }

    // Check existing students in coding database
    const existingStudents = await codingDb.collection('students').find({}, {
      projection: { _id: 1 }
    }).toArray();

    const existingIds = new Set(existingStudents.map(s => s._id.toString()));

    // Filter out students that already exist
    const newStudents = students.filter(s => !existingIds.has(s._id.toString()));

    if (newStudents.length === 0) {
      console.log('✅ All students already synced');
    } else {
      // Insert new students into coding database
      const result = await codingDb.collection('students').insertMany(newStudents);
      console.log(`✅ Synced ${result.insertedCount} new students to coding database`);
    }

    // Update existing students (in case of name/email changes)
    let updatedCount = 0;
    for (const student of students) {
      if (existingIds.has(student._id.toString())) {
        await codingDb.collection('students').updateOne(
          { _id: student._id },
          { $set: { name: student.name, email: student.email, class: student.class } }
        );
        updatedCount++;
      }
    }

    if (updatedCount > 0) {
      console.log(`🔄 Updated ${updatedCount} existing student records`);
    }

    await mainClient.close();
    await codingClient.close();

    console.log('🎉 Student data sync completed successfully!');

  } catch (error) {
    console.error('❌ Error syncing student data:', error);
  }
};

// Run the sync
syncStudentData();