const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// ================== Middleware ==================
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://computech-exam-platform.onrender.com'] 
    : ['http://localhost:3000'],
  methods: 'GET,POST,PUT,DELETE',
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Set Content-Security-Policy for iframes
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', "frame-src 'self' drive.google.com docs.google.com");
  next();
});


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
// NOTE: All routes from your previous file are now registered here.
app.use('/api/auth', require('./routes/auth'));
app.use('/api/student', require('./routes/student'));
app.use('/api/tests', require('./routes/tests'));
app.use('/api', require('./routes/analytics'));
app.use('/api/files', require('./routes/files'));
app.use('/api/student/mock-tests', require('./routes/mockTest'));

// Registering all admin routes sequentially as in the original file
app.use('/api/admin', require('./routes/admin'));
app.use('/api/admin', require('./routes/adminReviewResults')); // Restored this route
app.use('/api/admin', require('./routes/reviewRoutes'));    // Restored this route
app.use('/api/admin', require('./routes/adminReview')); 

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
    
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Server startup failed:', error);
    process.exit(1); // Exit the process if the database connection fails
  }
};

startServer();