const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { authenticateStudent, authenticateAdmin } = require('../middleware/auth');
const { google } = require('googleapis');
const monitoringService = require('../services/monitoringService');

// Configure multer for monitoring image uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

// Google Drive service initialization
const getDriveService = () => {
  const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, '..', 'gdrive-credentials.json'),
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });
  
  return google.drive({ version: 'v3', auth });
};

// Upload monitoring image to Google Drive
const uploadToGoogleDrive = async (fileBuffer, fileName, mimeType) => {
  try {
    const drive = getDriveService();
    
    // Create monitoring folder if it doesn't exist
    const folderName = `Exam_Monitoring_${new Date().getFullYear()}`;
    let folderId;
    
    try {
      const folderSearch = await drive.files.list({
        q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder'`,
        fields: 'files(id, name)',
      });
      
      if (folderSearch.data.files.length > 0) {
        folderId = folderSearch.data.files[0].id;
      } else {
        const folderCreate = await drive.files.create({
          requestBody: {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
          },
        });
        folderId = folderCreate.data.id;
      }
    } catch (error) {
      console.error('Error creating/finding monitoring folder:', error);
      throw error;
    }
    
    // Upload the monitoring image
    const fileMetadata = {
      name: fileName,
      parents: [folderId],
    };
    
    const media = {
      mimeType,
      body: require('stream').Readable.from(fileBuffer),
    };
    
    const file = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, name, webViewLink, webContentLink',
    });
    
    // Make file accessible to admins
    await drive.permissions.create({
      fileId: file.data.id,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });
    
    return {
      fileId: file.data.id,
      fileName: file.data.name,
      webViewLink: file.data.webViewLink,
      webContentLink: file.data.webContentLink,
    };
  } catch (error) {
    console.error('Error uploading to Google Drive:', error);
    throw error;
  }
};

// Store monitoring data in database
const storeMonitoringData = async (monitoringData) => {
  try {
    // This would typically use your database connection
    // For now, storing in a JSON file for simplicity
    const dataFile = path.join(__dirname, '..', 'data', 'monitoring.json');
    
    let existingData = [];
    try {
      const fileContent = await fs.readFile(dataFile, 'utf8');
      existingData = JSON.parse(fileContent);
    } catch (error) {
      // File doesn't exist yet, start with empty array
    }
    
    existingData.push(monitoringData);
    
    // Ensure data directory exists
    await fs.mkdir(path.dirname(dataFile), { recursive: true });
    await fs.writeFile(dataFile, JSON.stringify(existingData, null, 2));
    
    return monitoringData;
  } catch (error) {
    console.error('Error storing monitoring data:', error);
    throw error;
  }
};

// API endpoint to upload monitoring images
router.post('/upload', authenticateStudent, upload.single('monitoringImage'), async (req, res) => {
  try {
    const { testId, timestamp, purpose, saveToGoogleDrive } = req.body;
    const studentId = req.student.studentId;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No monitoring image provided'
      });
    }
    
    if (!testId || !timestamp) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: testId, timestamp'
      });
    }
    
    // Generate unique filename
    const fileExtension = path.extname(req.file.originalname) || '.jpg';
    const fileName = `monitoring_${studentId}_${testId}_${Date.now()}${fileExtension}`;
    
    let driveResult = null;
    
    // Only upload to Google Drive if requested
    if (saveToGoogleDrive === 'true' || saveToGoogleDrive === true) {
      try {
        driveResult = await uploadToGoogleDrive(
          req.file.buffer,
          fileName,
          req.file.mimetype
        );
      } catch (driveError) {
        console.warn('Google Drive upload failed, continuing without it:', driveError.message);
      }
    }
    
    // Save image to tmp/monitoring folder
    const tmpMonitoringDir = path.join(__dirname, '..', 'tmp', 'monitoring');
    await fs.mkdir(tmpMonitoringDir, { recursive: true });
    const localFilePath = path.join(tmpMonitoringDir, fileName);
    await fs.writeFile(localFilePath, req.file.buffer);
    
    // Prepare monitoring data
    const monitoringData = {
      id: `mon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      studentId,
      testId,
      timestamp,
      purpose: purpose || 'monitoring',
      fileName: driveResult?.fileName || fileName,
      localPath: `tmp/monitoring/${fileName}`, // Add local path for access
      fileId: driveResult?.fileId || null,
      webViewLink: driveResult?.webViewLink || null,
      webContentLink: driveResult?.webContentLink || null,
      uploadedAt: new Date().toISOString(),
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      suspicious: false, // Will be updated by AI analysis
      analysisResults: null, // Will be populated by AI analysis
      savedToGoogleDrive: !!driveResult, // Track if successfully saved to Drive
      savedToLocal: true, // Track that it's saved locally
    };

    // Store monitoring data
    await storeMonitoringData(monitoringData);    console.log(`📷 Monitoring image uploaded: ${fileName} for student ${studentId}`);
    
    res.json({
      success: true,
      message: 'Monitoring image uploaded successfully',
      data: {
        monitoringId: monitoringData.id,
        fileName: driveResult.fileName,
        uploadedAt: monitoringData.uploadedAt,
      }
    });
    
  } catch (error) {
    console.error('Error uploading monitoring image:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload monitoring image',
      error: error.message
    });
  }
});

// API endpoint to get monitoring data for a student's test
router.get('/test/:testId', authenticateStudent, async (req, res) => {
  try {
    const { testId } = req.params;
    const studentId = req.student.studentId;
    
    const dataFile = path.join(__dirname, '..', 'data', 'monitoring.json');
    
    try {
      const fileContent = await fs.readFile(dataFile, 'utf8');
      const allData = JSON.parse(fileContent);
      
      // Filter data for this student and test
      const studentData = allData.filter(
        item => item.studentId === studentId && item.testId === testId
      );
      
      res.json({
        success: true,
        data: studentData,
        count: studentData.length
      });
      
    } catch (error) {
      // No monitoring data yet
      res.json({
        success: true,
        data: [],
        count: 0
      });
    }
    
  } catch (error) {
    console.error('Error fetching monitoring data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch monitoring data',
      error: error.message
    });
  }
});

// API endpoint for admins to view all monitoring data
router.get('/admin/all', authenticateAdmin, async (req, res) => {
  try {
    // This should check for admin privileges in a real app
    // For now, allowing access for demonstration
    
    const { testId, studentId, suspicious, page = 1, limit = 50 } = req.query;
    
    const dataFile = path.join(__dirname, '..', 'data', 'monitoring.json');
    
    try {
      const fileContent = await fs.readFile(dataFile, 'utf8');
      let allData = JSON.parse(fileContent);
      
      // Apply filters
      if (testId) {
        allData = allData.filter(item => item.testId === testId);
      }
      
      if (studentId) {
        allData = allData.filter(item => item.studentId === studentId);
      }
      
      if (suspicious === 'true') {
        allData = allData.filter(item => item.suspicious === true);
      }
      
      // Sort by timestamp (most recent first)
      allData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      // Paginate
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + parseInt(limit);
      const paginatedData = allData.slice(startIndex, endIndex);
      
      res.json({
        success: true,
        data: paginatedData,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: allData.length,
          totalPages: Math.ceil(allData.length / limit)
        }
      });
      
    } catch (error) {
      // No monitoring data yet
      res.json({
        success: true,
        data: [],
        pagination: {
          page: 1,
          limit: parseInt(limit),
          total: 0,
          totalPages: 0
        }
      });
    }
    
  } catch (error) {
    console.error('Error fetching admin monitoring data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch monitoring data',
      error: error.message
    });
  }
});

// API endpoint to serve monitoring images
router.get('/image/:monitoringId', authenticateAdmin, async (req, res) => {
  try {
    const { monitoringId } = req.params;
    
    const dataFile = path.join(__dirname, '..', 'data', 'monitoring.json');
    const fileContent = await fs.readFile(dataFile, 'utf8');
    const allData = JSON.parse(fileContent);
    
    // Find the monitoring record
    const monitoringRecord = allData.find(item => item.id === monitoringId);
    
    if (!monitoringRecord) {
      return res.status(404).json({
        success: false,
        message: 'Monitoring record not found'
      });
    }
    
    // If we have Google Drive links, redirect to them
    if (monitoringRecord.webViewLink) {
      return res.json({
        success: true,
        imageUrl: monitoringRecord.webViewLink,
        directUrl: monitoringRecord.webContentLink,
        type: 'google-drive'
      });
    }
    
    // If no Google Drive link, return error for now
    return res.status(404).json({
      success: false,
      message: 'Image not available - Google Drive link missing'
    });
    
  } catch (error) {
    console.error('Error serving monitoring image:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to serve monitoring image',
      error: error.message
    });
  }
});

// API endpoint to flag suspicious activity
router.post('/flag', authenticateStudent, async (req, res) => {
  try {
    const { monitoringId, suspicious, reason, analysisResults } = req.body;
    
    if (!monitoringId) {
      return res.status(400).json({
        success: false,
        message: 'Monitoring ID is required'
      });
    }
    
    const dataFile = path.join(__dirname, '..', 'data', 'monitoring.json');
    
    try {
      const fileContent = await fs.readFile(dataFile, 'utf8');
      const allData = JSON.parse(fileContent);
      
      // Find and update the monitoring record
      const recordIndex = allData.findIndex(item => item.id === monitoringId);
      
      if (recordIndex === -1) {
        return res.status(404).json({
          success: false,
          message: 'Monitoring record not found'
        });
      }
      
      // Update the record
      allData[recordIndex].suspicious = suspicious;
      allData[recordIndex].flagReason = reason;
      allData[recordIndex].analysisResults = analysisResults;
      allData[recordIndex].flaggedAt = new Date().toISOString();
      allData[recordIndex].flaggedBy = req.student?.studentId || 'system';
      
      // Save updated data
      await fs.writeFile(dataFile, JSON.stringify(allData, null, 2));
      
      res.json({
        success: true,
        message: 'Monitoring record updated successfully',
        data: allData[recordIndex]
      });
      
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: 'No monitoring data found'
      });
    }
    
  } catch (error) {
    console.error('Error flagging monitoring record:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to flag monitoring record',
      error: error.message
    });
  }
});

// Send real-time alert to admin about suspicious activity
router.post('/api/monitoring/alert', authenticateStudent, async (req, res) => {
  try {
    const { testId, studentId, alertType, confidence, timestamp, description } = req.body;
    
    // Create alert record
    const alert = {
      testId,
      studentId,
      alertType,
      confidence,
      timestamp,
      description,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    
    // Store alert in database (you may want to add a database model for this)
    console.log('🚨 SUSPICIOUS ACTIVITY ALERT:', alert);
    
    // In a real implementation, you might want to:
    // 1. Store in database
    // 2. Send real-time notification to admin dashboard
    // 3. Send email/SMS to administrators
    // 4. Trigger additional monitoring
    
    // For now, we'll just log and acknowledge
    res.json({
      success: true,
      message: 'Alert sent to administrators',
      alertId: `alert_${Date.now()}`
    });
    
  } catch (error) {
    console.error('Failed to send monitoring alert:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send alert',
      error: error.message
    });
  }
});

// ===============================
// NEW ENHANCED MONITORING ENDPOINTS
// ===============================

// Start monitoring session
router.post('/start', authenticateStudent, async (req, res) => {
  try {
    const { testId, sessionId, settings } = req.body;
    const studentId = req.student._id;

    console.log(`📸 Starting monitoring for student: ${studentId}, test: ${testId}`);

    const session = monitoringService.startMonitoring(
      sessionId || `${studentId}_${testId}_${Date.now()}`,
      studentId,
      testId,
      settings
    );

    res.json({
      success: true,
      message: 'Monitoring started successfully',
      sessionId: session.sessionId,
      settings: session.settings
    });

  } catch (error) {
    console.error('❌ Error starting monitoring:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start monitoring',
      error: error.message
    });
  }
});

// Record violation
router.post('/violation', authenticateStudent, async (req, res) => {
  try {
    const { sessionId, type, details, severity } = req.body;

    if (!sessionId || !type) {
      return res.status(400).json({
        success: false,
        message: 'Session ID and violation type are required'
      });
    }

    const violation = monitoringService.recordViolation(
      sessionId,
      type,
      details || '',
      severity || 'medium'
    );

    if (!violation) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    res.json({
      success: true,
      message: 'Violation recorded',
      violation
    });

  } catch (error) {
    console.error('❌ Error recording violation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record violation',
      error: error.message
    });
  }
});

// Store monitoring image/screenshot
router.post('/screenshot', authenticateStudent, async (req, res) => {
  try {
    const { sessionId, imageData, type, flagged } = req.body;

    if (!sessionId || !imageData) {
      return res.status(400).json({
        success: false,
        message: 'Session ID and image data are required'
      });
    }

    const image = await monitoringService.storeMonitoringImage(
      sessionId,
      imageData,
      type || 'monitoring',
      flagged || false
    );

    if (!image) {
      return res.status(404).json({
        success: false,
        message: 'Session not found or failed to store image'
      });
    }

    res.json({
      success: true,
      message: 'Screenshot stored',
      image: {
        timestamp: image.timestamp,
        type: image.type,
        flagged: image.flagged
      }
    });

  } catch (error) {
    console.error('❌ Error storing screenshot:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to store screenshot',
      error: error.message
    });
  }
});

// Record suspicious activity
router.post('/suspicious', authenticateStudent, async (req, res) => {
  try {
    const { sessionId, type, confidence, description } = req.body;

    if (!sessionId || !type) {
      return res.status(400).json({
        success: false,
        message: 'Session ID and activity type are required'
      });
    }

    const activity = monitoringService.recordSuspiciousActivity(
      sessionId,
      type,
      confidence || 0.5,
      description || ''
    );

    if (!activity) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    res.json({
      success: true,
      message: 'Suspicious activity recorded',
      activity
    });

  } catch (error) {
    console.error('❌ Error recording suspicious activity:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record suspicious activity',
      error: error.message
    });
  }
});

// Get session statistics
router.get('/stats/:sessionId', authenticateStudent, (req, res) => {
  try {
    const { sessionId } = req.params;
    const stats = monitoringService.getSessionStats(sessionId);

    if (!stats) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('❌ Error getting session stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get session stats',
      error: error.message
    });
  }
});

// End monitoring session
router.post('/end', authenticateStudent, async (req, res) => {
  try {
    const { sessionId, resultId, startTime, endTime } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID is required'
      });
    }

    // Pass the timestamps to the service
    const endResult = await monitoringService.endMonitoring(sessionId, resultId, startTime, endTime);

    if (!endResult) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    res.json({
      success: true,
      message: 'Monitoring ended successfully',
      result: endResult
    });

  } catch (error) {
    console.error('❌ Error ending monitoring:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to end monitoring',
      error: error.message
    });
  }
});

// Get active sessions (admin only)
router.get('/active', authenticateAdmin, (req, res) => {
  try {
    const sessions = monitoringService.getActiveSessions();
    res.json({
      success: true,
      activeSessions: sessions,
      count: sessions.length
    });

  } catch (error) {
    console.error('❌ Error getting active sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get active sessions',
      error: error.message
    });
  }
});

module.exports = router;

// Export utility functions for use by other modules
module.exports.uploadToGoogleDrive = uploadToGoogleDrive;
