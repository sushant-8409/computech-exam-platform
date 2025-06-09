const mongoose = require('mongoose');
require('dotenv').config();

async function debugDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/computech-exam-platform');
    console.log('✅ Connected to MongoDB');
    console.log('📊 Database name:', mongoose.connection.name);
    
    // Get the actual collections in the database
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('\n📋 Collections in database:');
    collections.forEach(col => {
      console.log(`- ${col.name}`);
    });
    
    // Check each collection's document count
    console.log('\n📊 Document counts:');
    for (const col of collections) {
      const count = await mongoose.connection.db.collection(col.name).countDocuments();
      console.log(`- ${col.name}: ${count} documents`);
      
      // Show first document from each collection
      if (count > 0) {
        const sample = await mongoose.connection.db.collection(col.name).findOne();
        console.log(`  Sample document:`, Object.keys(sample));
      }
    }
    
    // Test specific collections that should exist
    console.log('\n🔍 Testing expected collections:');
    const expectedCollections = ['students', 'tests', 'results', 'users'];
    
    for (const collectionName of expectedCollections) {
      try {
        const count = await mongoose.connection.db.collection(collectionName).countDocuments();
        console.log(`- ${collectionName}: ${count} documents`);
        
        if (count > 0) {
          const sample = await mongoose.connection.db.collection(collectionName).findOne();
          console.log(`  Sample:`, sample);
        }
      } catch (error) {
        console.log(`- ${collectionName}: Collection doesn't exist`);
      }
    }
    
  } catch (error) {
    console.error('❌ Debug error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('📱 Connection closed');
  }
}

debugDatabase();
