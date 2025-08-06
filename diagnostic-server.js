// Simple server starter with logging
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

console.log('🚀 Starting diagnostic server...');

const app = express();

// Basic middleware
app.use(cors());
app.use(express.json());

// Simple auth middleware for testing
const authenticateAdmin = (req, res, next) => {
  console.log('🔐 Auth middleware - allowing request for testing');
  next();
};

// Add the manual test routes
try {
  const manualTestRoutes = require('./routes/manualTestEntry');
  app.use('/api/admin/manual-test', manualTestRoutes);
  console.log('✅ Manual test routes loaded');
} catch (error) {
  console.error('❌ Error loading manual test routes:', error.message);
}

// Test endpoint
app.get('/test', (req, res) => {
  res.json({ message: 'Server is working!', timestamp: new Date() });
});

const PORT = 8080;

const startServer = async () => {
  try {
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    app.listen(PORT, () => {
      console.log(`🌟 Diagnostic server running on port ${PORT}`);
      console.log(`🔗 Test URL: http://localhost:${PORT}/test`);
      console.log(`🔍 Search URL: http://localhost:${PORT}/api/admin/manual-test/search-students?query=test`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
  }
};

startServer();
