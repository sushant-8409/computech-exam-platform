const mongoose = require('mongoose');

const monitoringImageSchema = new mongoose.Schema({
  studentId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Student', 
    required: true 
  },
  testId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Test', 
    required: true 
  },
  resultId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Result',
    default: null
  },
  fileName: { 
    type: String, 
    required: true 
  },
  driveFileId: { 
    type: String, 
    required: true 
  },
  webViewLink: { 
    type: String, 
    required: true 
  },
  webContentLink: { 
    type: String, 
    default: null 
  },
  directLink: { 
    type: String, 
    default: null 
  },
  timestamp: { 
    type: Date, 
    default: Date.now 
  },
  purpose: { 
    type: String, 
    enum: ['monitoring', 'suspicious', 'violation'], 
    default: 'monitoring' 
  },
  flagged: { 
    type: Boolean, 
    default: false 
  },
  suspicious: { 
    type: Boolean, 
    default: false 
  },
  analysisResults: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  uploadedAt: { 
    type: Date, 
    default: Date.now 
  },
  ipAddress: { 
    type: String,
    default: null
  },
  userAgent: { 
    type: String,
    default: null
  },
  sessionInfo: {
    browser: String,
    os: String,
    device: String,
    resolution: String
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
monitoringImageSchema.index({ studentId: 1, testId: 1 });
monitoringImageSchema.index({ testId: 1, timestamp: -1 });
monitoringImageSchema.index({ driveFileId: 1 });
monitoringImageSchema.index({ flagged: 1, suspicious: 1 });

// Virtual for direct Google Drive image URL (for iframe display)
monitoringImageSchema.virtual('iframeUrl').get(function() {
  if (this.driveFileId) {
    // Create a direct link that can be embedded in iframe
    return `https://drive.google.com/file/d/${this.driveFileId}/preview`;
  }
  return null;
});

// Virtual for thumbnail URL
monitoringImageSchema.virtual('thumbnailUrl').get(function() {
  if (this.driveFileId) {
    return `https://drive.google.com/thumbnail?id=${this.driveFileId}&sz=w400`;
  }
  return null;
});

// Include virtuals when converting to JSON
monitoringImageSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('MonitoringImage', monitoringImageSchema);