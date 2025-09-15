// Generate required secrets for environment variables
const crypto = require('crypto');

console.log('🔐 Generated Secrets for Environment Variables:\n');

console.log('JWT_SECRET:');
console.log(crypto.randomBytes(64).toString('hex'));
console.log('');

console.log('SESSION_SECRET:');
console.log(crypto.randomBytes(64).toString('hex'));
console.log('');

console.log('Copy these values to your Render environment variables!');
console.log('Run: node generate-secrets.js');