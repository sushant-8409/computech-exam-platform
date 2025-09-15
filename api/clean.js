// Simplified serverless function for Vercel deployment
// Handles basic API routes without complex dependencies

const jwt = require('jsonwebtoken');

module.exports = async (req, res) => {
  try {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    console.log('🔍 API Request:', req.method, req.url);
    console.log('- Has JWT_SECRET:', !!process.env.JWT_SECRET);
    console.log('- Has ADMIN_EMAIL:', !!process.env.ADMIN_EMAIL);

    const { method, url } = req;

    // Health endpoint
    if ((url === '/health' || url === '/api/health') && method === 'GET') {
      return res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        env: {
          hasJwtSecret: !!process.env.JWT_SECRET,
          hasAdminEmail: !!process.env.ADMIN_EMAIL,
          nodeEnv: process.env.NODE_ENV
        }
      });
    }

    // Test endpoint
    if ((url === '/test' || url === '/api/test') && method === 'GET') {
      return res.json({
        message: 'API is working!',
        timestamp: new Date().toISOString(),
        url,
        method
      });
    }

    // Login endpoint
    if ((url === '/auth/login' || url === '/api/auth/login') && method === 'POST') {
      const { email, password } = req.body || {};
      
      console.log('🔐 Login attempt for:', email);
      
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email and password are required'
        });
      }

      // Admin login
      const adminEmail = process.env.ADMIN_EMAIL || 'mdalamrahman4@gmail.com';
      const adminPassword = process.env.ADMIN_PASSWORD || 'Zerocheck@admin1';
      
      if (email === adminEmail && password === adminPassword) {
        const token = jwt.sign(
          { id: 'admin', email: adminEmail, role: 'admin' },
          process.env.JWT_SECRET || 'fallback-secret',
          { expiresIn: '24h' }
        );

        console.log('✅ Admin login successful');
        return res.json({
          success: true,
          message: 'Login successful',
          token,
          user: {
            id: 'admin',
            email: adminEmail,
            role: 'admin',
            name: 'Administrator'
          }
        });
      }

      console.log('❌ Login failed - invalid credentials');
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Default 404
    return res.status(404).json({
      success: false,
      message: `Cannot ${method} ${url}`
    });

  } catch (error) {
    console.error('❌ API Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};