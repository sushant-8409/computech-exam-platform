const express = require('express');
const router = express.Router();
const CodingTestController = require('../controllers/CodingTestController');
const { authenticateStudent } = require('../middleware/auth');

// Apply student authentication to all routes
router.use(authenticateStudent);

// Get coding test details (supports both single and multi-question)
router.get('/:testId', CodingTestController.getCodingTest);

// Test code against visible test cases (legacy single-question)
router.post('/:testId/test', CodingTestController.testCode);

// Submit code for final evaluation (legacy single-question)
router.post('/:testId/submit', CodingTestController.submitCode);

// Test code for a specific question in multi-question test
router.post('/:testId/test-question', CodingTestController.testQuestionCode);

// Submit multi-question coding test
router.post('/:testId/submit-multi', CodingTestController.submitMultiQuestionTest);

// Get available programming languages
router.get('/languages/available', CodingTestController.getLanguages);

// Check Judge0 service status
router.get('/service/status', CodingTestController.checkServiceStatus);

module.exports = router;
