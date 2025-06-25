const nodemailer = require('nodemailer');
const path = require('path');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  // ✅ FIXED: Proper transporter initialization with debugging
  initializeTransporter() {
    try {
      console.log('📧 Initializing email transporter...');
      
      // Validate environment variables
      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.error('❌ Missing email credentials in environment variables');
        console.log('Required: EMAIL_USER, EMAIL_PASS');
        return;
      }

      console.log('📧 Email User:', process.env.EMAIL_USER);
      console.log('📧 Email Service:', process.env.EMAIL_SERVICE || 'gmail');

      this.transporter = nodemailer.createTransport({
        service: process.env.EMAIL_SERVICE || 'gmail',
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false, // true for 465, false for other ports
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS // Use App Password for Gmail
        },
        // ✅ Enable debugging
        debug: process.env.NODE_ENV === 'development',
        logger: process.env.NODE_ENV === 'development',
        // ✅ Additional security options
        tls: {
          rejectUnauthorized: false,
          ciphers: 'SSLv3'
        }
      });

      // ✅ Verify transporter configuration
      this.verifyConnection();

    } catch (error) {
      console.error('❌ Failed to initialize email transporter:', error);
    }
  }

  // ✅ Verify email connection
  async verifyConnection() {
    if (!this.transporter) {
      console.error('❌ Email transporter not initialized');
      return false;
    }

    try {
      console.log('🔍 Verifying email connection...');
      const verified = await this.transporter.verify();
      
      if (verified) {
        console.log('✅ Email server connection verified');
        return true;
      } else {
        console.error('❌ Email server verification failed');
        return false;
      }
    } catch (error) {
      console.error('❌ Email verification error:', error.message);
      console.error('🔍 Full error:', error);
      return false;
    }
  }

  // ✅ FIXED: Send test notification to student
  async sendTestNotificationToStudent(student, testData) {
    if (!this.transporter) {
      throw new Error('Email transporter not initialized');
    }

    if (!student.email) {
      throw new Error(`Student ${student.name} has no email address`);
    }

    console.log(`📧 Sending test notification to: ${student.email}`);

    const mailOptions = {
      from: `"CompuTech Exam Platform" <${process.env.EMAIL_USER}>`,
      to: student.email,
      subject: `📝 New Test Assignment: ${testData.title}`,
      html: this.getTestNotificationTemplate(student, testData),
      text: `Hello ${student.name},

A new test "${testData.title}" has been assigned to you.

Test Details:
- Subject: ${testData.subject}
- Duration: ${testData.duration} minutes
- Total Marks: ${testData.totalMarks}
- Start Date: ${new Date(testData.startDate).toLocaleDateString()}
- End Date: ${new Date(testData.endDate).toLocaleDateString()}

Please log in to your dashboard to take the test.

Best regards,
CompuTech Exam Platform`
    };

    try {
      const result = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Test notification sent to ${student.email}:`, result.messageId);
      return result;
    } catch (error) {
      console.error(`❌ Failed to send test notification to ${student.email}:`, error);
      throw error;
    }
  }

  // ✅ FIXED: Send result notification to student
  async sendResultNotificationToStudent(student, resultData) {
    if (!this.transporter) {
      throw new Error('Email transporter not initialized');
    }

    if (!student.email) {
      throw new Error(`Student ${student.name} has no email address`);
    }

    console.log(`📧 Sending result notification to: ${student.email}`);

    const mailOptions = {
      from: `"CompuTech Exam Platform" <${process.env.EMAIL_USER}>`,
      to: student.email,
      subject: `📊 Test Results Published: ${resultData.testTitle}`,
      html: this.getResultNotificationTemplate(student, resultData),
      text: `Hello ${student.name},

Your test results for "${resultData.testTitle}" have been published.

Results:
- Score: ${resultData.marksObtained}/${resultData.totalMarks}
- Percentage: ${resultData.percentage}%
- Status: ${resultData.status}

Please log in to your dashboard to view detailed results.

Best regards,
CompuTech Exam Platform`
    };

    try {
      const result = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Result notification sent to ${student.email}:`, result.messageId);
      return result;
    } catch (error) {
      console.error(`❌ Failed to send result notification to ${student.email}:`, error);
      throw error;
    }
  }

  // ✅ Test email functionality
  async sendTestEmail(to, subject = 'Test Email', message = 'This is a test email') {
    if (!this.transporter) {
      throw new Error('Email transporter not initialized');
    }

    console.log(`📧 Sending test email to: ${to}`);

    const mailOptions = {
      from: `"CompuTech Exam Platform" <${process.env.EMAIL_USER}>`,
      to: to,
      subject: subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2563eb;">Test Email</h2>
          <p>${message}</p>
          <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
          <hr>
          <p><small>This is a test email from CompuTech Exam Platform</small></p>
        </div>
      `,
      text: `${message}\n\nTimestamp: ${new Date().toISOString()}\n\nThis is a test email from CompuTech Exam Platform`
    };

    try {
      const result = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Test email sent to ${to}:`, result.messageId);
      return result;
    } catch (error) {
      console.error(`❌ Failed to send test email to ${to}:`, error);
      throw error;
    }
  }

  // ✅ HTML Templates
  getTestNotificationTemplate(student, testData) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Test Assignment</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 28px;">🎓 CompuTech Exam Platform</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px;">New Test Assignment</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #2563eb; margin-top: 0;">Hello ${student.name}!</h2>
          
          <p>A new test has been assigned to you. Please review the details below:</p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #2563eb; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #1f2937;">${testData.title}</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #6b7280;">Subject:</td>
                <td style="padding: 8px 0;">${testData.subject}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #6b7280;">Duration:</td>
                <td style="padding: 8px 0;">${testData.duration} minutes</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #6b7280;">Total Marks:</td>
                <td style="padding: 8px 0;">${testData.totalMarks}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #6b7280;">Available From:</td>
                <td style="padding: 8px 0;">${new Date(testData.startDate).toLocaleDateString()}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #6b7280;">Available Until:</td>
                <td style="padding: 8px 0;">${new Date(testData.endDate).toLocaleDateString()}</td>
              </tr>
            </table>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL || 'https://computech-exam-platform.onrender.com'}/student" 
               style="background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              📖 Take Test Now
            </a>
          </div>
          
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            Please log in to your student dashboard to access the test. Make sure to complete it within the specified time frame.
          </p>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">
            This is an automated message from CompuTech Exam Platform.<br>
            Please do not reply to this email.
          </p>
        </div>
      </body>
      </html>
    `;
  }

  getResultNotificationTemplate(student, resultData) {
    const percentage = resultData.percentage || 0;
    const isPassed = percentage >= 40;
    const statusColor = isPassed ? '#10b981' : '#ef4444';
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Test Results Published</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 28px;">🎓 CompuTech Exam Platform</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px;">Test Results Published</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #2563eb; margin-top: 0;">Hello ${student.name}!</h2>
          
          <p>Your test results have been published. Here are your scores:</p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid ${statusColor}; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #1f2937;">${resultData.testTitle}</h3>
            
            <div style="text-align: center; margin: 20px 0;">
              <div style="background: ${statusColor}; color: white; padding: 20px; border-radius: 8px; display: inline-block; min-width: 200px;">
                <div style="font-size: 36px; font-weight: bold;">${percentage}%</div>
                <div style="font-size: 18px;">${resultData.marksObtained}/${resultData.totalMarks}</div>
                <div style="font-size: 14px; margin-top: 10px;">${isPassed ? '✅ PASSED' : '❌ FAILED'}</div>
              </div>
            </div>
            
            <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #6b7280;">Status:</td>
                <td style="padding: 8px 0; color: ${statusColor}; font-weight: bold;">${resultData.status}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #6b7280;">Submitted At:</td>
                <td style="padding: 8px 0;">${new Date(resultData.submittedAt).toLocaleString()}</td>
              </tr>
            </table>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL || 'https://computech-exam-platform.onrender.com'}/student" 
               style="background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              📊 View Detailed Results
            </a>
          </div>
          
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            Log in to your dashboard to view question-wise breakdown and detailed analysis.
          </p>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">
            This is an automated message from CompuTech Exam Platform.<br>
            Please do not reply to this email.
          </p>
        </div>
      </body>
      </html>
    `;
  }
}

module.exports = new EmailService();
