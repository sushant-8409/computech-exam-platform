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

// ✅ IMPROVED: Conditional logging
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    if (!req.path.startsWith('/static') && !req.path.endsWith('.js') && !req.path.endsWith('.css')) {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
    }
    next();
  });
}

// ================== Routes ==================
// Register all routes at once
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/student', require('./routes/student'));
app.use('/api/tests', require('./routes/tests'));
app.use('/api', require('./routes/analytics'));
app.use('/api/files', require('./routes/files'));
app.use('/api/student/mock-tests', require('./routes/mockTest'));

// ================== Static Files ==================
app.use(express.static(path.join(__dirname, 'frontend', 'build'), {
  maxAge: '1d' // Cache static files
}));

// ================== Error Handling ==================
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'build', 'index.html'));
});

app.use((error, req, res, next) => {
  console.error('🔥 Server error:', error.message);
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
  });
});

// ================== Server Start ==================
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
    process.exit(1);
  }
};

startServer();
