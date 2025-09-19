const mongoose = require('mongoose');

const promotionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  videoUrl: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        if (!v) return true; // Allow empty video URL
        // Accept Google Drive, YouTube, and other common video URLs
        const urlPattern = /^https?:\/\/(www\.)?(drive\.google\.com|youtube\.com|youtu\.be|vimeo\.com)/i;
        return urlPattern.test(v);
      },
      message: 'Invalid video URL. Please use Google Drive, YouTube, or Vimeo links.'
    }
  },
  buttonText: {
    type: String,
    trim: true
  },
  buttonUrl: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        if (!v) return true; // Allow empty button URL
        const urlPattern = /^https?:\/\/.+/i;
        return urlPattern.test(v);
      },
      message: 'Invalid button URL. Please provide a valid HTTP/HTTPS URL.'
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  displayOrder: {
    type: Number,
    default: 0
  },
  showOnLanding: {
    type: Boolean,
    default: true
  },
  // Popup settings
  isPopup: {
    type: Boolean,
    default: false
  },
  popupPages: [{
    type: String,
    enum: ['landing', 'login', 'signup', 'dashboard', 'all']
  }],
  popupFrequency: {
    type: String,
    enum: ['once', 'daily', 'weekly', 'always'],
    default: 'once'
  },
  popupStartDate: {
    type: Date
  },
  popupEndDate: {
    type: Date
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
promotionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Index for efficient queries
promotionSchema.index({ isActive: 1, showOnLanding: 1, displayOrder: 1 });
promotionSchema.index({ isPopup: 1, popupPages: 1, isActive: 1 });

module.exports = mongoose.model('Promotion', promotionSchema);