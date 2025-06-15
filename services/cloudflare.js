const { NodeHttpHandler } = require('@smithy/node-http-handler');
const https = require('https');
const dns = require('dns');
require('dotenv').config();

const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// Configure DNS cache to prevent repeated lookups
dns.setDefaultResultOrder('ipv4first'); // Prefer IPv4 over IPv6

// 1) Enhanced S3 client configuration
const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY,
    secretAccessKey: process.env.CLOUDFLARE_SECRET_KEY
  },
  forcePathStyle: true,
  tls: true,
  requestHandler: new NodeHttpHandler({
    httpsAgent: new https.Agent({
      family: 4, // Force IPv4
      keepAlive: true,
      timeout: 5000, // 5-second timeout
      maxSockets: 50 // Handle concurrent requests
    })
  }),
  maxAttempts: 5, // Increased retry attempts
  retryMode: 'standard'
});

// 2) Add DNS verification before operations
async function verifyDNS() {
  return new Promise((resolve, reject) => {
    dns.lookup(`${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`, 
      (err, address) => {
        if (err) {
          console.error('DNS resolution failed:', err);
          reject(new Error(`DNS lookup failed: ${err.message}`));
        } else {
          console.log(`DNS resolved to: ${address}`);
          resolve();
        }
      }
    );
  });
}

// 3) Modified upload function with pre-flight checks
async function uploadToCloudflare(fileBuffer, fileName, contentType) {
  try {
    await verifyDNS();
    
    const putCommand = new PutObjectCommand({
      Bucket: process.env.CLOUDFLARE_BUCKET_NAME,
      Key: fileName,
      Body: fileBuffer,
      ContentType: contentType,
      Metadata: {
        uploadedAt: new Date().toISOString(),
        originalName: fileName.split('/').pop()
      }
    });

    const uploadResult = await s3Client.send(putCommand);
    
    if (!uploadResult.ETag) {
      throw new Error('Upload failed: No ETag received');
    }

    return {
      success: true,
      url: await generateSignedUrl(fileName),
      key: fileName,
      etag: uploadResult.ETag
    };
  } catch (error) {
    console.error('Upload failed:', error);
    throw new Error(`Upload failed: ${error.message}`);
  }
}

// 4) Enhanced signed URL generator
async function generateSignedUrl(fileName, expiresIn = 3600) {
  try {
    const command = new GetObjectCommand({
      Bucket: process.env.CLOUDFLARE_BUCKET_NAME,
      Key: fileName,
      ResponseContentDisposition: 'inline',
      ResponseContentType: fileName.endsWith('.pdf') ? 
        'application/pdf' : 'application/octet-stream'
    });

    return await getSignedUrl(s3Client, command, { 
      expiresIn,
      signableHeaders: new Set(['host']) // Required for R2
    });
  } catch (error) {
    console.error('URL generation failed:', error);
    throw new Error(`URL generation failed: ${error.message}`);
  }
}

module.exports = {
  uploadToCloudflare,
  generateSignedUrl,
  verifyDNS // Export for pre-flight checks
};
