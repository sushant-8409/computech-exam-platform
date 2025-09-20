const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const Result = require('../models/Result');

class MonitoringService {
  constructor() {
    this.activeSessions = new Map();
    this.monitoringIntervals = new Map();
    this.violationThresholds = {
      tabSwitch: 5,
      fullscreenExit: 3,
      focusLoss: 10,
      inactivity: 300000 // 5 minutes in ms
    };
  }

  // Initialize monitoring for a test session
  startMonitoring(sessionId, studentId, testId, settings) {
    settings = settings || {};
    console.log(`📸 Starting monitoring for session: ${sessionId}`);
    
    const sessionData = {
      sessionId,
      studentId,
      testId,
      startTime: new Date(),
      settings: {
        cameraMonitoring: settings.cameraMonitoring || false,
        browserLockdown: settings.browserLockdown || false,
        screenshotInterval: settings.screenshotInterval || 30000, // 30 seconds
        flagSuspiciousActivity: settings.flagSuspiciousActivity || true
      },
      violations: [],
      monitoringImages: [],
      suspiciousActivities: [],
      stats: {
        tabSwitchCount: 0,
        fullscreenViolations: 0,
        focusLostCount: 0,
        totalViolations: 0,
        lastActivity: new Date()
      }
    };

    this.activeSessions.set(sessionId, sessionData);

    // Start periodic monitoring if camera is enabled
    if (sessionData.settings.cameraMonitoring) {
      const intervalId = setInterval(() => {
        this.performPeriodicCheck(sessionId);
      }, sessionData.settings.screenshotInterval);
      
      this.monitoringIntervals.set(sessionId, intervalId);
    }

    return sessionData;
  }

  // Record a violation
  recordViolation(sessionId, violationType, details, severity) {
    details = details || '';
    severity = severity || 'medium';
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      console.warn(`⚠️ No active session found for: ${sessionId}`);
      return null;
    }

    const violation = {
      type: violationType,
      timestamp: new Date(),
      details,
      severity,
      sessionTime: Date.now() - session.startTime.getTime()
    };

    session.violations.push(violation);
    session.stats.totalViolations++;
    session.stats.lastActivity = new Date();

    // Update specific counters
    switch (violationType) {
      case 'tab_switch':
        session.stats.tabSwitchCount++;
        break;
      case 'fullscreen_exit':
        session.stats.fullscreenViolations++;
        break;
      case 'focus_loss':
        session.stats.focusLostCount++;
        break;
    }

    console.log(`⚠️ Violation recorded for ${sessionId}: ${violationType} - ${details}`);
    return violation;
  }

  // Store monitoring image
  async storeMonitoringImage(sessionId, imageData, type, flagged) {
    type = type || 'monitoring';
    flagged = flagged !== undefined ? flagged : false;
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      console.warn(`⚠️ No active session found for storing image: ${sessionId}`);
      return null;
    }

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `monitoring-${session.testId}-${session.studentId}-${timestamp}.jpg`;
      
      console.log(`📸 Storing monitoring image: ${filename}`);

      // In serverless/production environment, store monitoring data without file system
      const isServerless = process.env.VERCEL || process.env.NODE_ENV === 'production';
      let fileUrl = null;
      
      if (!isServerless) {
        // Local development: save to file system
        const monitoringDir = path.join(__dirname, '../tmp/monitoring');
        
        try {
          await fs.mkdir(monitoringDir, { recursive: true });
        } catch (mkdirErr) {
          console.warn('📁 Directory already exists or creation failed:', mkdirErr.message);
        }
        
        const filepath = path.join(monitoringDir, filename);
        
        if (imageData.startsWith('data:image')) {
          const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
          const imageBuffer = Buffer.from(base64Data, 'base64');
          await fs.writeFile(filepath, imageBuffer);
          fileUrl = `/tmp/monitoring/${filename}`;
        }
      } else {
        // Serverless: store metadata only, image data handled differently
        console.log('📸 Serverless environment: storing monitoring metadata only');
        fileUrl = `monitoring-${session.testId}-${timestamp}`;
      }

      const monitoringImage = {
        url: fileUrl,
        data: isServerless ? null : null, // Don't store large base64 in memory for performance
        timestamp: new Date(),
        type,
        flagged,
        sessionTime: Date.now() - session.startTime.getTime(),
        filepath: filepath,
        filename: filename
      };

      // Get admin's Google Drive tokens for upload
      const User = require('../models/User');
      const adminUser = await User.findOne({ role: 'admin' });
      
      // Upload to Google Drive using admin tokens if available
      if (adminUser && adminUser.googleTokens && imageBuffer) {
        try {
          const { uploadToGDrive } = require('./oauthDrive');
          console.log('📤 Uploading monitoring image to Google Drive...');
          
          const driveResult = await uploadToGDrive(
            adminUser.googleTokens,
            imageBuffer,
            `exam-monitoring/${session.testId}/${session.studentId}/${filename}`,
            'image/jpeg'
          );
          
          if (driveResult) {
            monitoringImage.driveFileId = driveResult.id;
            monitoringImage.driveLink = driveResult.webViewLink;
            console.log('✅ Monitoring image uploaded to Drive:', driveResult.id);
          }
        } catch (driveError) {
          console.warn('⚠️ Failed to upload monitoring image to Google Drive:', driveError.message);
        }
      }

      // Add to session for immediate tracking
      session.monitoringImages.push(monitoringImage);
      session.stats.lastActivity = new Date();

      // Save monitoring image to database immediately for admin review
      try {
        const updatedResult = await Result.findOneAndUpdate(
          { studentId: session.studentId, testId: session.testId },
          { 
            $push: { monitoringImages: monitoringImage },
            $set: { 
              cameraMonitoring: session.settings.cameraMonitoring,
              totalViolations: session.stats.totalViolations,
              tabSwitchCount: session.stats.tabSwitchCount,
              fullscreenViolations: session.stats.fullscreenViolations
            }
          },
          { new: true, upsert: false }
        );

        if (updatedResult) {
          console.log(`✅ Monitoring image saved to database for student ${session.studentId}`);
        } else {
          console.warn(`⚠️ Result not found for student ${session.studentId}, test ${session.testId}`);
        }
      } catch (dbError) {
        console.error('❌ Error saving monitoring image to database:', dbError.message);
      }

      console.log(`📸 Monitoring image stored for ${sessionId}: ${type} ${flagged ? '(flagged)' : ''}`);
      return monitoringImage;

    } catch (error) {
      console.error('❌ Error storing monitoring image:', error);
      return null;
    }
  }

  // Record suspicious activity (temporarily disabled due to syntax issue)
  /*
  recordSuspiciousActivity(sessionId, activityType, confidence, description) {
    confidence = confidence !== undefined ? confidence : 0.5;
    description = description || '';
    const session = this.activeSessions.get(sessionId);
    if (!session) return null;

    var activity = {
      timestamp: new Date(),
      type: activityType,
      confidence: confidence,
      description: description,
      severity: confidence > 0.8 ? 'high' : confidence > 0.5 ? 'medium' : 'low',
      sessionTime: Date.now() - session.startTime.getTime()
    };

    session.suspiciousActivities.push(activity);
    session.stats.lastActivity = new Date();

    // Auto-flag high confidence suspicious activities
    if (confidence > 0.8) {
      this.recordViolation(sessionId, 'suspicious_activity', description, 'high');
    }

    console.log(`🚨 Suspicious activity recorded for ${sessionId}: ${activityType} (${Math.round(confidence * 100)}%)`);
    return activity;
  }
  */

  // Perform periodic monitoring check
  async performPeriodicCheck(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    // Check for inactivity
    const inactiveTime = Date.now() - session.stats.lastActivity.getTime();
    if (inactiveTime > this.violationThresholds.inactivity) {
      this.recordViolation(sessionId, 'inactivity', `No activity for ${Math.round(inactiveTime / 60000)} minutes`, 'medium');
    }

    // Here you could add more automated checks like:
    // - Face detection analysis
    // - Screen content analysis
    // - Audio level monitoring
    console.log(`🔍 Periodic check completed for ${sessionId}`);
  }

  // Get session statistics
  getSessionStats(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return null;

    return {
      sessionId,
      duration: Date.now() - session.startTime.getTime(),
      totalViolations: session.stats.totalViolations,
      tabSwitchCount: session.stats.tabSwitchCount,
      fullscreenViolations: session.stats.fullscreenViolations,
      focusLostCount: session.stats.focusLostCount,
      monitoringImagesCount: session.monitoringImages.length,
      suspiciousActivitiesCount: session.suspiciousActivities.length,
      lastActivity: session.stats.lastActivity
    };
  }

  // End monitoring and save to database
  async endMonitoring(sessionId, resultId, startTime, endTime) {
    resultId = resultId || null;
    startTime = startTime || null;
    endTime = endTime || null;
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      console.warn(`⚠️ No active session found to end: ${sessionId}`);
      return null;
    }

    console.log(`🏁 Ending monitoring for session: ${sessionId}`);

    // Clear monitoring interval
    const intervalId = this.monitoringIntervals.get(sessionId);
    if (intervalId) {
      clearInterval(intervalId);
      this.monitoringIntervals.delete(intervalId);
    }

    // Use provided timestamps or default to session times
    const actualStartTime = startTime ? new Date(startTime) : session.startTime;
    const actualEndTime = endTime ? new Date(endTime) : new Date();

    // Prepare monitoring data for database
    const monitoringData = {
      monitoringImages: session.monitoringImages,
      violations: session.violations,
      suspiciousActivities: session.suspiciousActivities,
      cameraMonitoring: session.settings.cameraMonitoring,
      browserLockdown: session.settings.browserLockdown,
      totalViolations: session.stats.totalViolations,
      tabSwitchCount: session.stats.tabSwitchCount,
      fullscreenViolations: session.stats.fullscreenViolations,
      focusLostCount: session.stats.focusLostCount,
      testStartTime: actualStartTime,
      testEndTime: actualEndTime,
      sessionDuration: actualEndTime.getTime() - actualStartTime.getTime()
    };

    // Save to database if resultId provided
    if (resultId) {
      try {
        await Result.findByIdAndUpdate(resultId, monitoringData);
        console.log(`✅ Monitoring data saved to result: ${resultId}`);
      } catch (error) {
        console.error('❌ Error saving monitoring data:', error);
      }
    }

    // Clean up session
    this.activeSessions.delete(sessionId);

    return {
      sessionId,
      endTime: actualEndTime,
      startTime: actualStartTime,
      duration: actualEndTime.getTime() - actualStartTime.getTime(),
      summary: monitoringData
    };
  }

  // Get active session data
  getActiveSession(sessionId) {
    return this.activeSessions.get(sessionId);
  }

  // List all active sessions
  getActiveSessions() {
    return Array.from(this.activeSessions.keys());
  }
}

// Export singleton instance
const monitoringService = new MonitoringService();
module.exports = monitoringService;
