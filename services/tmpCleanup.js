const fs = require('fs').promises;
const path = require('path');

async function cleanupTmpDirectory(options = {}) {
  const tmpDir = path.join(__dirname, '..', 'tmp');
  const { olderThanMs = 24 * 60 * 60 * 1000, dryRun = false } = options; // default 24 hours
  const now = Date.now();
  const removed = [];

  try {
    const files = await fs.readdir(tmpDir);
    for (const file of files) {
      const filePath = path.join(tmpDir, file);
      try {
        const stat = await fs.stat(filePath);
        // handle directories recursively
        if (stat.isDirectory()) {
          // skip monitoring folder cleanup in this simple pass (could be recursive)
          // but still attempt to remove old files inside
          const subFiles = await fs.readdir(filePath);
          for (const sub of subFiles) {
            const subPath = path.join(filePath, sub);
            const subStat = await fs.stat(subPath);
            if ((now - subStat.mtimeMs) > olderThanMs) {
              if (!dryRun) await fs.unlink(subPath);
              removed.push(subPath);
            }
          }
        } else {
          if ((now - stat.mtimeMs) > olderThanMs) {
            if (!dryRun) await fs.unlink(filePath);
            removed.push(filePath);
          }
        }
      } catch (err) {
        // ignore individual file errors
        console.warn('tmpCleanup: file error', filePath, err.message);
      }
    }
    return { success: true, removed };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = { cleanupTmpDirectory };
