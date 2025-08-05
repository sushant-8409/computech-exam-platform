
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'teacher'], default: 'admin' },
  isActive: { type: Boolean, default: true },
  
  // Google OAuth tokens for Drive access
  googleTokens: {
    access_token: { type: String },
    refresh_token: { type: String },
    scope: { type: String },
    token_type: { type: String },
    expiry_date: { type: Number }
  },
  googleConnected: { type: Boolean, default: false }
}, {
  timestamps: true,
  strict: false
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
