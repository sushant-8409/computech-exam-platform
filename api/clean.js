// Simplified serverless function for Vercel deployment
// Handles basic API routes without complex dependencies

const jwt = require('jsonwebtoken');

// Helper: safely read and parse JSON body for Node serverless runtime
async function readJsonBody(req) {
  return await new Promise((resolve, reject) => {
    try {
      let data = '';
      req.on('data', chunk => { data += chunk; });
      req.on('end', () => {
        if (!data) return resolve({});
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          // Not JSON – resolve as empty object to trigger 400 below
          resolve({});
        }
      });
      req.on('error', reject);
    } catch (err) {
      resolve({});
    }
  });
}

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

  let { method, url } = req;
  // Normalize potential double '/api/api' prefix from front-end/baseURL combos
  if (url.startsWith('/api/api/')) url = url.replace('/api/api/', '/api/');
  if (url === '/api') url = '/';

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
      console.log('🔐 Login endpoint hit');
      // Always read and parse body manually to be safe in serverless
      const body = await readJsonBody(req);
      console.log('📝 Parsed body keys:', Object.keys(body || {}));
      
      const { email, password } = body || {};
      
      console.log('🔐 Login attempt for:', email);
      console.log('🔐 Password provided:', !!password);
      
      if (!email || !password) {
        console.log('❌ Missing email or password');
        return res.status(400).json({
          success: false,
          message: 'Email and password are required'
        });
      }

      // Admin login
  const adminEmail = process.env.ADMIN_EMAIL || 'mdalamrahman4@gmail.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Zerocheck@admin1';
      
      console.log('🔍 Checking credentials against:', adminEmail);
      console.log('🔍 Email match:', email === adminEmail);
      console.log('🔍 Password match:', password === adminPassword);
      
      if (email === adminEmail && password === adminPassword) {
        console.log('✅ Credentials match, generating token...');
        
        try {
          const token = jwt.sign(
            { id: 'admin', email: adminEmail, role: 'admin' },
            process.env.JWT_SECRET || 'fallback-secret',
            { expiresIn: '24h' }
          );

          console.log('✅ Token generated successfully');
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
        } catch (tokenError) {
          console.error('❌ Token generation error:', tokenError);
          return res.status(500).json({
            success: false,
            message: 'Token generation failed'
          });
        }
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