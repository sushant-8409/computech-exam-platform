// services/cloudflare.js
require('dotenv').config();
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// 1) Instantiate client (no await here)
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:    process.env.CLOUDFLARE_ACCESS_KEY,
    secretAccessKey: process.env.CLOUDFLARE_SECRET_KEY
  },
  contentDisposition: 'inline',
  contentEncoding: 'base64',
  forcePathStyle:   true,
  signatureVersion: 'v4'
});

// 2) Async function: generate signed URL
async function generateSignedUrl(fileName, expiresIn = 3600) {
  const command = new GetObjectCommand({
    Bucket: process.env.CLOUDFLARE_BUCKET_NAME,
    Key:    fileName
  });
  // await is inside an async function — this is valid
  return await getSignedUrl(s3Client, command, { expiresIn });
}

// 3) Async function: upload buffer, then get a signed URL
async function uploadToCloudflare(fileBuffer, fileName, contentType) {
  const put = new PutObjectCommand({
    Bucket: process.env.CLOUDFLARE_BUCKET_NAME,
    Key:    fileName,
    Body:   fileBuffer,
    ContentType: contentType,
    Metadata: {
      uploadedAt: new Date().toISOString(),
      originalName: fileName.split('/').pop()
    }
  });

  // await is inside this async function
  const result = await s3Client.send(put);

  // also inside the async function
  const signedUrl = await generateSignedUrl(fileName, 24 * 60 * 60);

  return {
    success: true,
    url:     signedUrl,
    key:     fileName,
    etag:    result.ETag
  };
}

// 4) Export only the async functions
module.exports = {
  uploadToCloudflare,
  generateSignedUrl
};
