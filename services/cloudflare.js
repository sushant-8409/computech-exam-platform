const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
require('dotenv').config();

const s3 = new S3Client({
  region: 'ca-east-006',
  endpoint: process.env.B2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  },
  forcePathStyle: true
});

// Upload example
async function uploadFile(buffer, key, contentType) {
  const command = new PutObjectCommand({
    Bucket: process.env.B2_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType
  });
  await s3.send(command);
  console.log(`Uploaded ${key} successfully.`);
}

// Generate pre-signed URL example
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

async function generatePresignedUrl(key) {
  const command = new GetObjectCommand({
    Bucket: process.env.B2_BUCKET,
    Key: key
  });
  const url = await getSignedUrl(s3, command, { expiresIn: 3600 }); // 1 hour expiry
  return url;
}
