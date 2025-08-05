const mongoose = require('mongoose');
const webpush = require('web-push');

const Notification = require('../models/Notification');
const NotificationSettings = require('../models/NotificationSettings');
const PushSubscription = require('../models/PushSubscription'); // ✅ New model
const EmailService = require('./emailService');
const User = require('../models/User');
const Student = require('../models/Student');

/* ✅ FIXED: Web-push VAPID with proper config */
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    `mailto:${process.env.EMAIL_USER || 'admin@example.com'}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  console.log('✅ VAPID keys configured for web push');
} else {
  console.warn('⚠️ VAPID keys not configured - push notifications will not work');
}
/* ✅ BETTER FIX: More precise notification type handling */


async function getAdmin(adminId) {
  try {
    // Handle the special "admin" string case
    if (adminId === 'admin') {
      return {
        _id: 'admin',
        name: process.env.ADMIN_NAME || 'Administrator',
        email: process.env.ADMIN_EMAIL || 'admin@example.com'
      };
    }

    const admin = await User.findById(adminId);
    if (admin) {
      console.log(`👤 Found admin: ${admin.name} (${admin.email})`);
      return admin;
    }

    console.warn('⚠️ No admin found in database, using fallback');
    return {
      _id: adminId,
      name: process.env.ADMIN_NAME || 'Administrator',
      email: process.env.ADMIN_EMAIL || 'admin@example.com'
    };
  } catch (error) {
    console.error('❌ Error fetching admin:', error);
    return {
      _id: adminId,
      name: 'Administrator',
      email: 'admin@example.com'
    };
  }
}

class NotificationService {
  constructor() {
    [
      'sendNotification', 'sendEmailNotification', 'sendPushNotification',
      'getPushSubscriptions', 'sendBulkTestNotification',
      'sendBulkResultNotification', 'subscribeToPush', 'unsubscribeFromPush'
    ].forEach(fn => { this[fn] = this[fn].bind(this); });
  }
  getCorrectNotificationType(type, data) {
  // ✅ Map frontend template types to actual notification types
  const typeMapping = {
    'test_created': 'test_created',
    'test_assignment': 'test_created', // Both map to same type
    'test_completed': 'test_completed',
    'result_published': 'result_published',
    'student_registered': 'student_registered',
    'violation_detected': 'violation_detected',
    'system_alert': 'system_alert',
    'custom_message': 'custom_message',
    'custom': 'custom_message' // Handle 'custom' from frontend
  };

  // If we have a direct mapping, use it
  if (typeMapping[type]) {
    console.log(`📧 Mapped type: ${type} -> ${typeMapping[type]}`);
    return typeMapping[type];
  }

  // ✅ Auto-detection only for truly unknown types
  console.log(`📧 Auto-detecting unknown type: ${type}`);

  // Check data context for auto-detection
  if (data.resultData && (data.resultData.status === 'published' || data.resultData.status === 'reviewed')) {
    return 'result_published';
  }

  if (data.students && data.tests && data.testData) {
    return 'test_created';
  }

  // Fallback to original or default
  return type || 'system_alert';
}
  /* ✅ FIXED: Main notification method with proper recipient tracking */
  async sendNotification(adminId, type, title, message, data = {}) {
    try {
      console.log(`📧 Sending notification: ${type} - ${title}`);

      // ✅ FIXED: Handle both admin string and ObjectId
      if (adminId !== 'admin' && !mongoose.Types.ObjectId.isValid(adminId)) {
        throw new Error(`Invalid adminId: ${adminId}`);
      }

      // ✅ FIXED: Correct notification type mapping
      const actualType = this.getCorrectNotificationType(type, data);
      console.log(`📧 Corrected notification type: ${type} -> ${actualType}`);

      const settings = await this.ensureSettings(adminId);
      const admin = await getAdmin(adminId);

      // ✅ Create notification with proper recipient tracking
      const recipients = this.extractRecipients(data);
      
      let notification = null;
      
      // ✅ FIXED: Skip database save for test notifications with string adminId
      if (adminId !== 'admin') {
        notification = await Notification.create({
          adminId,
          title,
          message,
          type: actualType,
          data: {
            ...data,
            timestamp: new Date().toISOString()
          },
          recipients: recipients.map(r => ({
            email: r.email,
            name: r.name,
            status: 'pending'
          }))
        });
        console.log(`📋 Notification record created: ${notification._id}`);
      } else {
        console.log(`🧪 Test notification - skipping database save`);
      }

      let emailSent = false;
      let pushSent = false;

      // ✅ FIXED: Proper email settings check
      const shouldSendEmail = settings.emailNotifications === true || 
                             (settings.emailNotifications?.[actualType] === true);
      
      console.log(`📧 Email settings check:`, {
        globalEmailSetting: settings.emailNotifications,
        typeSpecificSetting: settings.emailNotifications?.[actualType],
        shouldSendEmail,
        adminEmail: admin.email
      });
      
      if (admin.email && shouldSendEmail) {
        try {
          console.log(`📧 Sending emails to ${recipients.length} recipients`);
          const emailResults = await this.sendEmailNotification(admin, actualType, title, message, data);
          emailSent = emailResults.length > 0;

          // ✅ Update recipient statuses (only if notification was saved to DB)
          if (notification) {
            for (let i = 0; i < notification.recipients.length; i++) {
              const result = emailResults[i];
              if (result && result.success) {
                notification.recipients[i].status = 'sent';
                notification.recipients[i].sentAt = new Date();
              } else {
                notification.recipients[i].status = 'failed';
                notification.recipients[i].error = result?.error || 'Unknown error';
              }
            }
          }

          console.log('✅ Emails sent successfully');
        } catch (emailError) {
          console.error('❌ Email send failed:', emailError.message);
          
          // Mark all recipients as failed (only if notification was saved to DB)
          if (notification) {
            notification.recipients.forEach(recipient => {
              recipient.status = 'failed';
              recipient.error = emailError.message;
            });
          }
        }
      } else {
        console.log('📧 Email notifications disabled or no admin email');
      }

      // ✅ FIXED: Proper app notification settings check
      const shouldSendPush = settings.appNotifications === true || 
                            (settings.appNotifications?.[actualType] === true);

      console.log(`📱 App settings check:`, {
        globalAppSetting: settings.appNotifications,
        typeSpecificSetting: settings.appNotifications?.[actualType],
        shouldSendPush
      });

      if (shouldSendPush) {
        try {
          console.log(`📱 Sending push notifications to recipients`);
          const pushResults = await this.sendPushNotification(admin, title, message, data, recipients);
          pushSent = pushResults.length > 0;
          console.log(`✅ Push notifications sent: ${pushResults.length}`);
        } catch (pushError) {
          console.error('❌ Push send failed:', pushError.message);
        }
      } else {
        console.log('📱 App notifications disabled');
      }

      // ✅ Update notification record (only if it was saved to DB)
      if (notification) {
        notification.emailSent = emailSent;
        notification.appNotificationSent = pushSent;
        await notification.save();
      }

      return {
        id: notification?._id || 'test-notification',
        emailSent,
        pushSent,
        type: actualType,
        title,
        message,
        recipientCount: recipients.length
      };

    } catch (error) {
      console.error('❌ Notification service error:', error);
      throw error;
    }
  }

  /* ✅ NEW: Extract recipients from data */
  extractRecipients(data) {
    const recipients = [];

    // Extract students as recipients
    if (data.students && Array.isArray(data.students)) {
      data.students.forEach(student => {
        if (student.email) {
          recipients.push({
            email: student.email,
            name: student.name || 'Student',
            type: 'student',
            id: student._id
          });
        }
      });
    }

    // Extract single result recipient
    if (data.resultData && data.resultData.studentEmail) {
      recipients.push({
        email: data.resultData.studentEmail,
        name: data.resultData.studentName || 'Student',
        type: 'student',
        id: data.resultData.studentId
      });
    }

    return recipients;
  }

  /* ✅ FIXED: Email notification with result tracking */
  async sendEmailNotification(admin, type, title, message, data) {
    console.log(`📧 Processing email for type: ${type}`);
    const results = [];

    switch (type) {
      case 'test_created':
      case 'test_assignment': {
        const students = data.students || [];
        const testData = data.testData || data.tests?.[0] || {};

        console.log(`📧 Sending test assignment emails to ${students.length} students`);

        if (students.length === 0) {
          console.warn('⚠️ No students provided for test assignment email');
          return results;
        }

        for (const student of students) {
          try {
            if (!student.email) {
              console.warn(`⚠️ Student ${student.name} has no email address`);
              results.push({ success: false, error: 'No email address', student: student.name });
              continue;
            }

            await EmailService.sendTestNotificationToStudent(student, testData);
            console.log(`✅ Email sent to ${student.email}`);
            results.push({ success: true, email: student.email, student: student.name });
          } catch (error) {
            console.error(`❌ Failed to send email to ${student.email}:`, error.message);
            results.push({ success: false, error: error.message, email: student.email, student: student.name });
          }
        }

        return results;
      }

      case 'result_published': {
        console.log(`📧 Processing result published email`);
        const resultData = data.resultData || data;

        if (!resultData.studentEmail) {
          console.warn('⚠️ No student email provided for result notification');
          return results;
        }

        if (!['published', 'reviewed'].includes(resultData.status)) {
          console.warn(`⚠️ Result status is '${resultData.status}', not sending email`);
          return results;
        }

        const student = {
          name: resultData.studentName || 'Student',
          email: resultData.studentEmail
        };

        try {
          await EmailService.sendResultNotificationToStudent(student, resultData);
          console.log(`✅ Result notification sent to ${student.email}`);
          results.push({ success: true, email: student.email, student: student.name });
        } catch (error) {
          console.error(`❌ Failed to send result email to ${student.email}:`, error.message);
          results.push({ success: false, error: error.message, email: student.email, student: student.name });
        }

        return results;
      }

      default: {
        console.log(`📧 Sending default admin notification`);
        
        if (!EmailService.transporter) {
          throw new Error('Email transporter not configured');
        }

        try {
          await EmailService.transporter.sendMail({
            from: `"CompuTech Exam Platform" <${process.env.EMAIL_USER}>`,
            to: admin.email,
            subject: title,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2563eb;">${title}</h2>
                <p>${message}</p>
                <hr>
                <p><small>This is an automated message from CompuTech Exam Platform</small></p>
              </div>
            `
          });

          results.push({ success: true, email: admin.email, recipient: 'admin' });
        } catch (error) {
          results.push({ success: false, error: error.message, email: admin.email, recipient: 'admin' });
        }

        return results;
      }
    }
  }

  /* ✅ FIXED: Push notifications with actual implementation */
  async sendPushNotification(admin, title, message, data, recipients = []) {
    const results = [];

    try {
      // Get subscriptions for all recipients
      const subscriptions = await this.getPushSubscriptions(recipients);
      
      if (subscriptions.length === 0) {
        console.log('📱 No push subscriptions found for recipients');
        return results;
      }

      const payload = JSON.stringify({
        title,
        body: message,
        icon: '/icon-192x192.png',
        badge: '/icon-192x192.png',
        data: { 
          url: '/student',
          type: data.type || 'notification',
          timestamp: new Date().toISOString(),
          ...data 
        }
      });

      console.log(`📱 Sending push to ${subscriptions.length} subscriptions`);

      for (const subscription of subscriptions) {
        try {
          await webpush.sendNotification(subscription.subscription, payload);
          results.push({ success: true, userId: subscription.userId });
          console.log(`✅ Push sent to user ${subscription.userId}`);
        } catch (error) {
          console.error(`❌ Push failed for user ${subscription.userId}:`, error.message);
          results.push({ success: false, error: error.message, userId: subscription.userId });
          
          // Remove invalid subscriptions
          if (error.statusCode === 410) {
            await PushSubscription.deleteOne({ _id: subscription._id });
            console.log(`🗑️ Removed invalid subscription for user ${subscription.userId}`);
          }
        }
      }

    } catch (error) {
      console.error('❌ Push notification error:', error);
    }

    return results;
  }

  /* ✅ FIXED: Get push subscriptions for recipients */
  async getPushSubscriptions(recipients = []) {
    try {
      if (recipients.length === 0) {
        return [];
      }

      const userIds = recipients.map(r => r.id).filter(Boolean);
      
      if (userIds.length === 0) {
        return [];
      }

      const subscriptions = await PushSubscription.find({
        userId: { $in: userIds },
        active: true
      });

      console.log(`📱 Found ${subscriptions.length} active subscriptions for ${userIds.length} users`);
      return subscriptions;
    } catch (error) {
      console.error('❌ Error getting push subscriptions:', error);
      return [];
    }
  }

  /* ✅ NEW: Subscribe user to push notifications */
  async subscribeToPush(userId, subscription, userAgent = '') {
    try {
      console.log(`📱 Subscribing user ${userId} to push notifications`);

      // Remove existing subscription for this user/endpoint
      await PushSubscription.deleteMany({
        $or: [
          { userId: userId },
          { 'subscription.endpoint': subscription.endpoint }
        ]
      });

      // Create new subscription
      const newSubscription = await PushSubscription.create({
        userId,
        subscription,
        userAgent,
        active: true
      });

      console.log(`✅ User ${userId} subscribed to push notifications`);
      return newSubscription;
    } catch (error) {
      console.error('❌ Error subscribing to push:', error);
      throw error;
    }
  }

  /* ✅ NEW: Unsubscribe user from push notifications */
  async unsubscribeFromPush(userId, endpoint = null) {
    try {
      const query = { userId };
      if (endpoint) {
        query['subscription.endpoint'] = endpoint;
      }

      const result = await PushSubscription.deleteMany(query);
      console.log(`✅ Unsubscribed user ${userId} - removed ${result.deletedCount} subscriptions`);
      return result;
    } catch (error) {
      console.error('❌ Error unsubscribing from push:', error);
      throw error;
    }
  }

  /* ✅ Helper: Ensure notification settings exist */
  async ensureSettings(adminId) {
    try {
      // First try to get existing settings
      let settings = await NotificationSettings.findOne({ adminId });
      
      // If no admin-specific settings, try to get global settings (from frontend)
      if (!settings) {
        settings = await NotificationSettings.findOne({});
      }
      
      // If still no settings, create default ones
      if (!settings) {
        settings = await NotificationSettings.findOneAndUpdate(
          { adminId },
          {
            $setOnInsert: {
              emailNotifications: true, // Global setting
              appNotifications: true,   // Global setting
              emailTemplates: {
                test_assigned: {
                  subject: 'New Test Assigned - {{testTitle}}',
                  body: 'Hello {{studentName}}, A new test has been assigned to you...'
                },
                result_published: {
                  subject: 'Test Results Published - {{testTitle}}',
                  body: 'Hello {{studentName}}, Your test results have been published...'
                }
              }
            }
          },
          { upsert: true, new: true }
        );
      }
      
      console.log('📧 Retrieved notification settings:', {
        emailNotifications: settings.emailNotifications,
        appNotifications: settings.appNotifications
      });
      
      return settings;
    } catch (error) {
      console.error('❌ Error ensuring settings:', error);
      // Return default settings as fallback
      return {
        emailNotifications: true,
        appNotifications: true
      };
    }
  }

  /* ✅ Bulk methods remain the same */
  async sendBulkTestNotification(testData, students, adminIds) {
    console.log(`📧 Sending bulk test notification for ${testData.title} to ${adminIds.length} admins`);
    
    const results = await Promise.allSettled(
      adminIds.map(id =>
        this.sendNotification(
          id,
          'test_created',
          `📝 New Test: ${testData.title}`,
          `Test "${testData.title}" assigned to ${students.length} students`,
          { testData, students }
        )
      )
    );

    return results;
  }

  async sendBulkResultNotification(resultData, adminIds) {
    console.log(`📧 Sending bulk result notification for ${resultData.testTitle} to ${adminIds.length} admins`);
    
    const results = await Promise.allSettled(
      adminIds.map(id =>
        this.sendNotification(
          id,
          'result_published',
          `📊 Result Published: ${resultData.studentName}`,
          `Results for "${resultData.testTitle}" have been published`,
          { resultData }
        )
      )
    );

    return results;
  }
}

module.exports = new NotificationService();
