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
app.use(require('./routes/auth.routes')); // This handles /auth/google and /auth/google/callback
app.use('/api/auth', require('./routes/auth'));
app.use('/api/student', require('./routes/student'));
app.use('/api/tests', require('./routes/tests'));
app.use('/api', require('./routes/analytics'));
app.use('/api/files', require('./routes/files'));
app.use('/api/student/mock-tests', require('./routes/mockTest'));
app.use('/api', require('./routes/security')); // Security violation tracking
// app.use(require('./routes/upload.routes')); // Temporarily commented out to debug
// Registering all admin routes sequentially as in the original file
app.use('/api/admin', require('./routes/admin'));
app.use('/api/admin', require('./routes/adminReviewResults')); // Restored this route
app.use('/api/admin', require('./routes/reviewRoutes'));    // Restored this route
app.use('/api/admin', require('./routes/adminReview')); 
// Add this line with your other app.use() statements



// ================== Serve React Frontend ==================
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
