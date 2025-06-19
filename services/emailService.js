/* services/emailService.js */
const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD }
    });
  }

  /* ────────────────────────────────────────────────────────────── */
  /*  Test-assignment message  (one message per student)           */
  /* ────────────────────────────────────────────────────────────── */
  async sendTestNotificationToStudent(student, testData) {
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto">
        <header style="background:#667eea;color:#fff;padding:18px;text-align:center">
          <h1 style="margin:0">🎓 CompuTech Exam Platform</h1>
        </header>

        <section style="padding:24px;background:#f7f7f9">
          <h2>Hi ${student.name},</h2>
          <p>You have been assigned a new test.</p>

          <div style="background:#fff;border-radius:8px;padding:18px;
                      box-shadow:0 2px 8px rgba(0,0,0,.08);margin:18px 0">
            <h3 style="margin-top:0;color:#667eea">📝 Test Details</h3>
            <p><strong>Title:</strong> ${testData.title}</p>
            <p><strong>Subject:</strong> ${testData.subject}</p>
            <p><strong>Class / Board:</strong> ${testData.class} / ${testData.board}</p>
            <p><strong>Duration:</strong> ${testData.duration} min</p>
            <p><strong>Total Marks:</strong> ${testData.totalMarks}</p>
            <p><strong>Opens:</strong> ${new Date(testData.startDate).toLocaleString('en-IN')}</p>
            <p><strong>Closes:</strong> ${new Date(testData.endDate).toLocaleString('en-IN')}</p>
          </div>

          <p style="text-align:center">
            <a href="https://computech-exam-platform.onrender.com/student/test/${testData._id}"
               style="background:#667eea;color:#fff;padding:12px 26px;
                      text-decoration:none;border-radius:6px">
              ▶️  Start / View Test
            </a>
          </p>
        </section>

        <footer style="background:#333;color:#fff;text-align:center;padding:12px;font-size:12px">
          CompuTech Exam Platform
        </footer>
      </div>`;

    await this.transporter.sendMail({
      from: `"CompuTech Exam Platform" <${process.env.EMAIL_USER}>`,
      to:   student.email,
      subject: `📝 New Test Assigned: ${testData.title}`,
      html
    });
  }

  /* ────────────────────────────────────────────────────────────── */
  /*  Result-published message  (one message per student)          */
  /* ────────────────────────────────────────────────────────────── */
  async sendResultNotificationToStudent(student, resultData) {
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto">
        <header style="background:#10b981;color:#fff;padding:18px;text-align:center">
          <h1 style="margin:0">📊 Result Published</h1>
        </header>

        <section style="padding:24px;background:#f7f7f9">
          <h2>Hi ${student.name},</h2>
          <p>Your result for <strong>${resultData.testTitle}</strong> is now available.</p>

          <div style="background:#fff;border-radius:8px;padding:18px;margin:18px 0;
                      box-shadow:0 2px 8px rgba(0,0,0,.08)">
            <p><strong>Marks:</strong> ${resultData.marksObtained}/${resultData.totalMarks}</p>
            <p><strong>Percentage:</strong> ${resultData.percentage}%</p>
            <p><strong>Status:</strong> ${resultData.status}</p>
          </div>

          <p style="text-align:center">
            <a href="https://computech-exam-platform.onrender.com/student/result/${resultData._id}"
               style="background:#10b981;color:#fff;padding:12px 26px;
                      text-decoration:none;border-radius:6px">
              🔍 View Full Breakdown
            </a>
          </p>
        </section>

        <footer style="background:#333;color:#fff;text-align:center;padding:12px;font-size:12px">
          CompuTech Exam Platform
        </footer>
      </div>`;

    await this.transporter.sendMail({
      from: `"CompuTech Exam Platform" <${process.env.EMAIL_USER}>`,
      to:   student.email,
      subject: `📊 Your Result: ${resultData.testTitle}`,
      html
    });
  }
}

module.exports = new EmailService();
