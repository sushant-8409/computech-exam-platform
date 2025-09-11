// middleware/auth.js
const jwt = require('jsonwebtoken');
const Student = require('../models/Student');

const authenticateStudent = async (req, res, next) => {
  try {
    console.log('👤 Student authenticate middleware called');
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('✅ Token decoded:', decoded);

    // 1) If it's an admin token, just let them through
    if (decoded.role === 'admin') {
      req.user = { id: 'admin', role: 'admin', name: 'Administrator', email: decoded.email };
      req.student = null; // Explicitly set to null for admin users
      return next();
    }

    // 2) Otherwise, do the normal student lookup
    const student = await Student.findById(decoded.id).select('-passwordHash');
    if (!student) {
      return res.status(401).json({ success: false, message: 'Invalid token.' });
    }
    if (!student.approved) {
      return res.status(403).json({ success: false, message: 'Account not approved.' });
    }

    req.user = { id: student._id, role: 'student' };
    req.student = student;
    next();

  } catch (error) {
    console.error('❌ Student authentication error:', error.message);
    res.status(401).json({ success: false, message: 'Invalid token.' });
  }
};
const authenticateAdmin = (req, res, next) => {
  try {
    console.log('🔐 Admin authenticate middleware called');
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      console.log('❌ No token provided');
      return res.status(401).json({ success: false, message: 'No token' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('✅ Admin token decoded:', { role: decoded.role, email: decoded.email });
    
    if (decoded.role !== 'admin') {
      console.log('❌ Not an admin token');
      return res.status(403).json({ success: false, message: 'Admins only' });
    }
    
    req.user = { 
      id: 'admin', 
      _id: 'admin',
      role: 'admin', 
      email: decoded.email,
      name: 'Administrator' // Add name field
    };
    
    console.log('✅ Admin authenticated:', req.user);
    next();
  } catch (error) {
    console.error('❌ Admin authentication error:', error.message);
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
};
module.exports = { authenticateStudent,authenticateAdmin };
