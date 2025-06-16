const express = require('express');
const multer = require('multer');
const { uploadToGDrive } = require('../services/gdrive');
const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const result = await uploadToGDrive(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    res.json({
      success: true,
      url: result.url,      // Google Drive preview link
      fileId: result.fileId
    });
  } catch (err) {
    console.error('GDrive upload error:', err);
    res.status(500).json({ success: false, message: err.message || 'Upload failed' });
  }
});

module.exports = router;
