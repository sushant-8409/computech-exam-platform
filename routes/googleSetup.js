// Helper endpoint to set up Google OAuth for file uploads
const express = require('express');
const router = express.Router();
const { authenticateAdmin } = require('../middleware/auth');

// GET /api/admin/google-setup - Check Google OAuth status
router.get('/google-setup', authenticateAdmin, async (req, res) => {
    try {
        // Check if we have Google OAuth credentials
        const hasClientId = !!process.env.GOOGLE_OAUTH_CLIENT_ID;
        const hasClientSecret = !!process.env.GOOGLE_OAUTH_CLIENT_SECRET;
        const hasFolderId = !!process.env.GOOGLE_DRIVE_FOLDER_ID;
        
        res.json({
            success: true,
            googleSetup: {
                hasClientId,
                hasClientSecret,
                hasFolderId,
                configured: hasClientId && hasClientSecret && hasFolderId,
                message: hasClientId && hasClientSecret && hasFolderId 
                    ? 'Google Drive is configured and ready to use'
                    : 'Google Drive requires additional setup'
            }
        });
    } catch (error) {
        console.error('Error checking Google setup:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to check Google setup',
            error: error.message
        });
    }
});

module.exports = router;
