const mongoose = require('mongoose');
require('dotenv').config();

async function debugStudentData() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/computech-exam-platform');
    console.log('✅ Connected to MongoDB');
    console.log('📊 Database name:', mongoose.connection.name);
    
    const db = mongoose.connection.db;
    
    // Get all collections
    const collections = await db.listCollections().toArray();
    console.log('\n📋 All collections in database:');
    collections.forEach(col => {
      console.log(`- ${col.name}`);
    });
    
    // Search for student data in all collections
    console.log('\n🔍 Searching for student email: mdalamrahman6@gmail.com');
    
    for (const collection of collections) {
      try {
        const count = await db.collection(collection.name).countDocuments();
        console.log(`\n📊 Collection "${collection.name}": ${count} documents`);
        
        if (count > 0) {
          // Search for the specific email in this collection
          const studentData = await db.collection(collection.name).findOne({
            email: 'mdalamrahman6@gmail.com'
          });
          
          if (studentData) {
            console.log(`✅ FOUND STUDENT in collection "${collection.name}":`, {
              _id: studentData._id,
              name: studentData.name,
              email: studentData.email,
              class: studentData.class,
              board: studentData.board,
              approved: studentData.approved,
              hasPasswordHash: !!studentData.passwordHash,
              hasPassword: !!studentData.password,
              rollNo: studentData.rollNo
            });
          }
          
          // Show sample document structure
          const sample = await db.collection(collection.name).findOne();
          console.log(`📝 Sample document structure in "${collection.name}":`, Object.keys(sample));
        }
      } catch (error) {
        console.log(`❌ Error checking collection ${collection.name}:`, error.message);
      }
    }
    
    // Also search for any student with similar email patterns
    console.log('\n🔍 Searching for any students with "mdalamrahman" in email...');
    for (const collection of collections) {
      try {
        const similarStudents = await db.collection(collection.name).find({
          email: { $regex: /mdalamrahman/i }
        }).toArray();
        
        if (similarStudents.length > 0) {
          console.log(`📧 Found ${similarStudents.length} similar emails in "${collection.name}":`);
          similarStudents.forEach(student => {
            console.log(`- ${student.email} (${student.name || 'No name'})`);
          });
        }
      } catch (error) {
        // Collection might not have email field
      }
    }
    
    // Test the Student model specifically
    console.log('\n🧪 Testing Student model...');
    try {
      const Student = require('./models/Student');
      const studentCount = await Student.countDocuments();
      console.log(`📊 Student model returns: ${studentCount} documents`);
      
      if (studentCount > 0) {
        const firstStudent = await Student.findOne();
        console.log('📝 First student from model:', {
          _id: firstStudent._id,
          name: firstStudent.name,
          email: firstStudent.email,
          approved: firstStudent.approved
        });
      }
    } catch (error) {
      console.log('❌ Error with Student model:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Debug error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n📱 Connection closed');
  }
}

debugStudentData();
