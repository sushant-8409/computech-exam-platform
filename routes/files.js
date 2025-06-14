const path = require('path');

router.get('/signed-url/:url', async (req, res) => {
  try {
    // Extract key from URL (e.g., "question-papers/123.pdf" from full URL)
    const fullUrl = decodeURIComponent(req.params.url);
    const urlObj = new URL(fullUrl);
    const key = path.relative(`/${process.env.CLOUDFLARE_BUCKET_NAME}`, urlObj.pathname);

    const url = await generateSignedUrl(key, 3600);
    res.json({ success: true, url });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to generate URL' });
  }
});
// routes/files.js
router.get('/:type/:key', async (req, res) => {
  try {
    const validTypes = ['questionpaper', 'answersheet', 'answerkey'];
    if (!validTypes.includes(req.params.type)) {
      return res.status(400).json({ success: false, message: 'Invalid file type' });
    }

    const fullKey = `${req.params.type}/${req.params.key}`;
    const url = await generateSignedUrl(fullKey, 3600); // 1 hour
    
    res.json({ success: true, url });
  } catch (error) {
    res.status(500).json({ success: false, message: 'File retrieval failed' });
  }
});
