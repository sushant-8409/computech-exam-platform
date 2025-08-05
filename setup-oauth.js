const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function setupAdminOAuth() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('🔗 Connected to MongoDB');

    // Find or create an admin user
    let admin = await User.findOne({ role: 'admin' });
    
    if (!admin) {
      console.log('⚠️ No admin user found. Creating one...');
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      admin = new User({
        name: 'System Admin',
        email: 'admin@computech.com',
        password: hashedPassword,
        role: 'admin',
        isActive: true
      });
      
      await admin.save();
      console.log('✅ Created admin user: admin@computech.com (password: admin123)');
    } else {
      console.log('✅ Found existing admin user:', admin.email);
    }

    console.log('\n📋 Setup Instructions:');
    console.log('1. Start your server: npm start');
    console.log('2. Login as admin with credentials above');
    console.log('3. Visit: http://localhost:5000/admin/connect-gdrive');
    console.log('4. Complete Google OAuth flow');
    console.log('5. Your admin account will be connected to Google Drive');
    console.log('\nAfter setup, all file uploads will use your Google Drive storage.');

  } catch (error) {
    console.error('❌ Setup failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📄 Disconnected from MongoDB');
  }
}

if (require.main === module) {
  setupAdminOAuth();
}

module.exports = setupAdminOAuth;
