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
 * Enhanced for mobile device support
 */
export const enhanceEmbedUrl = (url) => {
  if (!url) return url;
  
  const embedUrl = convertToEmbedUrl(url);
  
  // Check if device is mobile
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  // Add parameters to improve viewing experience
  const urlObj = new URL(embedUrl);
  
  if (isMobile) {
    // Mobile-optimized parameters
    urlObj.searchParams.set('embedded', 'true');
    urlObj.searchParams.set('chrome', 'false');
    urlObj.searchParams.set('dov', '1'); // Document overview
    urlObj.searchParams.set('rm', 'minimal'); // Reduce UI elements
  } else {
    // Desktop parameters
    urlObj.hash = 'toolbar=0&navpanes=0&scrollbar=1';
  }
  
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

/**
 * Detects if the current device is mobile
 */
export const isMobileDevice = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

/**
 * Creates alternative viewing options for mobile devices when iframe is blocked
 */
export const getMobileAlternatives = (url) => {
  if (!url) return [];
  
  const alternatives = [];
  
  // Direct Google Drive view
  alternatives.push({
    label: 'Open in Google Drive',
    url: url,
    description: 'View in Google Drive app or browser'
  });
  
  // Try to create a direct download link
  if (isGoogleDriveUrl(url)) {
    const downloadUrl = createDownloadUrl(url);
    if (downloadUrl !== url) {
      alternatives.push({
        label: 'Download PDF',
        url: downloadUrl,
        description: 'Download to view offline'
      });
    }
  }
  
  return alternatives;
};
