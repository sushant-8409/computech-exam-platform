const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
// server.js, after your other requires
const uploadRoutes = require('./routes/upload');
require('dotenv').config();

const app = express();
let adminRoutes = null;
// Middleware
app.use(cors({
  origin: ['https://computech-exam-platform.vercel.app', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/api/tests', require('./routes/tests'));
// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  next();
});

// Mount file‐upload endpoints
app.use('/api/upload', uploadRoutes);
console.log('📁 Upload routes registered at /api/upload');

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/admin', require('./routes/admin'));
// Load routes with detailed error handling
console.log('🔄 Loading routes...');
const adminReviewResults = require('./routes/adminReviewResults');
// mount under /api/admin
app.use('/api/admin', adminReviewResults);
// Test if files exist
const fs = require('fs');
const routeFiles = ['./routes/auth.js', './routes/admin.js', './routes/student.js'];

routeFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ Found: ${file}`);
  } else {
    console.log(`❌ Missing: ${file}`);
  }
});

// Import routes with individual error handling
let authRoutes, studentRoutes;

// Auth routes
try {
  authRoutes = require('./routes/auth');
  console.log('✅ Auth routes loaded successfully');
  console.log('📁 Auth routes type:', typeof authRoutes);
} catch (error) {
  console.error('❌ Failed to load auth routes:', error.message);
  console.error('Stack:', error.stack);
}

// Admin routes
try {
  console.log('🔄 Attempting to load admin routes...');
  adminRoutes = require('./routes/admin');
  console.log('✅ Admin routes loaded successfully');
  console.log('📁 Admin routes type:', typeof adminRoutes);
  console.log('📁 Admin routes properties:', Object.getOwnPropertyNames(adminRoutes));
} catch (error) {
  console.error('❌ Failed to load admin routes:', error.message);
  console.error('📍 Error stack:', error.stack);
}

// Student routes
try {
  studentRoutes = require('./routes/student');
  console.log('✅ Student routes loaded successfully');
  console.log('📁 Student routes type:', typeof studentRoutes);
} catch (error) {
  console.error('❌ Failed to load student routes:', error.message);
  console.error('Stack:', error.stack);
}

// Register routes with detailed logging
console.log('🔄 Registering routes...');

if (authRoutes) {
  app.use('/api/auth', authRoutes);
  console.log('🔐 Auth routes registered at /api/auth');
} else {
  console.error('❌ Cannot register auth routes - not loaded');
}

if (adminRoutes) {
  app.use('/api/admin', adminRoutes);
  console.log('👨‍💼 Admin routes registered at /api/admin');
  
  // Test admin routes immediately
  setTimeout(() => {
    console.log('🧪 Testing admin routes...');
    // You can add route testing here if needed
  }, 1000);
} else {
  console.error('❌ Cannot register admin routes - not loaded');
}

if (studentRoutes) {
  app.use('/api/student', studentRoutes);
  console.log('👨‍🎓 Student routes registered at /api/student');
} else {
  console.error('❌ Cannot register student routes - not loaded');
}

// Root route
app.get('/', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Computech Exam Platform API is running!',
    timestamp: new Date().toISOString(),
    routes: {
      auth: !!authRoutes,
      admin: !!adminRoutes,
      student: !!studentRoutes
    }
  });
});

// Test route to verify admin endpoints
app.get('/api/test-admin', (req, res) => {
  res.json({
    success: true,
    message: 'Admin test route working',
    adminRoutesLoaded: !!adminRoutes
  });
});

// Global health check
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Server is healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    routes: {
      auth: !!authRoutes,
      admin: !!adminRoutes,
      student: !!studentRoutes
    }
  });
});
app.use(express.static(path.join(__dirname, 'frontend', 'build')));

// Handle React routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'build', 'index.html'));
});

// Connect to MongoDB
const mongoURI = process.env.MONGODB_URI;

mongoose.connect(mongoURI)
.then(() => {
  console.log('✅ Connected to MongoDB successfully');
})
.catch((error) => {
  console.error('❌ MongoDB connection error:', error.message);
  // Don't exit - continue without database for debugging
});
// Add after MongoDB connection
mongoose.connection.on('connected', () => {
  console.log('✅ Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️ Mongoose disconnected');
});
adminRoutes= require('./routes/admin');
// Test database with a simple query
setTimeout(async () => {
  try {
    const Student = require('./models/Student');
    const count = await Student.countDocuments();
    console.log(`📊 Database test: Found ${count} students`);
  } catch (error) {
    console.error('❌ Database test failed:', error.message);
  }
}, 2000);

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('🔥 Global error handler:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});
// 404 handler - must be last
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

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log('\n🚀========================================🚀');
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Frontend URL: http://localhost:3000`);
  console.log(`🔧 Backend URL: http://localhost:${PORT}`);
  console.log(`📊 Health Check: http://localhost:${PORT}/api/health`);
  if (adminRoutes) {
    console.log(`👨‍💼 Admin Health: http://localhost:${PORT}/api/admin/health`);
  }
  console.log('🚀========================================🚀\n');
});

module.exports = app;
