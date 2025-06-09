const nodemailer = require('nodemailer');

// Fixed: Use createTransport instead of createTransporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: { rejectUnauthorized: false }
});

const sendTestNotification = async (studentEmail, testData) => {
  try {
    const { studentName, subject, message, testTitle } = testData;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head><title>Test Notification - CompuTech</title></head>
      <body style="font-family: Arial, sans-serif; background: #f8fafc; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden;">
          <div style="background: linear-gradient(135deg, #8b5cf6, #6366f1); color: white; padding: 30px; text-align: center;">
            <h1 style="margin: 0;">📚 CompuTech</h1>
            <p style="margin: 10px 0 0 0;">Test Notification</p>
          </div>
          <div style="padding: 30px;">
            <p>Dear <strong>${studentName}</strong>,</p>
            <div style="background: #f8fafc; padding: 20px; border-left: 4px solid #8b5cf6; margin: 20px 0;">
              <h3 style="margin-top: 0;">📝 New Test Available</h3>
              <p>${message}</p>
              ${testTitle ? `<p><strong>Test:</strong> ${testTitle}</p>` : ''}
            </div>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/student/dashboard" 
                 style="background: #22c55e; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: 600;">
                📚 Access Test Portal
              </a>
            </div>
            <p>Best regards,<br><strong>CompuTech Examination Team</strong></p>
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: `"CompuTech Exam Platform" <${process.env.EMAIL_USER}>`,
      to: studentEmail,
      subject: `📝 Test Notification - ${testTitle || subject || 'New Test Available'}`,
      html: htmlContent
    };

    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId, to: studentEmail };
  } catch (error) {
    console.error('Email sending error:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
};

module.exports = { sendTestNotification };
