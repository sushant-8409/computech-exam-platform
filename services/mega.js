// services/mega.js
const { Storage } = require('megajs');
require('dotenv').config();

let storageInstance = null;

async function getMegaStorage() {
  if (!storageInstance) {
    storageInstance = new Storage({
      email: process.env.MEGA_EMAIL,
      password: process.env.MEGA_PASSWORD
    });
    await storageInstance.ready;
  }
  return storageInstance;
}

async function uploadToMega(fileBuffer, fileName) {
  const storage = await getMegaStorage();
  const file = await storage.upload(fileName, fileBuffer).complete;
  return new Promise((resolve, reject) => {
    file.link((err, link) => {
      if (err) reject(err);
      resolve({
        url: link,
        fileId: file.nodeId
      });
    });
  });
}

module.exports = { uploadToMega };
