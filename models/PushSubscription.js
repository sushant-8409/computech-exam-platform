const mongoose = require('mongoose');

const pushSubscriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'userType'
  },
  userType: {
    type: String,
    required: true,
    enum: ['Student', 'User'], // Student or Admin(User)
    default: 'Student'
  },
  subscription: {
    endpoint: {
      type: String,
      required: true
    },
    keys: {
      p256dh: {
        type: String,
        required: true
      },
      auth: {
        type: String,
        required: true
      }
    }
  },
  userAgent: {
    type: String,
    default: ''
  },
  active: {
    type: Boolean,
    default: true
  },
  lastUsed: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// ✅ Indexes for performance
pushSubscriptionSchema.index({ userId: 1, active: 1 });
pushSubscriptionSchema.index({ 'subscription.endpoint': 1 }, { unique: true });

// ✅ Update lastUsed on save
pushSubscriptionSchema.pre('save', function(next) {
  this.lastUsed = new Date();
  next();
});

module.exports = mongoose.model('PushSubscription', pushSubscriptionSchema);
