const express = require('express');
const multer = require('multer');
const { uploadToGDrive } = require('../services/oauthDrive');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/api/upload', upload.single('file'), async (req, res) => {
  const tokens = req.session.tokens;

  if (!tokens) {
    return res.status(401).json({ message: 'Not logged in with Google' });
  }

  try {
    const result = await uploadToGDrive(
      tokens,
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );
    res.json(result);
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

module.exports = router;
