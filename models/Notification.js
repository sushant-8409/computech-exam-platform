const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  adminId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  title: { 
    type: String, 
    required: true,
    maxlength: 200
  },
  message: { 
    type: String, 
    required: true,
    maxlength: 1000
  },
  type: { 
    type: String, 
    enum: [
      'test_created', 
      'test_assignment',
      'test_completed', 
      'student_registered', 
      'result_published', 
      'violation_detected', 
      'system_alert',
      'custom_message'
    ],
    required: true 
  },
  data: { 
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  read: { 
    type: Boolean, 
    default: false 
  },
  emailSent: { 
    type: Boolean, 
    default: false 
  },
  appNotificationSent: { 
    type: Boolean, 
    default: false 
  },
  // ✅ FIXED: Recipients as array of objects (not strings)
  recipients: [{
    email: {
      type: String,
      required: true
    },
    name: {
      type: String,
      default: 'Recipient'
    },
    status: {
      type: String,
      enum: ['pending', 'sent', 'failed'],
      default: 'pending'
    },
    sentAt: {
      type: Date
    },
    error: {
      type: String
    },
    type: {
      type: String,
      enum: ['student', 'admin'],
      default: 'student'
    },
    id: {
      type: mongoose.Schema.Types.ObjectId
    }
  }],
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  }
}, {
  timestamps: true
});

// ✅ Indexes for better performance
notificationSchema.index({ adminId: 1, createdAt: -1 });
notificationSchema.index({ type: 1, createdAt: -1 });
notificationSchema.index({ read: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
