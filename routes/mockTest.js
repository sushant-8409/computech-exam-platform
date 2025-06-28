const express = require('express');
require('dotenv').config();
const router = express.Router();
const MockTest = require('../models/MockTest');
const MockTestResult = require('../models/MockTestResult');
const { authenticateStudent } = require('../middleware/auth');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// All routes in this file are protected and require an authenticated student
router.use(authenticateStudent);

// Helper function to determine the programming language based on board and subject
const getProgrammingLanguage = (board, subject) => {
  const lowerCaseBoard = board.toLowerCase();
  const lowerCaseSubject = subject.toLowerCase();

  if (lowerCaseSubject.includes('computer')) {
    if (lowerCaseBoard === 'icse' || lowerCaseBoard === 'isc') {
      return 'Java';
    }
    if (lowerCaseBoard === 'wbchse') {
      return 'C';
    }
    if (lowerCaseBoard === 'cbse') {
      return 'Python';
    }
  }
  // Return a generic placeholder if no specific language is required
  return 'an appropriate programming language';
};

// Helper function to create the prompt for the Gemini API
function createGeminiPrompt({ subject, chapters, numberOfQuestions, questionType, difficultyLevel, studentClass, studentBoard }) {
  const chapterList = chapters.join(', ');
  const language = getProgrammingLanguage(studentBoard, subject);
  const languageRequirement = `For any coding questions, you MUST use the ${language} programming language.`;

  if (questionType === 'mcq') {
    return `Create ${numberOfQuestions} multiple choice questions for a ${studentClass} student of the ${studentBoard} board, focusing on the subject ${subject}.\n\nChapters to focus on: ${chapterList}\nDifficulty level: ${difficultyLevel}\n${languageRequirement}\n\nFormat the response as a single, raw JSON object (no markdown, no comments) with the following structure:\n{\n  "questions": [\n    {\n      "question": "Question text here. Ensure any code is properly escaped for JSON.",\n      "options": ["Option A", "Option B", "Option C", "Option D"],\n      "correctAnswer": "Option A",\n      "explanation": "Brief explanation of the correct answer.",\n      "marks": 2,\n      "difficulty": "${difficultyLevel}",\n      "chapter": "Chapter name"\n    }\n  ]\n}\n\nRequirements:\n- Each question should be clear and unambiguous.\n- Options should be plausible.\n- Include proper explanations for each answer.\n- Vary the difficulty within the ${difficultyLevel} range.\n- Cover different concepts from the specified chapters.\n- Assign appropriate marks (1-5) based on question complexity.`;
  } else { // subjective
    return `Create ${numberOfQuestions} subjective questions for a ${studentClass} student of the ${studentBoard} board, focusing on the subject ${subject}.\n\nChapters to focus on: ${chapterList}\nDifficulty level: ${difficultyLevel}\n${languageRequirement}\n\nFormat the response as a single, raw JSON object (no markdown, no comments) with the following structure:\n{\n  "questions": [\n    {\n      "question": "Question text here. Ensure any code is properly escaped for JSON.",\n      "marks": 5,\n      "difficulty": "${difficultyLevel}",\n      "chapter": "Chapter name",\n      "expectedAnswer": "Key points, concepts, or code snippets that should be covered in the answer.",\n      "markingScheme": "A breakdown of how marks should be distributed for the key points."\n    }\n  ]\n}\n\nRequirements:\n- Questions should require detailed explanations.\n- Provide clear marking schemes and expected answer key points.\n- Assign marks based on question complexity (2-10 marks).\n- Questions should test understanding, analysis, and application.`;
  }
}

// Helper function to parse the potentially messy response from Gemini
function parseGeminiResponse(response) {
  try {
    const jsonStart = response.indexOf('{');
    const jsonEnd = response.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error("Could not find a valid JSON object in the AI response.");
    }
    const jsonString = response.substring(jsonStart, jsonEnd + 1);
    const parsed = JSON.parse(jsonString);
    if (!parsed.questions || !Array.isArray(parsed.questions)) {
      throw new Error('Parsed JSON is invalid: "questions" array not found.');
    }
    const totalMarks = parsed.questions.reduce((sum, q) => sum + (q.marks || 1), 0);
    return { questions: parsed.questions, totalMarks };
  } catch (error) {
    console.error('Error parsing Gemini response:', error);
    console.error('Original Gemini response text:', response);
    throw new Error('Failed to parse generated questions');
  }
}

// POST /api/student/mock-tests/generate
router.post('/generate', async (req, res) => {
  try {
    const {
      subject, chapters, timeLimit, numberOfQuestions,
      questionType, difficultyLevel, studentClass, studentBoard
    } = req.body;
    const studentId = req.user.id;

    const prompt = createGeminiPrompt({
      subject, chapters, numberOfQuestions, questionType,
      difficultyLevel, studentClass, studentBoard
    });

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro-latest' });
    const result = await model.generateContent(prompt);
    const generatedContent = result.response.text();

    const parsedTest = parseGeminiResponse(generatedContent);

    const mockTest = new MockTest({
      studentId,
      title: `${subject} - ${chapters.join(', ')} Mock Test`,
      subject,
      chapters,
      questionType,
      difficultyLevel,
      timeLimit,
      questions: parsedTest.questions,
      totalMarks: parsedTest.totalMarks,
      generatedAt: new Date(),
      geminiPrompt: prompt,
      geminiResponse: generatedContent,
    });

    await mockTest.save();
    res.json({ success: true, test: mockTest, message: 'Mock test generated successfully' });
  } catch (error) {
    console.error('Error generating mock test:', error);
    res.status(500).json({ success: false, message: 'Failed to generate mock test', error: error.message });
  }
});


// POST /api/student/mock-tests/submit
router.post('/submit', async (req, res) => {
  try {
    const { testId, answers, timeTaken, questionType } = req.body;
    const studentId = req.user.id;
    const test = await MockTest.findById(testId);
    if (!test) {
      return res.status(404).json({ success: false, message: 'Test not found' });
    }

    let result;
    if (questionType === 'mcq') {
      let marksObtained = 0;
      const questionWiseMarks = test.questions.map((question, index) => {
        const studentAnswer = answers[index] || "Not Answered";
        const isCorrect = studentAnswer === question.correctAnswer;
        const marksForQuestion = isCorrect ? question.marks : 0;
        marksObtained += marksForQuestion;
        return {
          questionNo: index + 1,
          question: question.question,
          studentAnswer,
          correctAnswer: question.correctAnswer,
          feedback: question.explanation, // Using 'feedback' to match the schema
          isCorrect,
          maxMarks: question.marks,
          obtainedMarks: marksForQuestion,
        };
      });
      const percentage = test.totalMarks > 0 ? Math.round((marksObtained / test.totalMarks) * 100) : 0;
      result = new MockTestResult({
        studentId, testId, testTitle: test.title, subject: test.subject, questionType, answers, marksObtained, totalMarks: test.totalMarks,
        percentage, timeTaken, questionWiseMarks, submittedAt: new Date(), status: 'completed'
      });
    } else { // 'subjective'
      result = new MockTestResult({
        studentId, testId, testTitle: test.title, subject: test.subject, questionType, answers, totalMarks: test.totalMarks,
        timeTaken, submittedAt: new Date(), status: 'pending_evaluation'
      });
    }
    await result.save();
    res.json({ success: true, result, message: 'Test submitted successfully' });
  } catch (error) {
    console.error('Error submitting mock test:', error);
    res.status(500).json({ success: false, message: 'Failed to submit test' });
  }
});

// GET /api/student/mock-tests/history
router.get('/history', async (req, res) => {
  try {
    const studentId = req.user.id;
    const tests = await MockTestResult.find({ studentId }).sort({ submittedAt: -1 }).limit(20);
    res.json({ success: true, tests });
  } catch (error) {
    console.error('Error fetching test history:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch test history' });
  }
});

// POST /api/student/mock-tests/evaluate-subjective
router.post('/evaluate-subjective', async (req, res) => {
  try {
    const { resultId, questionWiseMarks } = req.body;
    const studentId = req.user.id;
    const result = await MockTestResult.findOne({ _id: resultId, studentId: studentId });
    if (!result) {
      return res.status(404).json({ success: false, message: 'Test result not found' });
    }
    if(result.status === 'evaluated') {
      return res.status(400).json({ success: false, message: 'This test has already been evaluated.' });
    }

    const marksObtained = questionWiseMarks.reduce((total, mark) => total + mark.obtainedMarks, 0);
    const percentage = result.totalMarks > 0 ? Math.round((marksObtained / result.totalMarks) * 100) : 0;
    result.questionWiseMarks = questionWiseMarks;
    result.marksObtained = marksObtained;
    result.percentage = percentage;
    result.evaluatedAt = new Date();
    result.status = 'evaluated';
    await result.save();
    res.json({ success: true, result, message: 'Test evaluated successfully' });
  } catch (error) {
    console.error('Error evaluating subjective test:', error);
    res.status(500).json({ success: false, message: 'Failed to evaluate test' });
  }
});

module.exports = router;