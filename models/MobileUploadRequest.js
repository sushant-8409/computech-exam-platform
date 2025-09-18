const mongoose = require('mongoose');

const mobileUploadRequestSchema = new mongoose.Schema({
  // Link to the user who requested the mobile upload
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // User's email for sending the upload link
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  
  // Unique token for the upload link
  token: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Test information (if applicable)
  testId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Test',
    default: null
  },
  
  // Type of upload request
  uploadType: {
    type: String,
    enum: ['test-paper', 'document', 'assignment'],
    default: 'test-paper'
  },
  
  // Additional context for the upload
  uploadContext: {
    testName: String,
    subject: String,
    instructions: String,
    maxFiles: {
      type: Number,
      default: 1
    },
    allowedTypes: [{
      type: String,
      enum: ['pdf', 'jpg', 'jpeg', 'png'],
      default: ['pdf', 'jpg', 'jpeg', 'png']
    }]
  },
  
  // Upload status tracking
  status: {
    type: String,
    enum: ['pending', 'accessed', 'uploaded', 'expired', 'cancelled'],
    default: 'pending'
  },
  
  // Upload results
  uploadedFiles: [{
    filename: String,
    originalName: String,
    mimetype: String,
    size: Number,
    driveFileId: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Device and access information
  accessInfo: {
    firstAccessed: Date,
    lastAccessed: Date,
    userAgent: String,
    ipAddress: String,
    deviceType: String // 'mobile', 'tablet', 'desktop'
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  expiresAt: {
    type: Date,
    required: true,
    index: { expireAfterSeconds: 0 } // MongoDB TTL index for automatic cleanup
  },
  
  // Email tracking
  emailSent: {
    type: Boolean,
    default: false
  },
  
  emailSentAt: Date,
  
  // Analytics
  analytics: {
    linkClicks: {
      type: Number,
      default: 0
    },
    uploadAttempts: {
      type: Number,
      default: 0
    },
    successfulUploads: {
      type: Number,
      default: 0
    },
    lastActivity: Date
  }
}, {
  timestamps: true
});

// Indexes for efficient queries (expiresAt index auto-created by TTL)
mobileUploadRequestSchema.index({ userId: 1, createdAt: -1 });
mobileUploadRequestSchema.index({ email: 1, createdAt: -1 });
mobileUploadRequestSchema.index({ status: 1, createdAt: -1 });

// Instance methods
mobileUploadRequestSchema.methods.isExpired = function() {
  return new Date() > this.expiresAt;
};

mobileUploadRequestSchema.methods.markAccessed = function(userAgent, ipAddress) {
  const now = new Date();
  
  if (!this.accessInfo.firstAccessed) {
    this.accessInfo.firstAccessed = now;
  }
  
  this.accessInfo.lastAccessed = now;
  this.accessInfo.userAgent = userAgent;
  this.accessInfo.ipAddress = ipAddress;
  
  // Detect device type
  if (userAgent) {
    if (/Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)) {
      this.accessInfo.deviceType = /iPad|Tablet/i.test(userAgent) ? 'tablet' : 'mobile';
    } else {
      this.accessInfo.deviceType = 'desktop';
    }
  }
  
  this.analytics.linkClicks += 1;
  this.analytics.lastActivity = now;
  
  if (this.status === 'pending') {
    this.status = 'accessed';
  }
  
  return this.save();
};

mobileUploadRequestSchema.methods.recordUploadAttempt = function() {
  this.analytics.uploadAttempts += 1;
  this.analytics.lastActivity = new Date();
  return this.save();
};

mobileUploadRequestSchema.methods.recordSuccessfulUpload = function(fileInfo) {
  this.uploadedFiles.push({
    filename: fileInfo.filename,
    originalName: fileInfo.originalname,
    mimetype: fileInfo.mimetype,
    size: fileInfo.size,
    driveFileId: fileInfo.driveFileId,
    uploadedAt: new Date()
  });
  
  this.analytics.successfulUploads += 1;
  this.analytics.lastActivity = new Date();
  this.status = 'uploaded';
  
  return this.save();
};

// Static methods
mobileUploadRequestSchema.statics.generateToken = function() {
  const crypto = require('crypto');
  return crypto.randomBytes(32).toString('hex');
};

mobileUploadRequestSchema.statics.findByToken = function(token) {
  return this.findOne({ 
    token: token,
    expiresAt: { $gt: new Date() },
    status: { $nin: ['expired', 'cancelled'] }
  }).populate('userId', 'name email')
    .populate('testId', 'title subject duration');
};

mobileUploadRequestSchema.statics.createUploadRequest = function(options) {
  const {
    userId,
    email,
    testId = null,
    uploadType = 'test-paper',
    uploadContext = {},
    validityMinutes = 10
  } = options;
  
  const token = this.generateToken();
  const expiresAt = new Date(Date.now() + validityMinutes * 60 * 1000);
  
  return this.create({
    userId,
    email,
    token,
    testId,
    uploadType,
    uploadContext: {
      maxFiles: 1,
      allowedTypes: ['pdf', 'jpg', 'jpeg', 'png'],
      ...uploadContext
    },
    expiresAt
  });
};

// Pre-save middleware
mobileUploadRequestSchema.pre('save', function(next) {
  if (this.isModified('status') && this.status === 'expired') {
    this.analytics.lastActivity = new Date();
  }
  next();
});

// Virtual for time remaining
mobileUploadRequestSchema.virtual('timeRemaining').get(function() {
  const now = Date.now();
  const remaining = this.expiresAt.getTime() - now;
  
  if (remaining <= 0) {
    return { expired: true, minutes: 0, seconds: 0 };
  }
  
  const minutes = Math.floor(remaining / (1000 * 60));
  const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
  
  return { expired: false, minutes, seconds };
});

// Virtual for upload URL
mobileUploadRequestSchema.virtual('uploadUrl').get(function() {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  return `${baseUrl}/mobile-upload/${this.token}`;
});

module.exports = mongoose.model('MobileUploadRequest', mobileUploadRequestSchema);