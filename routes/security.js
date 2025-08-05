const express = require('express');
const router = express.Router();
const { authenticateStudent } = require('../middleware/auth');
const Student = require('../models/Student');

// Security violation logging model
const SecurityViolation = {
  studentId: String,
  testId: String,
  violationType: String,
  violationDetails: Object,
  timestamp: Date,
  userAgent: String,
  screenResolution: String,
  ipAddress: String,
  sessionId: String
};

// Store security violations in memory (can be moved to database later)
const securityViolations = [];

// POST /api/security-violation - Report security violation
router.post('/security-violation', authenticateStudent, async (req, res) => {
  try {
    const {
      studentId,
      testId,
      violationType,
      violationDetails,
      timestamp,
      userAgent,
      screenResolution
    } = req.body;

    const violation = {
      studentId,
      testId,
      violationType,
      violationDetails,
      timestamp: new Date(timestamp),
      userAgent,
      screenResolution,
      ipAddress: req.ip || req.connection.remoteAddress,
      sessionId: req.sessionID || 'unknown'
    };

    // Store violation
    securityViolations.push(violation);

    // Log violation to console for immediate attention
    console.error('🚨 SECURITY VIOLATION DETECTED:', {
      student: studentId,
      test: testId,
      type: violationType,
      details: violationDetails,
      timestamp: violation.timestamp,
      ip: violation.ipAddress
    });

    // Update student record to flag security violation
    if (studentId) {
      try {
        await Student.findByIdAndUpdate(studentId, {
          $push: {
            securityViolations: violation
          },
          $set: {
            lastSecurityViolation: violation.timestamp,
            securityStatus: 'flagged'
          }
        });
      } catch (dbError) {
        console.error('Failed to update student security record:', dbError);
      }
    }

    // Send alert to administrators (can be expanded with email/SMS)
    sendSecurityAlert(violation);

    res.status(200).json({
      success: true,
      message: 'Security violation recorded',
      violationId: securityViolations.length - 1
    });

  } catch (error) {
    console.error('Error recording security violation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record security violation'
    });
  }
});

// GET /api/security-violations - Get security violations (admin only)
router.get('/security-violations', authenticateStudent, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const { testId, studentId, limit = 100, offset = 0 } = req.query;

    let filteredViolations = securityViolations;

    // Filter by testId if provided
    if (testId) {
      filteredViolations = filteredViolations.filter(v => v.testId === testId);
    }

    // Filter by studentId if provided
    if (studentId) {
      filteredViolations = filteredViolations.filter(v => v.studentId === studentId);
    }

    // Sort by timestamp (most recent first)
    filteredViolations.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Apply pagination
    const paginatedViolations = filteredViolations.slice(offset, offset + parseInt(limit));

    res.json({
      success: true,
      violations: paginatedViolations,
      total: filteredViolations.length,
      page: Math.floor(offset / limit) + 1,
      totalPages: Math.ceil(filteredViolations.length / limit)
    });

  } catch (error) {
    console.error('Error fetching security violations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch security violations'
    });
  }
});

// GET /api/security-status/:studentId - Get student security status
router.get('/security-status/:studentId', authenticateStudent, async (req, res) => {
  try {
    const { studentId } = req.params;

    // Check if user is accessing their own data or is admin
    if (req.user.id !== studentId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const studentViolations = securityViolations.filter(v => v.studentId === studentId);
    const recentViolations = studentViolations.filter(v => 
      new Date(v.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
    );

    const violationTypes = [...new Set(studentViolations.map(v => v.violationType))];

    res.json({
      success: true,
      securityStatus: {
        totalViolations: studentViolations.length,
        recentViolations: recentViolations.length,
        violationTypes,
        lastViolation: studentViolations.length > 0 ? 
          Math.max(...studentViolations.map(v => new Date(v.timestamp))) : null,
        riskLevel: calculateRiskLevel(studentViolations)
      }
    });

  } catch (error) {
    console.error('Error fetching security status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch security status'
    });
  }
});

// Helper function to send security alerts
function sendSecurityAlert(violation) {
  // This can be expanded to send emails, SMS, or push notifications
  console.log('🚨 SECURITY ALERT - Immediate attention required:', {
    type: violation.violationType,
    student: violation.studentId,
    test: violation.testId,
    time: violation.timestamp,
    details: violation.violationDetails
  });

  // Future: Send email to administrators
  // Future: Send SMS alerts for critical violations
  // Future: Integrate with security monitoring systems
}

// Helper function to calculate risk level
function calculateRiskLevel(violations) {
  if (violations.length === 0) return 'low';
  if (violations.length < 3) return 'medium';
  if (violations.length < 5) return 'high';
  return 'critical';
}

// DELETE /api/security-violations/clear - Clear old violations (admin only)
router.delete('/security-violations/clear', authenticateStudent, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const { olderThan } = req.query; // Days
    const cutoffDate = new Date(Date.now() - (parseInt(olderThan) || 30) * 24 * 60 * 60 * 1000);

    const initialCount = securityViolations.length;
    const remainingViolations = securityViolations.filter(v => 
      new Date(v.timestamp) > cutoffDate
    );

    // Clear the array and repopulate with remaining violations
    securityViolations.length = 0;
    securityViolations.push(...remainingViolations);

    const clearedCount = initialCount - securityViolations.length;

    res.json({
      success: true,
      message: `Cleared ${clearedCount} security violations older than ${olderThan || 30} days`,
      clearedCount,
      remainingCount: securityViolations.length
    });

  } catch (error) {
    console.error('Error clearing security violations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear security violations'
    });
  }
});

module.exports = router;
