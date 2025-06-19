const mongoose = require('mongoose');

const notificationSettingsSchema = new mongoose.Schema({
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },

  /* keep snake_case to match `type` values exactly */
  emailNotifications: {
    test_created:        { type: Boolean, default: true },
    test_completed:      { type: Boolean, default: true },
    student_registered:  { type: Boolean, default: true },
    result_published:    { type: Boolean, default: true },
    violation_detected:  { type: Boolean, default: true },
    system_alert:        { type: Boolean, default: true }
  },

  appNotifications: {
    test_created:        { type: Boolean, default: true },
    test_completed:      { type: Boolean, default: true },
    student_registered:  { type: Boolean, default: true },
    result_published:    { type: Boolean, default: true },
    violation_detected:  { type: Boolean, default: true },
    system_alert:        { type: Boolean, default: true }
  },

  emailFrequency: { type: String, enum: ['immediate', 'daily', 'weekly'], default: 'immediate' },

  quiet_hours: {
    enabled: { type: Boolean, default: false },
    start:   { type: String,  default: '22:00' },
    end:     { type: String,  default: '08:00' }
  }
}, { timestamps: true });

module.exports = mongoose.model('NotificationSettings', notificationSettingsSchema);
