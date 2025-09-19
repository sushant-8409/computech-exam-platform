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

// Allowed origins (canonical) and dynamic matchers
const allowedOrigins = [
  'https://computech-exam-platform.vercel.app',
  'https://computechexamplatform.vercel.app',
  'https://www.auctutor.app',
  'https://auctutor.app',
  'https://computechexamplatform.netlify.app'
];
const vercelProjectRegex = /^https:\/\/computechexamplatform-[a-z0-9-]+\.vercel\.app$/;

// ================== Middleware ==================
app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests or same-origin
    if (!origin) return callback(null, true);
    if (process.env.NODE_ENV !== 'production') {
      return ['http://localhost:3000', 'http://localhost:5000'].includes(origin)
        ? callback(null, true)
        : callback(new Error('Not allowed by CORS'));
    }
    if (allowedOrigins.includes(origin) || vercelProjectRegex.test(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  methods: 'GET,POST,PUT,DELETE,PATCH,OPTIONS',
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 204,
  preflightContinue: false
}));

// Explicitly handle preflight
app.options('*', cors());

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
let cachedQuestionsDb = null;

async function connectToMongoDB() {
  if (cachedConnection && cachedQuestionsDb) {
    return { connection: cachedConnection, questionsDb: cachedQuestionsDb };
  }

  try {
    // Connect to primary database
    const connection = await mongoose.connect(process.env.MONGODB_URI, {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    
    // Connect to questions database (for coding practice)
    const questionsDb = mongoose.createConnection(process.env.MONGOURI2, {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    
    cachedConnection = connection;
    cachedQuestionsDb = questionsDb;
    
    // Make questions database globally available
    global.questionsDb = questionsDb;
    
    console.log('✅ Connected to MongoDB (cached)');
    console.log('✅ Connected to questions MongoDB (cached)');
    
    return { connection, questionsDb };
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
app.use('/promotions', require('../routes/promotions'));

// Coding Practice routes
app.use('/coding-practice', require('../routes/codingPractice'));

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
    // Normalize path: strip leading '/api' so Express routes like '/auth', '/admin' match
    if (req.url === '/api') {
      req.url = '/';
    } else if (req.url && req.url.startsWith('/api/')) {
      req.url = req.url.replace(/^\/api\//, '/');
    }

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