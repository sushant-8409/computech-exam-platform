const jwt = require('jsonwebtoken');

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    const { email, password } = req.body;
    
    // Basic validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Invalid input',
        errors: [{ msg: 'Email and password are required' }]
      });
    }
    
    // Simple admin check
    if (email === 'mdalamrahman@gmail.com' && password === '4321') {
      const token = jwt.sign(
        { email, role: 'admin' }, 
        'your-secret-key',
        { expiresIn: '24h' }
      );
      
      return res.json({
        success: true,
        message: 'Login successful',
        token,
        user: { email, role: 'admin' }
      });
    }
    
    if (email === 'mdalamrahman4@gmail.com' && password === 'Zerocheck@admin1') {
      const token = jwt.sign(
        { email, role: 'admin' }, 
        'your-secret-key',
        { expiresIn: '24h' }
      );
      
      return res.json({
        success: true,
        message: 'Login successful',
        token,
        user: { email, role: 'admin' }
      });
    }
    
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }
  
  return res.status(405).json({ message: 'Method not allowed' });
}