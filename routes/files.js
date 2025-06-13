// routes/files.js
const express = require('express');
const { generateSignedUrl } = require('../services/cloudflare');
const router = express.Router();

router.get('/signed-url/:key', async (req, res) => {
  try {
    const url = await generateSignedUrl(req.params.key, 3600); // 1-hour validity
    res.json({ success: true, url });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to generate URL' });
  }
});

module.exports = router;
