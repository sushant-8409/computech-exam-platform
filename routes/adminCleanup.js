const express = require('express');
const router = express.Router();
const { cleanupTmpDirectory } = require('../services/tmpCleanup');
const { authenticateAdmin } = require('../middleware/auth');

// Manual cleanup endpoint for admins
router.post('/admin/cleanup-tmp', authenticateAdmin, async (req, res) => {
  try {
    const olderThanHours = parseInt(req.body.olderThanHours || '24', 10);
    const dryRun = req.body.dryRun === 'true' || req.body.dryRun === true;
    const result = await cleanupTmpDirectory({ olderThanMs: olderThanHours * 60 * 60 * 1000, dryRun });
    if (!result.success) return res.status(500).json({ success: false, error: result.error });
    res.json({ success: true, removed: result.removed });
  } catch (error) {
    console.error('Admin cleanup error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
