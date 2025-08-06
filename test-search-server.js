// Simple test to validate the manual test entry route
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Mock middleware for auth (for testing)
const authenticateAdmin = (req, res, next) => {
  console.log('Auth middleware called');
  next();
};

// Mock Student model
const Student = {
  find: async (query, fields) => {
    console.log('Student.find called with:', query, fields);
    // Return mock student data
    return [
      {
        _id: '1',
        name: 'Test Student 1',
        email: 'test1@example.com',
        rollNo: 'R001',
        class: '10',
        board: 'CBSE',
        school: 'Test School',
        phone: '1234567890',
        subject: 'Mathematics'
      },
      {
        _id: '2',
        name: 'Test Student 2',
        email: 'test2@example.com',
        rollNo: 'R002',
        class: '11',
        board: 'ICSE',
        school: 'Demo School',
        phone: '0987654321',
        subject: 'Physics'
      }
    ];
  }
};

// Add the search endpoint
app.get('/api/admin/manual-test/search-students', authenticateAdmin, async (req, res) => {
    try {
        const { query } = req.query;
        console.log('Search query received:', query);
        
        if (!query || query.trim().length === 0) {
            return res.json({
                success: true,
                students: []
            });
        }

        const searchRegex = new RegExp(query.trim(), 'i');
        
        const students = await Student.find({
            status: 'active',
            $or: [
                { name: searchRegex },
                { email: searchRegex },
                { rollNo: searchRegex },
                { phone: searchRegex }
            ]
        }, {
            name: 1,
            email: 1,
            rollNo: 1,
            class: 1,
            board: 1,
            school: 1,
            phone: 1,
            subject: 1
        });

        console.log(`Student search for "${query}":`, students.length, 'results found');

        res.json({
            success: true,
            students
        });
    } catch (error) {
        console.error('Error searching students:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to search students',
            error: error.message
        });
    }
});

const PORT = 8080;
app.listen(PORT, () => {
    console.log(`Test server running on port ${PORT}`);
    console.log('Test URL: http://localhost:8080/api/admin/manual-test/search-students?query=test');
});
