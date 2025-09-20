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

// For serverless/production, use minimal session configuration
if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
  // Disable sessions in serverless as they don't persist anyway
  console.log('📝 Serverless environment detected - minimal session config');
  app.use((req, res, next) => {
    req.session = {}; // Mock session object
    next();
  });
} else {
  app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { 
      secure: false, // Development
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  }));
}

// MongoDB connection with connection pooling for serverless
let cachedConnection = null;
let cachedQuestionsDb = null;

async function connectToMongoDB() {
  // Check if we have valid cached connections
  if (cachedConnection?.readyState === 1 && cachedQuestionsDb?.readyState === 1) {
    console.log('✅ Using cached MongoDB connections');
    return { connection: cachedConnection, questionsDb: cachedQuestionsDb };
  }

  try {
    console.log('🔄 Establishing MongoDB connections...');
    
    // Optimized connection options for serverless/production with free tier limits
    const connectionOptions = {
      bufferCommands: false,
      maxPoolSize: 3, // Further reduced for free tier limits
      minPoolSize: 0, // Allow pool to scale down to 0
      serverSelectionTimeoutMS: 8000, // Reduced timeout
      socketTimeoutMS: 15000, // Reduced timeout
      connectTimeoutMS: 8000, // Reduced timeout
      maxIdleTimeMS: 10000, // Close connections after 10s idle (aggressive for free tier)
      heartbeatFrequencyMS: 30000, // Less frequent heartbeat
      retryWrites: true,
      w: 'majority'
    };

    // Special SSL options for questions database (MONGOURI2)
    const questionsConnectionOptions = {
      ...connectionOptions,
      ssl: false
    };
    
    // Connect to primary database first
    console.log('📡 Connecting to primary database...');
    const connection = await mongoose.connect(process.env.MONGODB_URI, connectionOptions);
    
    if (connection.connection.readyState !== 1) {
      throw new Error('Primary database connection failed to establish');
    }
    console.log('✅ Primary database connected');
    
    // Connect to questions database if URI2 is available
    let questionsDb = null;
    if (process.env.MONGOURI2) {
      try {
        console.log('📡 Connecting to questions database...');
        // Try with the basic connection string first, then with modified options
        let connectionString = process.env.MONGOURI2;
        
        // If it's a MongoDB Atlas connection, ensure SSL is enabled with correct options
        if (connectionString.includes('mongodb+srv://') || connectionString.includes('.mongodb.net')) {
          questionsConnectionOptions.ssl = true;
          questionsConnectionOptions.tls = true;
          // Remove unsupported options
          delete questionsConnectionOptions.sslValidate;
          delete questionsConnectionOptions.authSource;
        }
        
        console.log('📡 Questions DB connection type:', connectionString.includes('mongodb+srv://') ? 'Atlas (SSL)' : 'Standard');
        questionsDb = mongoose.createConnection(connectionString, questionsConnectionOptions);
        
        // Wait for questions DB connection with timeout
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            console.warn('⚠️ Questions database connection timeout, continuing with primary only');
            resolve(); // Don't reject, just continue without questions DB
          }, 8000);
          
          questionsDb.on('connected', () => {
            clearTimeout(timeout);
            console.log('✅ Questions database connected');
            resolve();
          });
          
          questionsDb.on('error', (err) => {
            clearTimeout(timeout);
            console.warn('⚠️ Questions database connection failed:', err.message);
            resolve(); // Don't reject, just continue without questions DB
          });
        });
      } catch (questionDbError) {
        console.warn('⚠️ Questions database failed, continuing with primary only:', questionDbError.message);
        questionsDb = null;
      }
    }
    
    cachedConnection = connection;
    cachedQuestionsDb = questionsDb;
    
    // Make questions database globally available if available, otherwise use primary
    if (questionsDb && questionsDb.readyState === 1) {
      global.questionsDb = questionsDb;
      console.log('✅ Global questions database set');
    } else {
      // Use primary database as fallback for coding problems
      global.questionsDb = connection;
      console.log('⚠️ Using primary database as fallback for questions/coding');
    }
    
    console.log('✅ MongoDB connections established');
    
    // Set up connection cleanup for serverless environment
    if (process.env.VERCEL) {
      // Cleanup idle connections more aggressively in serverless
      const cleanupTimer = setTimeout(() => {
        if (cachedConnection?.readyState === 1) {
          console.log('🧹 Cleaning up idle primary connection');
          cachedConnection.close().catch(console.error);
          cachedConnection = null;
        }
        if (cachedQuestionsDb?.readyState === 1) {
          console.log('🧹 Cleaning up idle questions connection');
          cachedQuestionsDb.close().catch(console.error);
          cachedQuestionsDb = null;
        }
      }, 60000); // Close after 1 minute of inactivity
      
      // Clear timer if process is about to exit
      process.once('beforeExit', () => {
        clearTimeout(cleanupTimer);
      });
    }
    
    return { connection, questionsDb };
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    cachedConnection = null;
    cachedQuestionsDb = null;
    throw error;
  }
}

// Middleware to ensure MongoDB connection before handling requests
async function ensureDbConnection(req, res, next) {
  try {
    // Check if connection is already established
    if (cachedConnection?.readyState === 1) {
      return next();
    }
    
    // Try to establish connection with retry logic
    let retries = 2;
    let lastError;
    
    for (let i = 0; i <= retries; i++) {
      try {
        await connectToMongoDB();
        return next();
      } catch (error) {
        lastError = error;
        console.error(`❌ Database connection attempt ${i + 1} failed:`, error.message);
        
        if (i < retries) {
          console.log(`🔄 Retrying connection in ${(i + 1) * 1000}ms...`);
          await new Promise(resolve => setTimeout(resolve, (i + 1) * 1000));
        }
      }
    }
    
    // All retries failed
    console.error('❌ All database connection attempts failed');
    res.status(503).json({ 
      success: false, 
      message: 'Database temporarily unavailable',
      error: process.env.NODE_ENV === 'development' ? lastError.message : 'Service unavailable'
    });
  } catch (error) {
    console.error('❌ Unexpected error in connection middleware:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}

// Make connectToMongoDB globally available
global.connectToMongoDB = connectToMongoDB;

// Health check endpoint (before middleware to allow direct connection testing)
app.get('/health', async (req, res) => {
  try {
    console.log('🏥 Health check requested');
    
    // Direct connection check
    let primaryStatus = 'disconnected';
    let questionsStatus = 'disconnected';
    let error = null;
    
    try {
      const { connection, questionsDb } = await connectToMongoDB();
      primaryStatus = connection?.connection?.readyState === 1 ? 'connected' : 'disconnected';
      questionsStatus = questionsDb?.readyState === 1 ? 'connected' : 'disconnected';
    } catch (dbError) {
      error = dbError.message;
      console.error('🏥 Health check DB error:', dbError.message);
    }
    
    const healthStatus = primaryStatus === 'connected' ? 'OK' : 'ERROR';
    
    const response = { 
      status: healthStatus, 
      timestamp: new Date().toISOString(),
      database: {
        primary: primaryStatus,
        questions: questionsStatus
      }
    };
    
    if (error) {
      response.error = error;
    }
    
    res.status(healthStatus === 'OK' ? 200 : 503).json(response);
  } catch (error) {
    console.error('🏥 Health check error:', error.message);
    res.status(500).json({ 
      status: 'ERROR', 
      timestamp: new Date().toISOString(),
      error: error.message 
    });
  }
});

// ================== API Routes ==================
// Apply database connection middleware to all routes
app.use(ensureDbConnection);

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
    // Normalize path: strip leading '/api' so Express routes like '/auth', '/admin' match
    if (req.url === '/api') {
      req.url = '/';
    } else if (req.url && req.url.startsWith('/api/')) {
      req.url = req.url.replace(/^\/api\//, '/');
    }

    // Handle the request with Express (middleware will handle DB connection)
    return app(req, res);
  } catch (error) {
    console.error('❌ Serverless function error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};