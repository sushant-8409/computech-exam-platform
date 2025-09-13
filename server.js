const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

console.log('🔧 Server Environment Check:');
console.log('- NODE_ENV:', process.env.NODE_ENV || 'development');
console.log('- PORT:', process.env.PORT || 5000);
console.log('- Has SESSION_SECRET:', !!process.env.SESSION_SECRET);
console.log('- Has GOOGLE_OAUTH_CLIENT_ID:', !!process.env.GOOGLE_OAUTH_CLIENT_ID);

const app = express();

// schedule / cleanup
const cron = require('node-cron');
const { cleanupTmpDirectory } = require('./services/tmpCleanup');

// ================== Middleware ==================
// In your server.js, update CORS config
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://computech-exam-platform.onrender.com'] 
    : ['http://localhost:3000', 'http://localhost:5000'], // Add port 5000
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
  secret: process.env.SESSION_SECRET || 'your-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production', // true only for HTTPS in production
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));


// Conditional logging for development
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    // Prevents logging requests for static assets to keep the console clean
    if (!req.path.startsWith('/static') && !req.path.endsWith('.js') && !req.path.endsWith('.css')) {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
    }
    next();
  });
}

// ================== API Routes ==================
// NOTE: OAuth routes MUST come first to avoid conflicts with React fallback
// OAuth routes moved to auth.js
app.use('/api/auth', require('./routes/auth'));
app.use(require('./routes/googleAuth')); // Google OAuth routes - must come before React fallback
app.use('/api/student', require('./routes/student'));
app.use('/api/tests', require('./routes/tests'));
app.use('/api/coding-test', require('./routes/codingTest')); // Coding test routes
app.use('/api', require('./routes/analytics'));
app.use('/api/files', require('./routes/files'));
app.use('/api/student/mock-tests', require('./routes/mockTest'));
app.use('/api', require('./routes/security')); // Security violation tracking
app.use('/api/student/monitoring', require('./routes/monitoring')); // Camera monitoring
app.use('/api/student', require('./routes/traditionalTest')); // Traditional test interface
app.use(require('./routes/upload.routes')); // Upload routes for Google Drive

// Cronjob routes for automated tasks
app.use('/api/cronjob', require('./routes/cronjob')); // Cronjob endpoints

// Registering all admin routes sequentially as in the original file
app.use('/api/admin', require('./routes/admin'));
app.use('/api/admin', require('./routes/manualTestEntry')); // Manual test entry routes
app.use('/api/admin', require('./routes/googleSetup')); // Google setup helper
app.use('/api/admin', require('./routes/oauthAdmin')); // OAuth credentials management
app.use('/api/mobile-upload', require('./routes/mobileUpload')); // Mobile upload functionality
app.use('/api/admin', require('./routes/adminReviewResults')); // Restored this route
app.use('/api/admin', require('./routes/reviewRoutes'));    // Restored this route
app.use('/api/admin', require('./routes/adminReview')); 
// Add this line with your other app.use() statements
// Admin cleanup route (manual trigger for tmp cleanup)
app.use('/', require('./routes/adminCleanup'));



// ================== Serve React Frontend ==================
// Serve uploaded files from tmp directory
app.use('/tmp', express.static(path.join(__dirname, 'tmp'), {
  maxAge: '1h' // Cache uploaded files for 1 hour
}));

app.use(express.static(path.join(__dirname, 'frontend', 'build'), {
  maxAge: '1d' // Cache static files for 1 day
}));

// Fallback to the React app for any route not caught by the API
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'build', 'index.html'));
});

// ================== Global Error Handler ==================
app.use((error, req, res, next) => {
  console.error('🔥 Global Server Error:', error.message);
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'development' ? error.message : 'An internal server error occurred.'
  });
});

// ================== Server Startup ==================
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    const server = app.listen(PORT, () => {
      console.log(`🚀 Server running on PORT ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
    });

    // Schedule cleanup every 6 hours
    try {
      cron.schedule('0 */6 * * *', async () => {
        console.log('🧹 Running scheduled tmp cleanup...');
        const res = await cleanupTmpDirectory({ olderThanMs: 6 * 60 * 60 * 1000 }); // remove files older than 6 hours
        if (res.success) console.log('🧹 Tmp cleanup completed, removed:', res.removed.length);
        else console.warn('🧹 Tmp cleanup failed:', res.error);
      }, { scheduled: true });
      console.log('🗓️ Scheduled tmp cleanup every 6 hours');
    } catch (cronErr) {
      console.warn('⚠️ Cron scheduling unavailable:', cronErr.message);
    }

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('⏰ SIGTERM received, shutting down gracefully');
      server.close(() => {
        console.log('💤 Process terminated');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();
