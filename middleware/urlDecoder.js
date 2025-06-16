module.exports = (req, res, next) => {
  try {
    req.originalDecodedUrl = decodeURIComponent(req.url);
  } catch (e) {
    console.warn('URL decoding failed:', e);
  }
  next();
};
