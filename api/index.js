const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

// Environment check
console.log('🔧 Vercel API Environment Check:');
console.log('- NODE_ENV:', process.env.NODE_ENV || 'production');
console.log('- Has SESSION_SECRET:', !!process.env.SESSION_SECRET);
console.log('- Has GOOGLE_OAUTH_CLIENT_ID:', !!process.env.GOOGLE_OAUTH_CLIENT_ID);

const app = express();

// ================== Middleware ==================
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? [
        'https://computech-exam-platform.vercel.app',
        'https://computechexamplatform.netlify.app' // Keep as fallback
      ]
    : ['http://localhost:3000', 'http://localhost:5000'],
  methods: 'GET,POST,PUT,DELETE,PATCH',
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Set Content-Security-Policy for iframes with mobile support
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', 
    "frame-src 'self' drive.google.com docs.google.com *.google.com *.googleapis.com; " +
    "frame-ancestors 'self'; " +
    "object-src 'none';"
  );
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'no-referrer-when-downgrade');
  next();
});

const session = require('express-session');
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// MongoDB connection with connection pooling for serverless
let cachedConnection = null;

async function connectToMongoDB() {
  if (cachedConnection) {
    return cachedConnection;
  }

  try {
    const connection = await mongoose.connect(process.env.MONGODB_URI, {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    
    cachedConnection = connection;
    console.log('✅ Connected to MongoDB (cached)');
    return connection;
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    throw error;
  }
}

// ================== API Routes ==================
// Import routes (these will be converted to individual serverless functions)
app.use('/auth', require('../routes/auth'));
app.use('/student', require('../routes/student'));
app.use('/tests', require('../routes/tests'));
app.use('/coding-test', require('../routes/codingTest'));
app.use('/', require('../routes/analytics'));
app.use('/files', require('../routes/files'));
app.use('/student/mock-tests', require('../routes/mockTest'));
app.use('/', require('../routes/security'));
app.use('/student/monitoring', require('../routes/monitoring'));
app.use('/student', require('../routes/traditionalTest'));
app.use('/', require('../routes/upload.routes'));
app.use('/cronjob', require('../routes/cronjob'));
app.use('/admin', require('../routes/admin'));
app.use('/admin', require('../routes/manualTestEntry'));
app.use('/admin', require('../routes/googleSetup'));
app.use('/admin', require('../routes/oauthAdmin'));
app.use('/mobile-upload', require('../routes/mobileUpload'));
app.use('/admin', require('../routes/adminReviewResults'));
app.use('/admin', require('../routes/reviewRoutes'));
app.use('/admin', require('../routes/adminReview'));
app.use('/', require('../routes/adminCleanup'));

// Google OAuth routes (special handling)
app.use('/', require('../routes/googleAuth'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handler
app.use((error, req, res, next) => {
  console.error('🔥 API Error:', error.message);
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
  });
});

// Main handler for Vercel
module.exports = async (req, res) => {
  try {
    // Connect to MongoDB on each request (serverless requirement)
    await connectToMongoDB();
    
    // Handle the request with Express
    return app(req, res);
  } catch (error) {
    console.error('❌ Serverless function error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Database connection failed'
    });
  }
};