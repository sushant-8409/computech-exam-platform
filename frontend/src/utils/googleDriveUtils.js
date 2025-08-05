// Utility functions for Google Drive URL handling

/**
 * Converts Google Drive URLs to embeddable format for iframes
 * Handles different Google Drive URL formats and converts them to public embed URLs
 */
export const convertToEmbedUrl = (url) => {
  if (!url) return url;

  // Handle different Google Drive URL formats
  let fileId = null;

  // Extract file ID from various Google Drive URL formats
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9-_]+)/,           // /file/d/FILE_ID
    /id=([a-zA-Z0-9-_]+)/,                   // id=FILE_ID
    /\/d\/([a-zA-Z0-9-_]+)/,                 // /d/FILE_ID
    /drive\.google\.com\/.*\/([a-zA-Z0-9-_]+)/ // General fallback
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      fileId = match[1];
      break;
    }
  }

  if (!fileId) {
    console.warn('Could not extract Google Drive file ID from URL:', url);
    return url; // Return original URL if we can't parse it
  }

  // Return the embeddable URL format
  return `https://drive.google.com/file/d/${fileId}/preview`;
};

/**
 * Adds additional parameters to Google Drive embed URLs to improve viewing experience
 */
export const enhanceEmbedUrl = (url) => {
  if (!url) return url;
  
  const embedUrl = convertToEmbedUrl(url);
  
  // Add parameters to improve viewing experience
  const urlObj = new URL(embedUrl);
  
  // Enable scrolling and remove unnecessary UI elements for better viewing
  urlObj.hash = 'toolbar=0&navpanes=0&scrollbar=1';
  
  return urlObj.toString();
};

/**
 * Creates a direct download URL from a Google Drive URL
 */
export const createDownloadUrl = (url) => {
  if (!url) return url;

  // Extract file ID
  let fileId = null;
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9-_]+)/,
    /id=([a-zA-Z0-9-_]+)/,
    /\/d\/([a-zA-Z0-9-_]+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      fileId = match[1];
      break;
    }
  }

  if (!fileId) {
    return url;
  }

  return `https://drive.google.com/uc?export=download&id=${fileId}`;
};

/**
 * Checks if a URL is a Google Drive URL
 */
export const isGoogleDriveUrl = (url) => {
  if (!url) return false;
  return url.includes('drive.google.com') || url.includes('docs.google.com');
};
