const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const router = express.Router();

// Simple login route that works with your existing data
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 1 })
], async (req, res) => {
  try {
    console.log('🔐 Login attempt for:', req.body.email);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid input',
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    // Admin login
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@computech.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';
    
    if (email === adminEmail && password === adminPassword) {
      console.log('✅ Admin login successful');
      
      const token = jwt.sign(
        { id: 'admin', email: email, role: 'admin' },
        process.env.JWT_SECRET || 'fallback-secret',
        { expiresIn: '24h' }
      );

      return res.json({
        success: true,
        message: 'Admin login successful',
        token,
        user: { 
          id: 'admin', 
          email: email, 
          role: 'admin', 
          name: 'Administrator' 
        }
      });
    }

    // Student login with dynamic model loading
    console.log('🔍 Searching for student...');
    
    // Try to load the Student model
    let Student;
    try {
      Student = require('../models/Student');
    } catch (error) {
      console.error('❌ Student model not found');
      return res.status(500).json({
        success: false,
        message: 'Server configuration error'
      });
    }
    
    const student = await Student.findOne({ email });
    
    if (!student) {
      console.log('❌ Student not found:', email);
      
      // Debug info
      const totalStudents = await Student.countDocuments();
      console.log(`📊 Total students: ${totalStudents}`);
      
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    console.log('👤 Student found:', {
      name: student.name,
      email: student.email,
      approved: student.approved
    });

    if (!student.approved) {
      return res.status(403).json({
        success: false,
        message: 'Account pending approval. Please contact administrator.'
      });
    }

    // Password validation
    let isPasswordValid = false;
    
    try {
      if (student.comparePassword) {
        isPasswordValid = await student.comparePassword(password);
      } else {
        // Fallback method
        const passwordField = student.passwordHash || student.password;
        if (passwordField) {
          try {
            isPasswordValid = await bcrypt.compare(password, passwordField);
          } catch {
            isPasswordValid = password === passwordField;
          }
        }
      }
    } catch (error) {
      console.log('❌ Password validation error:', error.message);
    }

    if (!isPasswordValid) {
      console.log('❌ Invalid password');
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    console.log('✅ Student login successful');

    const token = jwt.sign({
      id: student._id,
      email: student.email,
      role: 'student'
    }, process.env.JWT_SECRET || 'fallback-secret', { expiresIn: '24h' });

    res.json({
      success: true,
      message: 'Student login successful',
      token,
      user: {
        id: student._id,
        name: student.name,
        email: student.email,
        role: 'student',
        class: student.class,
        board: student.board
      }
    });

  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during login'
    });
  }
});

// Simple token verification
router.get('/verify', async (req, res) => {
  try {
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');

    if (decoded.role === 'admin') {
      return res.json({
        success: true,
        user: { 
          id: 'admin', 
          email: decoded.email, 
          role: 'admin', 
          name: 'Administrator' 
        }
      });
    }

    // For students, just return the decoded data
    res.json({
      success: true,
      user: {
        id: decoded.id,
        email: decoded.email,
        role: 'student'
      }
    });

  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
});

router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Auth routes working',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
