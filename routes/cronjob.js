const express = require('express');
const router = express.Router();
const Result = require('../models/Result');
const Test = require('../models/Test');
const Student = require('../models/Student');

// Middleware to verify cronjob requests (basic security)
const verifyCronjobRequest = (req, res, next) => {
  const cronSecret = process.env.CRON_SECRET || 'default-cron-secret-change-in-production';
  const providedSecret = req.headers['x-cron-secret'] || req.query.secret;
  
  if (providedSecret !== cronSecret) {
    return res.status(401).json({ 
      success: false, 
      message: 'Unauthorized cronjob request' 
    });
  }
  
  next();
};

// Health check endpoint for cronjobs
router.get('/health', verifyCronjobRequest, (req, res) => {
  res.json({
    success: true,
    message: 'Cronjob endpoint is healthy',
    timestamp: new Date().toISOString(),
    server: 'computech-exam-platform'
  });
});

// Cleanup expired test sessions
router.post('/cleanup-expired-sessions', verifyCronjobRequest, async (req, res) => {
  try {
    const now = new Date();
    const expiredThreshold = new Date(now - (24 * 60 * 60 * 1000)); // 24 hours ago
    
    // Find and update expired test results
    const expiredResults = await Result.updateMany(
      {
        status: 'in-progress',
        createdAt: { $lt: expiredThreshold }
      },
      {
        $set: {
          status: 'abandoned',
          endTime: now,
          updatedAt: now
        }
      }
    );

    res.json({
      success: true,
      message: 'Expired sessions cleaned up successfully',
      modifiedCount: expiredResults.modifiedCount,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error cleaning up expired sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Error cleaning up expired sessions',
      error: error.message
    });
  }
});

// Generate analytics summary
router.post('/generate-analytics', verifyCronjobRequest, async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    // Get daily statistics
    const dailyStats = await Promise.all([
      // Total tests taken today
      Result.countDocuments({
        createdAt: { $gte: startOfDay, $lte: endOfDay }
      }),
      
      // Completed tests today
      Result.countDocuments({
        status: 'submitted',
        createdAt: { $gte: startOfDay, $lte: endOfDay }
      }),
      
      // Active students today
      Result.distinct('studentId', {
        createdAt: { $gte: startOfDay, $lte: endOfDay }
      }),
      
      // Tests with violations today
      Result.countDocuments({
        'violations.0': { $exists: true },
        createdAt: { $gte: startOfDay, $lte: endOfDay }
      })
    ]);

    const [totalTests, completedTests, activeStudentIds, testsWithViolations] = dailyStats;

    const analytics = {
      date: startOfDay.toISOString().split('T')[0],
      totalTests,
      completedTests,
      activeStudents: activeStudentIds.length,
      testsWithViolations,
      completionRate: totalTests > 0 ? ((completedTests / totalTests) * 100).toFixed(2) : 0,
      violationRate: totalTests > 0 ? ((testsWithViolations / totalTests) * 100).toFixed(2) : 0
    };

    res.json({
      success: true,
      message: 'Analytics generated successfully',
      analytics,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error generating analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating analytics',
      error: error.message
    });
  }
});

// Monitoring data cleanup (remove old monitoring images)
router.post('/cleanup-monitoring-data', verifyCronjobRequest, async (req, res) => {
  try {
    const retentionDays = parseInt(req.query.retentionDays) || 30;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    // Find results with monitoring images older than retention period
    const oldResults = await Result.find({
      'monitoringImages.0': { $exists: true },
      createdAt: { $lt: cutoffDate }
    });

    let totalImagesRemoved = 0;
    
    for (const result of oldResults) {
      const imageCount = result.monitoringImages ? result.monitoringImages.length : 0;
      totalImagesRemoved += imageCount;
      
      // Clear monitoring images array
      await Result.updateOne(
        { _id: result._id },
        { $set: { monitoringImages: [] } }
      );
    }

    res.json({
      success: true,
      message: 'Monitoring data cleaned up successfully',
      resultsProcessed: oldResults.length,
      imagesRemoved: totalImagesRemoved,
      retentionDays,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error cleaning up monitoring data:', error);
    res.status(500).json({
      success: false,
      message: 'Error cleaning up monitoring data',
      error: error.message
    });
  }
});

// Database maintenance tasks
router.post('/database-maintenance', verifyCronjobRequest, async (req, res) => {
  try {
    const tasks = [];
    
    // Remove orphaned results (results without corresponding test)
    const orphanedResults = await Result.aggregate([
      {
        $lookup: {
          from: 'tests',
          localField: 'testId',
          foreignField: '_id',
          as: 'test'
        }
      },
      {
        $match: {
          test: { $size: 0 }
        }
      }
    ]);
    
    if (orphanedResults.length > 0) {
      const orphanedIds = orphanedResults.map(r => r._id);
      await Result.deleteMany({ _id: { $in: orphanedIds } });
      tasks.push(`Removed ${orphanedResults.length} orphaned results`);
    }
    
    // Update result statistics
    const statsUpdate = await Result.updateMany(
      { totalQuestions: { $exists: false } },
      [
        {
          $set: {
            totalQuestions: { $size: { $ifNull: ['$answers', []] } },
            updatedAt: new Date()
          }
        }
      ]
    );
    
    if (statsUpdate.modifiedCount > 0) {
      tasks.push(`Updated statistics for ${statsUpdate.modifiedCount} results`);
    }

    res.json({
      success: true,
      message: 'Database maintenance completed successfully',
      tasks,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error during database maintenance:', error);
    res.status(500).json({
      success: false,
      message: 'Error during database maintenance',
      error: error.message
    });
  }
});

// Get system status for monitoring
router.get('/system-status', verifyCronjobRequest, async (req, res) => {
  try {
    const stats = await Promise.all([
      Result.countDocuments(),
      Test.countDocuments(),
      Student.countDocuments(),
      Result.countDocuments({ status: 'in-progress' }),
      Result.countDocuments({ 
        createdAt: { 
          $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) 
        } 
      })
    ]);

    const [totalResults, totalTests, totalStudents, activeTests, testsLast24h] = stats;

    const systemStatus = {
      database: {
        totalResults,
        totalTests,
        totalStudents,
        activeTests,
        testsLast24h
      },
      server: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        nodeVersion: process.version,
        platform: process.platform
      },
      timestamp: new Date().toISOString()
    };

    res.json({
      success: true,
      systemStatus
    });
    
  } catch (error) {
    console.error('Error getting system status:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting system status',
      error: error.message
    });
  }
});

module.exports = router;
