const express = require('express');
require('dotenv').config();
const router = express.Router();

// Mongoose Models
const MockTest = require('../models/MockTest');
const MockTestResult = require('../models/MockTestResult');

// Middleware
const { authenticateStudent } = require('../middleware/auth');

// Google Gemini API Initialization
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// Protect all routes in this file
router.use(authenticateStudent);

//==================================================================
// 1. HELPER FUNCTIONS
//==================================================================

/**
 * Asks the AI to evaluate a student's code.
 */
async function evaluateCodeWithAI(questionData, studentCode) {
    const { question, expectedAnswer, markingScheme, marks } = questionData;
    const prompt = `You are an expert and strict computer science teacher. Evaluate the following student's code based on the problem description and marking scheme. Problem Statement: "${question}"; Key Points for a Correct Answer: "${expectedAnswer}"; Marking Scheme: "${markingScheme}"; Maximum Marks: ${marks}. --- Student's Submitted Code: \`\`\`${studentCode || "(No code submitted)"}\`\`\` --- Task: Analyze the student's code for correctness, logic, and adherence to the requirements. Do not execute the code. Based on your analysis, decide the marks to award. CRITICAL: Respond with ONLY a single, raw JSON object. Do not add any other text or markdown. The JSON object must have these exact keys: { "obtainedMarks": <a number between 0 and ${marks}>, "feedback": "<A concise, helpful explanation for the student justifying the marks awarded.>" }`;
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        const jsonStart = responseText.indexOf('{');
        const jsonEnd = responseText.lastIndexOf('}');
        const jsonString = responseText.substring(jsonStart, jsonEnd + 1);
        return JSON.parse(jsonString);
    } catch (error) {
        console.error("AI Evaluation Error:", error);
        return { obtainedMarks: 0, feedback: "The AI evaluator encountered an error. This question has not been marked." };
    }
}

/**
 * ✅ FIXED: This function now correctly returns a plain string (e.g., "Java").
 */
const getProgrammingLanguage = (board, subject) => {
    const lowerCaseBoard = (board || '').toLowerCase();
    const lowerCaseSubject = (subject || '').toLowerCase();
    if (lowerCaseSubject.includes('computer')) {
        if (lowerCaseBoard.includes('icse') || lowerCaseBoard.includes('isc')) return 'Java';
        if (lowerCaseBoard.includes('wbchse')) return 'C++';
        if (lowerCaseBoard.includes('cbse')) return 'Python';
    }
    return 'Python'; // A sensible default
};

/**
 * Creates a specific, robust prompt for the Gemini API.
 */
function createGeminiPrompt({ subject, chapters, numberOfQuestions, questionType, difficultyLevel, studentClass, studentBoard }) {
    const chapterList = chapters.join(', ');
    const language = getProgrammingLanguage(studentBoard, subject);

    // Common instructions applied to ALL prompts for maximum reliability.
    const commonInstructions = `
    You are an expert question paper setter for Indian high school boards.
    Task: Create a set of ${numberOfQuestions} unique questions.
    Topic: ${subject}
    Chapters: ${chapterList}
    Target Audience: A ${studentClass} student from the ${studentBoard} board.
    Difficulty: ${difficultyLevel}
    Language for any code snippets: ${language}.

    CRITICAL INSTRUCTIONS:
    1. Your entire response MUST be ONLY a single, raw JSON object.
    2. Do NOT include any conversational text, explanations, or markdown formatting like \`\`\`json.
    3. Ensure all string values in the JSON, especially those with newlines or quotes, are properly escaped.
    4. The root object must have a single key "questions" which is an array of question objects.

    GENERATE THE JSON NOW.`;

    if (questionType === 'coding') {
        return `Each object in the "questions" array must have these exact keys: "question", "expectedAnswer", "markingScheme", "marks", "difficulty", "chapter".

        Example for one coding question object:
        {
          "question": "Write a ${language} function named 'calculateFactorial' that takes an integer 'n' and returns its factorial. The solution should use recursion.",
          "expectedAnswer": "The solution must contain a function that correctly implements the factorial logic.\\nIt must include a base case for n=0 or n=1 returning 1.\\nThe recursive step must be n * factorial(n-1).",
          "markingScheme": "Correct base case: 2 marks. Correct recursive step: 2 marks. Correct function signature: 1 mark.",
          "marks": 5,
          "difficulty": "medium",
          "chapter": "Recursion"
        }
        ${commonInstructions}`;
    }
    
    if (questionType === 'mcq') {
        return `Each object in the "questions" array must have these exact keys: "question", "options", "correctAnswer", "explanation", "marks", "difficulty", "chapter".

        Example for one MCQ question object:
        {
          "question": "In ${language}, which keyword is used to inherit a class?",
          "options": ["extends", "implements", "inherits", "super"],
          "correctAnswer": "extends",
          "explanation": "The 'extends' keyword is used in ${language} to create a subclass that inherits from a superclass.",
          "marks": 1,
          "difficulty": "easy",
          "chapter": "Inheritance"
        }
        ${commonInstructions}`;
    }

    // Fallback for Subjective
    return `Each object in the "questions" array must have these exact keys: "question", "expectedAnswer", "markingScheme", "marks", "difficulty", "chapter".

    Example for one subjective question object:
    {
        "question": "Explain the concept of Polymorphism in ${language} with a brief code example.",
        "expectedAnswer": "The student must define Polymorphism as 'many forms'. They should mention compile-time (overloading) and runtime (overriding) polymorphism. The code example should show either a method overload or a method override.",
        "markingScheme": "Definition: 2 marks. Types mention: 1 mark. Code example: 2 marks.",
        "marks": 5,
        "difficulty": "medium",
        "chapter": "Object-Oriented Programming"
    }
    ${commonInstructions}`;
}

function parseGeminiResponse(responseText) {
    if (!responseText) {
        throw new Error("The AI returned an empty response. Please try again.");
    }

    // Add logging to see exactly what the AI sent back
    console.log("--- Raw AI Response Received ---");
    console.log(responseText);
    console.log("------------------------------");

    // Attempt to find a JSON object within the response string
    let jsonString = responseText;

    // Handle the case where the AI wraps the JSON in markdown
    const markdownMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
    if (markdownMatch && markdownMatch[1]) {
        jsonString = markdownMatch[1];
    } else {
        // As a fallback, find the first '{' and last '}'
        const jsonStart = responseText.indexOf('{');
        const jsonEnd = responseText.lastIndexOf('}');
        if (jsonStart === -1 || jsonEnd === -1) {
            throw new Error("Could not find a valid JSON object in the AI response.");
        }
        jsonString = responseText.substring(jsonStart, jsonEnd + 1);
    }

    try {
        const parsed = JSON.parse(jsonString);
        if (!parsed.questions || !Array.isArray(parsed.questions)) {
            throw new Error('Parsed JSON is invalid: "questions" array not found or is not an array.');
        }
        const totalMarks = parsed.questions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0);
        return { questions: parsed.questions, totalMarks };
    } catch (error) {
        console.error("Final JSON Parsing Error:", error.message);
        throw new Error('Failed to parse the structure of the AI-generated questions.');
    }
}


//==================================================================
// 2. API ROUTES
//==================================================================

router.post('/generate', async (req, res) => {
  try {
    const { subject, chapters, timeLimit, numberOfQuestions, questionType, difficultyLevel } = req.body;
    const { _id: studentId, class: studentClass, board: studentBoard } = req.student;

    if (!studentClass || studentClass.trim() === '' || !studentBoard || studentBoard.trim() === '') {
        return res.status(400).json({ success: false, message: "Your profile is missing Class or Board information, which is required to generate a test." });
    }
    const prompt = createGeminiPrompt({ subject, chapters, numberOfQuestions, questionType, difficultyLevel, studentClass, studentBoard });
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro-latest' });
    const result = await model.generateContent(prompt);
    const parsedTest = parseGeminiResponse(result.response.text());
    const mockTest = new MockTest({
      studentId, title: `${subject} Mock: ${chapters.join(', ')}`, subject, chapters,
      studentClass, studentBoard, questionType, difficultyLevel, timeLimit,
      questions: parsedTest.questions, totalMarks: parsedTest.totalMarks, geminiPrompt: prompt
    });
    await mockTest.save();
    res.status(201).json({ success: true, test: mockTest });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to generate mock test' });
  }
});

router.post('/submit', async (req, res) => {
  try {
    const { testId, answers, timeTaken, questionType } = req.body;
    const test = await MockTest.findById(testId);
    if (!test) return res.status(404).json({ success: false, message: 'Test not found' });
    
    // ✅ FIX: Initialize the payload with all common required fields.
    let resultPayload = {
        studentId: req.student._id, testId, testTitle: test.title, subject: test.subject,
        questionType, answers, totalMarks: test.totalMarks, timeTaken,
        submittedAt: new Date()
    };
    
    if (questionType === 'coding' || questionType === 'mcq') {
      let marksObtained = 0;
      const questionWiseMarks = [];

      for (let i = 0; i < test.questions.length; i++) {
        const q = test.questions[i];
        const studentAnswer = answers[i] || "";
        let obtainedMarks = 0;
        let isCorrect = false;
        let feedback = q.explanation || "";

        if (questionType === 'coding') {
          const evaluation = await evaluateCodeWithAI(q, studentAnswer);
          obtainedMarks = evaluation.obtainedMarks;
          feedback = evaluation.feedback;
          isCorrect = obtainedMarks === q.marks;
        } else { // MCQ
          isCorrect = studentAnswer === q.correctAnswer;
          obtainedMarks = isCorrect ? q.marks : 0;
        }
        marksObtained += obtainedMarks;
        questionWiseMarks.push({
          questionNo: i + 1, question: q.question, studentAnswer: studentAnswer,
          correctAnswer: q.correctAnswer, feedback: feedback, isCorrect: isCorrect,
          maxMarks: q.marks, obtainedMarks: obtainedMarks,
        });
      }
      
      // ✅ FIX: Correctly add the calculated properties to the payload
      Object.assign(resultPayload, {
          marksObtained, questionWiseMarks, status: 'completed',
          percentage: test.totalMarks > 0 ? Math.round((marksObtained / test.totalMarks) * 100) : 0,
      });

    } else { // subjective
      resultPayload.status = 'pending_evaluation';
    }
    
    const result = await MockTestResult.create(resultPayload);
    res.status(201).json({ success: true, result, message: 'Test submitted successfully' });
  } catch (error) {
    console.error('Error submitting mock test:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to submit test' });
  }
});

router.get('/history', async (req, res) => {
  try {
    const tests = await MockTestResult.find({ studentId: req.student._id }).sort({ submittedAt: -1 }).limit(20).lean();
    res.json({ success: true, tests });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch test history' });
  }
});

router.post('/evaluate-subjective', async (req, res) => {
  try {
    const { resultId, questionWiseMarks } = req.body;
    const result = await MockTestResult.findOne({ _id: resultId, studentId: req.student._id });
    if (!result) return res.status(404).json({ success: false, message: 'Test result not found' });
    if(result.status === 'completed') return res.status(400).json({ success: false, message: 'This test has already been evaluated.' });

    const marksObtained = questionWiseMarks.reduce((total, mark) => total + mark.obtainedMarks, 0);
    result.questionWiseMarks = questionWiseMarks;
    result.marksObtained = marksObtained;
    result.percentage = result.totalMarks > 0 ? Math.round((marksObtained / result.totalMarks) * 100) : 0;
    result.evaluatedAt = new Date();
    result.status = 'completed';
    
    await result.save();
    res.json({ success: true, result, message: 'Test evaluated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to evaluate test' });
  }
});

module.exports = router;