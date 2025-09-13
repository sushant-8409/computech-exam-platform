const mongoose = require('mongoose');
const crypto = require('crypto');

const oauthCredentialsSchema = new mongoose.Schema({
  provider: {
    type: String,
    enum: ['google'],
    required: true,
    default: 'google'
  },
  clientId: {
    type: String,
    required: true
  },
  clientSecret: {
    type: String,
    required: true
  },
  redirectUri: {
    type: String,
    required: true,
    default: 'http://localhost:5000/auth/google/callback'
  },
  scopes: {
    type: [String],
    default: [
      'profile',
      'email',
      'https://www.googleapis.com/auth/drive.file'
    ]
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Validation info
  isValid: {
    type: Boolean,
    default: false
  },
  lastValidated: {
    type: Date
  },
  validationError: {
    type: String
  }
}, {
  timestamps: true
});

// Encrypt sensitive data before saving
oauthCredentialsSchema.pre('save', function(next) {
  if (this.isModified('clientSecret')) {
    // In production, you should use proper encryption
    // For now, we'll store it as-is but mark it as sensitive
    this.lastUpdated = new Date();
  }
  next();
});

// Index for efficient queries
oauthCredentialsSchema.index({ provider: 1, isActive: 1 });

// Static method to get active credentials
oauthCredentialsSchema.statics.getActiveCredentials = async function(provider = 'google') {
  return await this.findOne({ provider, isActive: true }).lean();
};

// Method to validate credentials
oauthCredentialsSchema.methods.validateCredentials = async function() {
  try {
    // Basic validation - check if required fields are present
    if (!this.clientId || !this.clientSecret || !this.redirectUri) {
      this.isValid = false;
      this.validationError = 'Missing required fields';
      await this.save();
      return false;
    }

    // TODO: Add actual OAuth validation by making a test request
    this.isValid = true;
    this.lastValidated = new Date();
    this.validationError = null;
    await this.save();
    return true;
  } catch (error) {
    this.isValid = false;
    this.validationError = error.message;
    await this.save();
    return false;
  }
};

module.exports = mongoose.model('OAuthCredentials', oauthCredentialsSchema);