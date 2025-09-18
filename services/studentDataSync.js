/*
  Auto-sync script to keep student data synchronized between databases.
  This can be run as a cron job or called programmatically.
*/

require('dotenv').config();
const { MongoClient } = require('mongodb');

class StudentDataSync {
  constructor() {
    this.mainClient = null;
    this.codingClient = null;
  }

  async connect() {
    this.mainClient = new MongoClient(process.env.MONGODB_URI);
    this.codingClient = new MongoClient(process.env.MONGOURI2);
    
    await this.mainClient.connect();
    await this.codingClient.connect();
  }

  async disconnect() {
    if (this.mainClient) await this.mainClient.close();
    if (this.codingClient) await this.codingClient.close();
  }

  async syncStudents() {
    try {
      await this.connect();

      const mainDb = this.mainClient.db();
      const codingDb = this.codingClient.db();

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

      if (students.length === 0) {
        return { success: true, message: 'No students found in main database', synced: 0, updated: 0 };
      }

      // Get existing students in coding database
      const existingStudents = await codingDb.collection('students').find({}, {
        projection: { _id: 1 }
      }).toArray();

      const existingIds = new Set(existingStudents.map(s => s._id.toString()));

      // Insert new students
      const newStudents = students.filter(s => !existingIds.has(s._id.toString()));
      let syncedCount = 0;

      if (newStudents.length > 0) {
        const result = await codingDb.collection('students').insertMany(newStudents);
        syncedCount = result.insertedCount;
      }

      // Update existing students
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

      await this.disconnect();

      return {
        success: true,
        message: 'Student data sync completed',
        synced: syncedCount,
        updated: updatedCount,
        total: students.length
      };

    } catch (error) {
      await this.disconnect();
      throw error;
    }
  }
}

// Export for use in other modules
module.exports = StudentDataSync;

// Run directly if called as script
if (require.main === module) {
  (async () => {
    try {
      console.log('🔄 Starting student data sync...');
      const sync = new StudentDataSync();
      const result = await sync.syncStudents();
      
      console.log(`✅ ${result.message}`);
      console.log(`📊 Total students: ${result.total}`);
      console.log(`➕ New students synced: ${result.synced}`);
      console.log(`🔄 Existing students updated: ${result.updated}`);
      
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  })();
}