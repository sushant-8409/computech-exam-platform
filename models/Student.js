
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
  collection: 'students',
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
