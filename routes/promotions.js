const express = require('express');
const router = express.Router();
const Promotion = require('../models/Promotion');
const { authenticateStudent } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// Validation middleware
const validatePromotion = [
  body('title')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters'),
  body('description')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Description must be between 1 and 1000 characters'),
  body('videoUrl')
    .optional()
    .isURL()
    .withMessage('Video URL must be a valid URL'),
  body('buttonText')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Button text must not exceed 50 characters'),
  body('buttonUrl')
    .optional()
    .isURL()
    .withMessage('Button URL must be a valid URL')
];

// GET /api/promotions/public - Get active promotions for landing page (public)
router.get('/public', async (req, res) => {
  try {
    const promotions = await Promotion.find({
      isActive: true,
      showOnLanding: true,
      isPopup: false
    })
    .sort({ displayOrder: 1, createdAt: -1 })
    .select('title description videoUrl buttonText buttonUrl')
    .limit(6); // Limit to 6 promotions for landing page

    res.json({
      success: true,
      promotions
    });
  } catch (error) {
    console.error('Error fetching public promotions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch promotions'
    });
  }
});

// GET /api/promotions/popup/:page - Get popup for specific page (public)
router.get('/popup/:page', async (req, res) => {
  try {
    const { page } = req.params;
    const now = new Date();

    const popup = await Promotion.findOne({
      isActive: true,
      isPopup: true,
      $or: [
        { popupPages: page },
        { popupPages: 'all' }
      ],
      $and: [
        {
          $or: [
            { popupStartDate: { $exists: false } },
            { popupStartDate: { $lte: now } }
          ]
        },
        {
          $or: [
            { popupEndDate: { $exists: false } },
            { popupEndDate: { $gte: now } }
          ]
        }
      ]
    })
    .sort({ displayOrder: 1, createdAt: -1 })
    .select('title description videoUrl buttonText buttonUrl popupFrequency');

    res.json({
      success: true,
      popup
    });
  } catch (error) {
    console.error('Error fetching popup:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch popup'
    });
  }
});

// GET /api/promotions - Get all promotions (admin only)
router.get('/', authenticateStudent, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.'
      });
    }

    const { page = 1, limit = 10, status = 'all' } = req.query;
    const skip = (page - 1) * limit;

    let filter = {};
    if (status === 'active') filter.isActive = true;
    if (status === 'inactive') filter.isActive = false;

    const promotions = await Promotion.find(filter)
      .populate('createdBy', 'name email')
      .sort({ displayOrder: 1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Promotion.countDocuments(filter);

    res.json({
      success: true,
      promotions,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Error fetching promotions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch promotions'
    });
  }
});

// POST /api/promotions - Create new promotion (admin only)
router.post('/', authenticateStudent, validatePromotion, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.'
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const promotionData = {
      ...req.body,
      createdBy: req.user.id
    };

    // Convert Google Drive share links to embed links
    if (promotionData.videoUrl && promotionData.videoUrl.includes('drive.google.com')) {
      const fileIdMatch = promotionData.videoUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (fileIdMatch) {
        const fileId = fileIdMatch[1];
        promotionData.videoUrl = `https://drive.google.com/file/d/${fileId}/preview`;
      }
    }

    const promotion = new Promotion(promotionData);
    await promotion.save();

    await promotion.populate('createdBy', 'name email');

    res.status(201).json({
      success: true,
      message: 'Promotion created successfully',
      promotion
    });
  } catch (error) {
    console.error('Error creating promotion:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create promotion'
    });
  }
});

// PUT /api/promotions/:id - Update promotion (admin only)
router.put('/:id', authenticateStudent, validatePromotion, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.'
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const updateData = { ...req.body };

    // Convert Google Drive share links to embed links
    if (updateData.videoUrl && updateData.videoUrl.includes('drive.google.com')) {
      const fileIdMatch = updateData.videoUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (fileIdMatch) {
        const fileId = fileIdMatch[1];
        updateData.videoUrl = `https://drive.google.com/file/d/${fileId}/preview`;
      }
    }

    const promotion = await Promotion.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email');

    if (!promotion) {
      return res.status(404).json({
        success: false,
        message: 'Promotion not found'
      });
    }

    res.json({
      success: true,
      message: 'Promotion updated successfully',
      promotion
    });
  } catch (error) {
    console.error('Error updating promotion:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update promotion'
    });
  }
});

// DELETE /api/promotions/:id - Delete promotion (admin only)
router.delete('/:id', authenticateStudent, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.'
      });
    }

    const { id } = req.params;
    const promotion = await Promotion.findByIdAndDelete(id);

    if (!promotion) {
      return res.status(404).json({
        success: false,
        message: 'Promotion not found'
      });
    }

    res.json({
      success: true,
      message: 'Promotion deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting promotion:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete promotion'
    });
  }
});

// PUT /api/promotions/:id/toggle - Toggle promotion status (admin only)
router.put('/:id/toggle', authenticateStudent, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.'
      });
    }

    const { id } = req.params;
    const promotion = await Promotion.findById(id);

    if (!promotion) {
      return res.status(404).json({
        success: false,
        message: 'Promotion not found'
      });
    }

    promotion.isActive = !promotion.isActive;
    await promotion.save();

    res.json({
      success: true,
      message: `Promotion ${promotion.isActive ? 'activated' : 'deactivated'} successfully`,
      promotion
    });
  } catch (error) {
    console.error('Error toggling promotion status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle promotion status'
    });
  }
});

module.exports = router;