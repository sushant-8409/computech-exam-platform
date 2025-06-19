/* ──────────────────────────────────────────────────────────────── */
/*  services/notificationService.js                                 */
/* ──────────────────────────────────────────────────────────────── */
const mongoose  = require('mongoose');
const webpush   = require('web-push');

const Notification          = require('../models/Notification');
const NotificationSettings  = require('../models/NotificationSettings');
const EmailService          = require('./emailService');
const User                  = require('../models/User');      // admin / user
/* if you store push subs in a collection, require that model here */

/* Web-push VAPID */
webpush.setVapidDetails(
  'mailto:your-compputechmailer@gmail.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

/* helper – returns real admin doc or ENV fallback */
async function getAdmin(adminId) {
  const admin = await User.findById(adminId);
  if (admin) return admin;

  console.warn('⚠️  No admin row – falling back to .env admin');
  return {
    _id:   adminId,
    name:  process.env.ADMIN_NAME  || 'Administrator',
    email: process.env.ADMIN_EMAIL || 'admin@example.com'
  };
}

/* ──────────────────────────────────────────────────────────────── */
class NotificationService {

  /* bind all methods once so “this” is never lost */
  constructor() {
    [
      'sendNotification', 'sendEmailNotification', 'sendPushNotification',
      'getPushSubscriptions', 'sendBulkTestNotification',
      'sendBulkResultNotification'
    ].forEach(fn => { this[fn] = this[fn].bind(this); });
  }

  /* ============================================================ */
  /*  SINGLE NOTIFICATION                                         */
  /* ============================================================ */
  async sendNotification(adminId, type, title, message, data = {}) {

    if (!mongoose.Types.ObjectId.isValid(adminId)) {
      throw new Error('Invalid adminId');
    }

    /* make sure settings doc exists */
    const settings = await NotificationSettings.findOneAndUpdate(
      { adminId }, {}, { upsert: true, new: true }
    );

    const admin = await getAdmin(adminId);

    /* store the notification first */
    const notification = await Notification.create({
      adminId, title, message, type, data
    });

    /* ---------------- EMAIL ---------------- */
    const emailAllowed =
      admin.email &&
      settings.emailNotifications[type] &&
      (
        type !== 'result_published' ||
        (data.resultData?.status === 'published' ||
         data.resultData?.status === 'reviewed')
      );

    if (emailAllowed) {
      try {
        await this.sendEmailNotification(admin, type, title, message, data);
        notification.emailSent = true;
      } catch (e) { console.error('❌  Email send failed:', e.message); }
    }

    /* ---------------- PUSH ----------------- */
    if (settings.appNotifications[type]) {
      try {
        await this.sendPushNotification(admin, title, message, data);
        notification.appNotificationSent = true;
      } catch (e) { console.error('❌  Push send failed:', e.message); }
    }

    await notification.save();
    return notification;
  }

  /* ============================================================ */
  /*  E-MAIL HANDLER                                              */
  /* ============================================================ */
  async sendEmailNotification(admin, type, title, message, data) {
    switch (type) {

      /* ── test assignment → each student gets mail ─────────── */
      case 'test_created':
      case 'test_completed': {
        const testData = data.testData || data.tests?.[0] || {};
        const students = data.students || [];

        await Promise.allSettled(
          students.map(s =>
            EmailService.sendTestNotificationToStudent(s, testData))
        );
        return;
      }

      /* ── result published / reviewed → one student ────────── */
      case 'result_published': {
        const r = data.resultData || {};
        if (
          (r.status === 'published' || r.status === 'reviewed') &&
          r.studentEmail
        ) {
          const student = { name: r.studentName, email: r.studentEmail };
          await EmailService.sendResultNotificationToStudent(student, r);
        }
        return;
      }

      /* ── anything else → notify admin only ───────────────── */
      default:
        return EmailService.transporter.sendMail({
          from: `"CompuTech Exam Platform" <${process.env.EMAIL_USER}>`,
          to:   admin.email,
          subject: title,
          html: `<p>${message}</p>`
        });
    }
  }

  /* ============================================================ */
  /*  PUSH HANDLER (stub)                                         */
  /* ============================================================ */
  async sendPushNotification(admin, title, message, data) {
    const subs = await this.getPushSubscriptions(admin._id);
    if (!subs.length) return;

    const payload = JSON.stringify({
      title,
      body: message,
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
      data: { url: '/admin', ...data }
    });

    await Promise.all(subs.map(s => webpush.sendNotification(s, payload)));
  }

  async getPushSubscriptions(/* adminId */) { return []; }   // TODO

  /* ============================================================ */
  /*  BULK HELPERS                                                */
  /* ============================================================ */
  async sendBulkTestNotification(testData, students, adminIds) {
    return Promise.all(
      adminIds.map(id =>
        this.sendNotification(
          id, 'test_created',
          `📝 New Test: ${testData.title}`,
          `Test "${testData.title}" assigned to ${students.length} students`,
          { testData, students }
        )
      )
    );
  }

  async sendBulkResultNotification(resultData, adminIds) {
    return Promise.all(
      adminIds.map(id =>
        this.sendNotification(
          id, 'result_published',
          `📊 Result Published: ${resultData.studentName}`,
          `Results for "${resultData.testTitle}" have been published`,
          { resultData }
        )
      )
    );
  }
}

/* ─────────────────────────────────────────────────────────────── */
module.exports = new NotificationService();
