const mongoose = require('mongoose');
require('dotenv').config();

async function fixCompatibility() {
  try {
    console.log('🔧 FIXING COMPATIBILITY ISSUES...\n');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/computech-exam-platform');
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    
    // STEP 1: Find existing collections
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    console.log('📋 Existing collections:', collectionNames);
    
    // STEP 2: Check what data actually exists
    let studentCollection = null;
    let testCollection = null;
    let resultCollection = null;
    
    // Find student collection
    for (const name of ['students', 'student', 'Student', 'studentschemas']) {
      if (collectionNames.includes(name)) {
        const count = await db.collection(name).countDocuments();
        if (count > 0) {
          studentCollection = name;
          console.log(`✅ Found student data in: ${name} (${count} documents)`);
          break;
        }
      }
    }
    
    // Find test collection
    for (const name of ['tests', 'test', 'Test', 'testschemas']) {
      if (collectionNames.includes(name)) {
        const count = await db.collection(name).countDocuments();
        if (count > 0) {
          testCollection = name;
          console.log(`✅ Found test data in: ${name} (${count} documents)`);
          break;
        }
      }
    }
    
    // Find result collection
    for (const name of ['results', 'result', 'Result', 'resultschemas']) {
      if (collectionNames.includes(name)) {
        const count = await db.collection(name).countDocuments();
        if (count > 0) {
          resultCollection = name;
          console.log(`✅ Found result data in: ${name} (${count} documents)`);
          break;
        }
      }
    }
    
    // STEP 3: Check existing data structure
    if (studentCollection) {
      const sampleStudent = await db.collection(studentCollection).findOne();
      console.log('\n📝 Sample student structure:', Object.keys(sampleStudent));
      
      // Check for your specific email
      const yourStudent = await db.collection(studentCollection).findOne({
        email: 'mdalamrahman6@gmail.com'
      });
      
      if (yourStudent) {
        console.log('✅ Found your student account:', {
          name: yourStudent.name,
          email: yourStudent.email,
          approved: yourStudent.approved,
          hasPasswordHash: !!yourStudent.passwordHash,
          hasPassword: !!yourStudent.password
        });
      }
    }
    
    if (testCollection) {
      const testCount = await db.collection(testCollection).countDocuments();
      console.log(`\n📊 Test collection ${testCollection}: ${testCount} documents`);
      
      if (testCount > 0) {
        const sampleTest = await db.collection(testCollection).findOne();
        console.log('📝 Sample test structure:', Object.keys(sampleTest));
      }
    }
    
    // STEP 4: Generate compatible models
    console.log('\n🔧 GENERATING COMPATIBLE MODELS...');
    
    const fs = require('fs');
    const path = require('path');
    
    // Ensure models directory exists
    if (!fs.existsSync('./models')) {
      fs.mkdirSync('./models');
    }
    
    // Generate Student model compatible with existing data
    const studentModelCode = `
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const studentSchema = new mongoose.Schema({
  // Your existing fields
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  class: { type: String, required: true },
  board: { type: String, required: true },
  school: { type: String, required: true },
  rollNo: { type: String, unique: true, sparse: true },
  countryCode: { type: String, default: '+91' },
  mobile: { type: String },
  passwordHash: { type: String, required: true },
  approved: { type: Boolean, default: false },
  baseFee: { type: Number, default: 600 },
  referralCode: { type: String },
  referredBy: { type: String },
  signupCouponUsed: { type: String },
  signupDiscount: { type: Number, default: 0 },
  emailVerified: { type: Boolean, default: false },
  emailVerifyToken: { type: String },
  emailVerifyTokenExpires: { type: Date },
  resetOtp: { type: String },
  resetOtpExpires: { type: Date },
  resetOtpVerified: { type: Boolean, default: false },
  joiningDate: { type: Date, default: Date.now },
  
  // Additional fields for compatibility
  password: { type: String }, // Some records might have this
  profilePicture: { type: String },
  dateOfBirth: { type: Date },
  gender: { type: String },
  address: { type: String },
  parentPhoneNumber: { type: String },
  lastLogin: { type: Date },
  loginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date }
}, {
  collection: '${studentCollection || 'students'}',
  timestamps: true,
  strict: false // Allow additional fields from existing data
});

// Password comparison method
studentSchema.methods.comparePassword = async function(candidatePassword) {
  const passwordField = this.passwordHash || this.password;
  if (!passwordField) return false;
  
  try {
    return await bcrypt.compare(candidatePassword, passwordField);
  } catch (error) {
    // Fallback for plain text passwords
    return candidatePassword === passwordField;
  }
};

// Other methods for compatibility
studentSchema.methods.isLocked = function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

module.exports = mongoose.model('Student', studentSchema);
`;
    
    fs.writeFileSync('./models/Student.js', studentModelCode);
    console.log('✅ Generated compatible Student model');
    
    // Generate Test model
    const testModelCode = `
const mongoose = require('mongoose');

const testSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  subject: { type: String, required: true },
  class: { type: String, required: true },
  board: { type: String, required: true },
  duration: { type: Number, required: true },
  totalMarks: { type: Number, required: true },
  passingMarks: { type: Number, required: true },
  questionsCount: { type: Number, required: true },
  questionPaperURL: { type: String },
  answerSheetURL: { type: String },
  answerKeyURL: { type: String },
  answerKeyVisible: { type: Boolean, default: false },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  active: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  // Additional fields
  proctoringSettings: {
    strictMode: { type: Boolean, default: true },
    allowTabSwitch: { type: Number, default: 0 },
    requireFullscreen: { type: Boolean, default: true },
    blockRightClick: { type: Boolean, default: true },
    blockKeyboardShortcuts: { type: Boolean, default: true }
  },
  resumeEnabled: { type: Boolean, default: true },
  resumeData: [{ type: mongoose.Schema.Types.Mixed }]
}, {
  collection: '${testCollection || 'tests'}',
  timestamps: true,
  strict: false
});

module.exports = mongoose.model('Test', testSchema);
`;
    
    fs.writeFileSync('./models/Test.js', testModelCode);
    console.log('✅ Generated compatible Test model');
    
    // Generate Result model
    const resultModelCode = `
const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  testId: { type: mongoose.Schema.Types.ObjectId, ref: 'Test', required: true },
  testTitle: { type: String, required: true },
  subject: { type: String, required: true },
  totalMarks: { type: Number, required: true },
  questionsCount: { type: Number, required: true },
  
  // Question-wise marking (new feature)
  questionWiseMarks: [{
    questionNo: { type: Number, required: true },
    maxMarks: { type: Number, required: true },
    obtainedMarks: { type: Number, default: 0 },
    remarks: { type: String, default: '' },
    markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    markedAt: { type: Date }
  }],
  
  marksObtained: { type: Number },
  percentage: { type: Number },
  duration: { type: Number, required: true },
  timeTaken: { type: Number, required: true },
  answers: [{ type: mongoose.Schema.Types.Mixed }],
  answerSheetUrl: { type: String },
  startedAt: { type: Date, required: true },
  submittedAt: { type: Date, required: true },
  autoSubmitted: { type: Boolean, default: false },
  autoSubmitReason: { type: String, default: 'manual' },
  violations: [{ type: mongoose.Schema.Types.Mixed }],
  marksApproved: { type: Boolean, default: false },
  adminComments: { type: String, default: '' }
}, {
  collection: '${resultCollection || 'results'}',
  timestamps: true,
  strict: false
});

module.exports = mongoose.model('Result', resultSchema);
`;
    
    fs.writeFileSync('./models/Result.js', resultModelCode);
    console.log('✅ Generated compatible Result model');
    
    // Generate User model for admin
    const userModelCode = `
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'teacher'], default: 'admin' },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true,
  strict: false
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
`;
    
    fs.writeFileSync('./models/User.js', userModelCode);
    console.log('✅ Generated User model');
    
    console.log('\n🔧 SUMMARY:');
    console.log('='.repeat(50));
    console.log(`✅ Student collection: ${studentCollection} (${studentCollection ? await db.collection(studentCollection).countDocuments() : 0} documents)`);
    console.log(`✅ Test collection: ${testCollection} (${testCollection ? await db.collection(testCollection).countDocuments() : 0} documents)`);
    console.log(`✅ Result collection: ${resultCollection} (${resultCollection ? await db.collection(resultCollection).countDocuments() : 0} documents)`);
    console.log('✅ Compatible models generated');
    
  } catch (error) {
    console.error('❌ Fix failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n📱 Connection closed');
  }
}

fixCompatibility();
