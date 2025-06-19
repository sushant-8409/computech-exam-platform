const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['test_created', 'test_completed', 'student_registered', 'result_published', 'violation_detected', 'system_alert'],
    required: true 
  },
  data: { type: mongoose.Schema.Types.Mixed }, // Additional data (test details, student info, etc.)
  read: { type: Boolean, default: false },
  emailSent: { type: Boolean, default: false },
  appNotificationSent: { type: Boolean, default: false }
}, {
  timestamps: true
});

module.exports = mongoose.model('Notification', notificationSchema);
