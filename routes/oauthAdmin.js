const express = require('express');
const router = express.Router();
const OAuthCredentials = require('../models/OAuthCredentials');
const { authenticateAdmin } = require('../middleware/auth');

/**
 * GET /api/admin/oauth-credentials
 * Get current OAuth credentials (excluding sensitive data for display)
 */
router.get('/oauth-credentials', authenticateAdmin, async (req, res) => {
  try {
    const credentials = await OAuthCredentials.findOne({ provider: 'google', isActive: true })
      .populate('updatedBy', 'name email')
      .lean();

    if (!credentials) {
      return res.json({
        success: true,
        credentials: null,
        message: 'No OAuth credentials configured'
      });
    }

    // Return credentials without sensitive data
    const safeCredentials = {
      _id: credentials._id,
      provider: credentials.provider,
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret ? '••••••••••••••••' : '',
      redirectUri: credentials.redirectUri,
      scopes: credentials.scopes,
      isActive: credentials.isActive,
      isValid: credentials.isValid,
      lastValidated: credentials.lastValidated,
      validationError: credentials.validationError,
      lastUpdated: credentials.lastUpdated,
      updatedBy: credentials.updatedBy,
      createdAt: credentials.createdAt,
      updatedAt: credentials.updatedAt
    };

    res.json({
      success: true,
      credentials: safeCredentials
    });

  } catch (error) {
    console.error('Error fetching OAuth credentials:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch OAuth credentials'
    });
  }
});

/**
 * POST /api/admin/oauth-credentials
 * Create or update OAuth credentials
 */
router.post('/oauth-credentials', authenticateAdmin, async (req, res) => {
  try {
    const { clientId, clientSecret, redirectUri, scopes } = req.body;

    // Validation
    if (!clientId || !clientSecret || !redirectUri) {
      return res.status(400).json({
        success: false,
        message: 'Client ID, Client Secret, and Redirect URI are required'
      });
    }

    // Validate redirect URI format
    const urlPattern = /^https?:\/\/.+/;
    if (!urlPattern.test(redirectUri)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid redirect URI format'
      });
    }

    // Deactivate existing credentials
    await OAuthCredentials.updateMany(
      { provider: 'google', isActive: true },
      { isActive: false }
    );

    // Create new credentials
    const newCredentials = new OAuthCredentials({
      provider: 'google',
      clientId: clientId.trim(),
      clientSecret: clientSecret.trim(),
      redirectUri: redirectUri.trim(),
      scopes: scopes || [
        'profile',
        'email',
        'https://www.googleapis.com/auth/drive.file'
      ],
      updatedBy: req.admin._id,
      isActive: true
    });

    // Validate credentials
    const isValid = await newCredentials.validateCredentials();
    
    await newCredentials.save();

    console.log('🔑 OAuth credentials updated by admin:', {
      adminId: req.admin._id,
      adminEmail: req.admin.email,
      clientId: clientId.substring(0, 10) + '...',
      isValid
    });

    // Return safe response
    res.json({
      success: true,
      message: 'OAuth credentials updated successfully',
      credentials: {
        _id: newCredentials._id,
        provider: newCredentials.provider,
        clientId: newCredentials.clientId,
        clientSecret: '••••••••••••••••',
        redirectUri: newCredentials.redirectUri,
        scopes: newCredentials.scopes,
        isValid: newCredentials.isValid,
        validationError: newCredentials.validationError,
        lastUpdated: newCredentials.lastUpdated
      }
    });

  } catch (error) {
    console.error('Error updating OAuth credentials:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update OAuth credentials'
    });
  }
});

/**
 * POST /api/admin/oauth-credentials/validate
 * Validate current OAuth credentials
 */
router.post('/oauth-credentials/validate', authenticateAdmin, async (req, res) => {
  try {
    const credentials = await OAuthCredentials.findOne({ 
      provider: 'google', 
      isActive: true 
    });

    if (!credentials) {
      return res.status(404).json({
        success: false,
        message: 'No active OAuth credentials found'
      });
    }

    const isValid = await credentials.validateCredentials();

    res.json({
      success: true,
      isValid,
      validationError: credentials.validationError,
      lastValidated: credentials.lastValidated,
      message: isValid ? 'Credentials are valid' : 'Credentials validation failed'
    });

  } catch (error) {
    console.error('Error validating OAuth credentials:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate OAuth credentials'
    });
  }
});

/**
 * DELETE /api/admin/oauth-credentials/:id
 * Delete OAuth credentials
 */
router.delete('/oauth-credentials/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const credentials = await OAuthCredentials.findById(id);
    if (!credentials) {
      return res.status(404).json({
        success: false,
        message: 'OAuth credentials not found'
      });
    }

    await OAuthCredentials.findByIdAndDelete(id);

    console.log('🗑️ OAuth credentials deleted by admin:', {
      adminId: req.admin._id,
      adminEmail: req.admin.email,
      credentialsId: id
    });

    res.json({
      success: true,
      message: 'OAuth credentials deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting OAuth credentials:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete OAuth credentials'
    });
  }
});

/**
 * GET /api/admin/oauth-credentials/current-env
 * Get current environment OAuth configuration (for comparison)
 */
router.get('/oauth-credentials/current-env', authenticateAdmin, async (req, res) => {
  try {
    const envConfig = {
      hasClientId: !!process.env.GOOGLE_OAUTH_CLIENT_ID,
      hasClientSecret: !!process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      redirectUri: process.env.GOOGLE_OAUTH_REDIRECT_URI || 'Not set',
      clientIdPreview: process.env.GOOGLE_OAUTH_CLIENT_ID ? 
        process.env.GOOGLE_OAUTH_CLIENT_ID.substring(0, 10) + '...' : 'Not set'
    };

    res.json({
      success: true,
      envConfig
    });

  } catch (error) {
    console.error('Error fetching environment OAuth config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch environment configuration'
    });
  }
});

module.exports = router;