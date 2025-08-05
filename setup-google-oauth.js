const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function setupDefaultAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find or create default admin user
    let adminUser = await User.findOne({ role: 'admin' });
    
    if (!adminUser) {
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      adminUser = await User.create({
        name: 'System Admin',
        email: 'admin@computech.com',
        password: hashedPassword,
        role: 'admin',
        isActive: true
      });
      console.log('✅ Created default admin user');
    }

    console.log('\n🔧 Google OAuth Setup Instructions:');
    console.log('1. Start your server: npm start');
    console.log('2. Open browser: http://localhost:5000/auth/google');
    console.log('3. Complete Google OAuth flow');
    console.log('4. This will connect Google Drive for all file uploads');
    console.log('\nAdmin credentials:');
    console.log('Email: admin@computech.com');
    console.log('Password: admin123');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

setupDefaultAdmin();
