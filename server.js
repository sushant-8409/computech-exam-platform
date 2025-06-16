const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();

// ================== Middleware ==================
app.use(cors({
  origin: ['http://localhost:3000', 'https://computech-exam-platform.onrender.com'], // Add protocol
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));


app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  next();
});
app.use(require('./middleware/urlDecoder'));

// ================== API Routes ==================
app.use('/api/tests', require('./routes/tests'));
app.use('/api/admin', require('./routes/admin'));
const adminReviewResults = require('./routes/adminReviewResults');
app.use('/api/admin', adminReviewResults);
app.use('/api/files', require('./routes/files'));
// In Express middleware
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', "frame-src 'self' mega.nz");
  next();
});

// Load auth and student routes
let authRoutes, studentRoutes;
try {
  authRoutes = require('./routes/auth');
  console.log('✅ Auth routes loaded successfully');
} catch (error) {
  console.error('❌ Failed to load auth routes:', error.message);
}

try {
  studentRoutes = require('./routes/student');
  console.log('✅ Student routes loaded successfully');
} catch (error) {
  console.error('❌ Failed to load student routes:', error.message);
}

// Register auth and student routes
if (authRoutes) {
  app.use('/api/auth', authRoutes);
  console.log('🔐 Auth routes registered at /api/auth');
} else {
  console.error('❌ Cannot register auth routes - not loaded');
}

if (studentRoutes) {
  app.use('/api/student', studentRoutes);
  console.log('👨🎓 Student routes registered at /api/student');
} else {
  console.error('❌ Cannot register student routes - not loaded');
}

// ================== Serve React Build ==================
app.use(express.static(path.join(__dirname, 'frontend', 'build')));

// React client-side routing (GET only)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'build', 'index.html'));
});

// ================== Error Handling ==================
// 404 handler (must be after all routes)
app.use('*', (req, res) => {
  console.log('❌ 404 - Route not found:', req.originalUrl);
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
    availableRoutes: [
      'GET /api/health',
      'GET /api/test-admin',
      authRoutes ? 'POST /api/auth/login' : 'AUTH ROUTES NOT LOADED',
      adminRoutes ? 'GET /api/admin/health' : 'ADMIN ROUTES NOT LOADED',
      studentRoutes ? 'GET /api/student/dashboard' : 'STUDENT ROUTES NOT LOADED'
    ]
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('🔥 Global error handler:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// ================== MongoDB & Server Start ==================
const mongoURI = process.env.MONGODB_URI;
mongoose.connect(mongoURI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log(`🔧 Backend URL: http://localhost:${PORT}\n`);
});

module.exports = app;
