const Test = require('../models/Test');
const Result = require('../models/Result');
const judge0Service = require('../services/judge0Service');
const { authenticateStudent } = require('../middleware/auth');

class CodingTestController {
  
  // Get coding test details for student (supports both single and multi-question)
  static async getCodingTest(req, res) {
    try {
      const { testId } = req.params;
      const studentId = req.student._id;
      const test = await Test.findById(testId);
      
      if (!test) {
        return res.status(404).json({ 
          success: false, 
          message: 'Test not found' 
        });
      }

      if (!test.isCodingTest && (!test.coding || (!test.coding.enabled && !test.coding.questions))) {
        return res.status(400).json({ 
          success: false, 
          message: 'This is not a coding test' 
        });
      }

      console.log('🔍 Coding test controller - test ID:', testId);
      console.log('📊 Test has coding:', !!test.coding);
      console.log('📊 Test coding.enabled:', test.coding?.enabled);
      console.log('📊 Test coding.questions:', test.coding?.questions?.length || 0);
      console.log('📊 Test isCodingTest:', test.isCodingTest);

      // Check for existing result to support resume functionality
      let existingResult = null;
      let canResume = false;

      try {
        existingResult = await Result.findOne({ 
          studentId: studentId, 
          testId: testId 
        }).sort({ createdAt: -1 });

        if (existingResult) {
          console.log('📋 Found existing result for coding test:', {
            resultId: existingResult._id,
            status: existingResult.status,
            resumeAllowed: existingResult.resumeAllowed,
            submittedAt: existingResult.submittedAt
          });

          // Check if result allows resume
          if (existingResult.resumeAllowed === true && 
              (existingResult.status === 'pending' || existingResult.status === 'in_progress')) {
            
            // Check if timer has not expired
            const testEndTime = new Date(existingResult.testStartTime || existingResult.startedAt);
            testEndTime.setMinutes(testEndTime.getMinutes() + test.duration);
            
            if (new Date() < testEndTime) {
              canResume = true;
              console.log('🔄 Coding test can be resumed for student:', studentId);
            } else {
              console.log('⏰ Timer expired for coding test resume, will auto-submit');
              // Auto-submit expired test
              existingResult.status = 'completed';
              existingResult.submittedAt = new Date();
              existingResult.adminComments = (existingResult.adminComments || '') + 
                '\n[Auto-submitted due to time expiry on resume attempt]';
              await existingResult.save();
              canResume = false;
            }
          } else if (existingResult.status === 'completed' || existingResult.submittedAt) {
            // Already completed - don't allow access
            return res.status(400).json({
              success: false,
              message: 'You have already completed this coding test'
            });
          }
        }
      } catch (error) {
        console.warn('Error checking existing result for coding test:', error);
      }

      // Check if it's a multi-question test (enabled OR has questions)
      if (test.coding && (test.coding.enabled || test.coding.questions) && test.coding.questions && test.coding.questions.length > 0) {
        // Multi-question test
        const responseData = {
          success: true,
          _id: test._id,
          title: test.title,
          description: test.description,
          subject: test.subject,
          class: test.class,
          board: test.board,
          duration: test.duration,
          totalMarks: test.totalMarks,
          type: 'coding',
          coding: {
            enabled: true,
            allowQuestionSwitching: test.coding.allowQuestionSwitching !== false,
            showQuestionProgress: test.coding.showQuestionProgress !== false,
            questions: test.coding.questions.map(question => ({
              id: question.id,
              title: question.title,
              description: question.description,
              inputFormat: question.inputFormat,
              outputFormat: question.outputFormat,
              constraints: question.constraints,
              examples: question.examples || [],
              difficulty: question.difficulty,
              marks: question.marks,
              testCases: question.testCases.filter(tc => !tc.isHidden), // Only visible test cases
              starterCode: question.starterCode || {}
            }))
          },
          proctoringSettings: test.proctoringSettings || {
            requireFullscreen: false,
            blockRightClick: false,
            blockKeyboardShortcuts: false,
            maxViolations: 10
          },
          cameraMonitoring: test.cameraMonitoring || {
            enabled: false,
            requireCameraAccess: false,
            captureInterval: 30
          },
          // Add resume support for coding tests
          canResume: canResume,
          existingResult: canResume ? {
            _id: existingResult._id,
            status: existingResult.status,
            startedAt: existingResult.startedAt,
            resumeApprovedAt: existingResult.resumeApprovedAt
          } : null
        };

        return res.json(responseData);
      }

      // Legacy single-question test
      const languageInfo = judge0Service.getLanguageIdForBoard(test.board);
      
      // Prepare starter code
      const starterCode = test.codingProblem?.starterCode?.[languageInfo.language] || 
                         judge0Service.getStarterCode(languageInfo.language, test.codingProblem?.title);

      // Return test details without hidden test cases
      const visibleTestCases = test.codingProblem.testCases
        ?.filter(tc => !tc.isHidden)
        ?.map(tc => ({
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          explanation: tc.explanation
        })) || [];

      const responseData = {
        success: true,
        test: {
          _id: test._id,
          title: test.title,
          description: test.description,
          subject: test.subject,
          class: test.class,
          board: test.board,
          duration: test.duration,
          totalMarks: test.totalMarks,
          isCodingTest: test.isCodingTest,
          language: languageInfo.language,
          problem: {
            title: test.codingProblem?.title,
            description: test.codingProblem?.description,
            inputFormat: test.codingProblem?.inputFormat,
            outputFormat: test.codingProblem?.outputFormat,
            constraints: test.codingProblem?.constraints,
            examples: test.codingProblem?.examples || [],
            visibleTestCases: visibleTestCases,
            timeLimit: test.codingProblem?.timeLimit || 2,
            memoryLimit: test.codingProblem?.memoryLimit || 256,
            starterCode: starterCode
          }
        },
        // Add resume support for single-question tests too
        canResume: canResume,
        existingResult: canResume ? {
          _id: existingResult._id,
          status: existingResult.status,
          startedAt: existingResult.startedAt,
          resumeApprovedAt: existingResult.resumeApprovedAt
        } : null
      };

      res.json(responseData);

    } catch (error) {
      console.error('Error fetching coding test:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch test details' 
      });
    }
  }

  // Submit code for evaluation
  static async submitCode(req, res) {
    try {
      const { testId } = req.params;
      const { sourceCode, timeTaken } = req.body;
      const studentId = req.student._id;

      const test = await Test.findById(testId);
      if (!test || !test.isCodingTest) {
        return res.status(404).json({ 
          success: false, 
          message: 'Coding test not found' 
        });
      }

      // Get language for the board
      const languageInfo = judge0Service.getLanguageIdForBoard(test.board);
      
      // Run all test cases
      const evaluationResult = await judge0Service.runTestCases(
        sourceCode, 
        languageInfo.language, 
        test.codingProblem.testCases
      );

      // Calculate final score based on test.totalMarks
      const finalScore = Math.round((evaluationResult.totalScore / evaluationResult.maxScore) * test.totalMarks);

      // Save result
      const result = new Result({
        studentId: studentId,
        testId: testId,
        testTitle: test.title,
        testSubject: test.subject,
        totalMarks: test.totalMarks,
        obtainedMarks: finalScore,
        percentage: (finalScore / test.totalMarks) * 100,
        submittedAt: new Date(),
        timeTaken: timeTaken,
        status: 'completed',
        submissionType: 'coding_submission',
        codingSubmission: {
          sourceCode: sourceCode,
          language: languageInfo.language,
          testResults: evaluationResult,
          passedTestCases: evaluationResult.passedTestCases,
          totalTestCases: evaluationResult.totalTestCases
        }
      });

      await result.save();

      res.json({
        success: true,
        message: 'Code submitted successfully!',
        result: {
          score: finalScore,
          totalMarks: test.totalMarks,
          percentage: (finalScore / test.totalMarks) * 100,
          passedTests: evaluationResult.passedTestCases,
          totalTests: evaluationResult.totalTestCases,
          testResults: evaluationResult.results.map(r => ({
            testCaseNumber: r.testCaseNumber,
            passed: r.passed,
            points: r.points,
            executionTime: r.executionTime,
            ...(r.passed ? {} : {
              input: r.input,
              expectedOutput: r.expectedOutput,
              actualOutput: r.actualOutput,
              stderr: r.stderr
            })
          }))
        }
      });

    } catch (error) {
      console.error('Code submission error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to evaluate code', 
        error: error.message 
      });
    }
  }

  // Test code against visible test cases only (for students to test before submission)
  static async testCode(req, res) {
    try {
      const { testId } = req.params;
      const { sourceCode } = req.body;

      const test = await Test.findById(testId);
      if (!test || !test.isCodingTest) {
        return res.status(404).json({ 
          success: false, 
          message: 'Coding test not found' 
        });
      }

      // Get only visible test cases
      const visibleTestCases = test.codingProblem.testCases?.filter(tc => !tc.isHidden) || [];
      
      if (visibleTestCases.length === 0) {
        return res.json({
          success: true,
          message: 'No visible test cases available',
          results: []
        });
      }

      // Get language for the board
      const languageInfo = judge0Service.getLanguageIdForBoard(test.board);
      
      // Run only visible test cases
      const testResult = await judge0Service.runTestCases(
        sourceCode, 
        languageInfo.language, 
        visibleTestCases
      );

      res.json({
        success: true,
        results: testResult.results.map(r => ({
          testCaseNumber: r.testCaseNumber,
          input: r.input,
          expectedOutput: r.expectedOutput,
          actualOutput: r.actualOutput,
          passed: r.passed,
          executionTime: r.executionTime,
          memory: r.memory,
          stderr: r.stderr
        })),
        summary: {
          passedTests: testResult.passedTestCases,
          totalTests: testResult.totalTestCases,
          percentage: testResult.percentage
        }
      });

    } catch (error) {
      console.error('Code testing error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to test code', 
        error: error.message 
      });
    }
  }

  // Get available programming languages
  static async getLanguages(req, res) {
    try {
      const languages = await judge0Service.getLanguages();
      res.json({
        success: true,
        languages: languages
      });
    } catch (error) {
      console.error('Error fetching languages:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch languages' 
      });
    }
  }

  // Check Judge0 service status
  static async checkServiceStatus(req, res) {
    try {
      const about = await judge0Service.getAbout();
      res.json({
        success: true,
        service: about
      });
    } catch (error) {
      console.error('Judge0 service error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Judge0 service unavailable' 
      });
    }
  }

  // Test code for a specific question in multi-question test
  static async testQuestionCode(req, res) {
    try {
      const { testId } = req.params;
      const { questionId, code, language, testCases } = req.body;

      console.log('🔍 Testing question code:', { testId, questionId, language, codeLength: code?.length });

      const test = await Test.findById(testId);
      if (!test) {
        console.log('❌ Test not found:', testId);
        return res.status(404).json({ 
          success: false, 
          message: 'Test not found' 
        });
      }

      // Check if test has coding section
      if (!test.coding || !test.coding.questions || test.coding.questions.length === 0) {
        console.log('❌ Invalid coding test structure:', {
          hasCoding: !!test.coding,
          hasQuestions: !!test.coding?.questions,
          questionsLength: test.coding?.questions?.length
        });
        return res.status(404).json({ 
          success: false, 
          message: 'This test does not have coding questions' 
        });
      }

      console.log('✅ Test found with coding questions:', test.coding.questions.length);

      // Find the specific question
      const question = test.coding.questions.find(q => q.id === questionId);
      if (!question) {
        console.log('❌ Question not found:', { questionId, availableQuestions: test.coding.questions.map(q => q.id) });
        return res.status(404).json({
          success: false,
          message: 'Question not found'
        });
      }

      console.log('✅ Question found:', { 
        questionId, 
        hasTestCases: !!question.testCases,
        testCasesLength: question.testCases?.length || 0,
        sampleTestCases: question.testCases?.slice(0, 2) || [], // Show first 2 test cases for debugging
        questionStructure: Object.keys(question) // Show what properties the question has
      });

      // Use provided test cases or filter visible ones from question
      // For regular testing, include hidden test cases too if no visible ones exist
      let testCasesToRun = [];
      
      if (testCases) {
        // If test cases are explicitly provided, use them
        testCasesToRun = testCases;
      } else {
        // First try to get visible test cases
        testCasesToRun = question.testCases?.filter(tc => !tc.isHidden) || [];
        
        // If no visible test cases, allow hidden ones for testing (but limit to first few)
        if (testCasesToRun.length === 0 && question.testCases?.length > 0) {
          console.log('⚠️ No visible test cases found, using hidden ones for testing');
          testCasesToRun = question.testCases.slice(0, 3); // Limit to first 3 hidden test cases
        }
      }
      
      console.log('🔍 Test cases analysis:', {
        providedTestCases: !!testCases,
        questionTestCases: question.testCases?.length || 0,
        filteredTestCases: testCasesToRun.length,
        firstTestCase: testCasesToRun[0] || null
      });

      if (testCasesToRun.length === 0) {
        console.log('⚠️ No test cases to run');
        return res.json({
          success: true,
          message: 'No visible test cases available',
          results: [],
          passedTestCases: 0,
          totalTestCases: 0,
          percentage: 0
        });
      }

      console.log('🚀 Running test cases:', { count: testCasesToRun.length, language });

      // Run test cases
      const testResult = await judge0Service.runTestCases(
        code,
        language,
        testCasesToRun
      );

      console.log('✅ Test results:', { 
        passed: testResult.passedTestCases, 
        total: testResult.totalTestCases,
        percentage: testResult.percentage
      });

      res.json({
        success: true,
        results: testResult.results.map(r => ({
          testCaseNumber: r.testCaseNumber,
          passed: r.passed,
          input: r.input,
          expectedOutput: r.expectedOutput,
          actualOutput: r.actualOutput,
          executionTime: r.executionTime,
          memory: r.memory,
          stderr: r.stderr
        })),
        passedTestCases: testResult.passedTestCases,
        totalTestCases: testResult.totalTestCases,
        percentage: testResult.percentage
      });

    } catch (error) {
      console.error('💥 Question code testing error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to test code', 
        error: error.message 
      });
    }
  }

  // Submit multi-question coding test
  static async submitMultiQuestionTest(req, res) {
    try {
      const { testId } = req.params;
      const { 
        language, 
        questions, 
        violations = [], 
        totalViolations = 0, 
        monitoringImages = [],
        cameraMonitoring = false,
        proctoringSettings = {},
        timeTaken = 0,
        submissionTime
      } = req.body; // Include monitoring data
      const studentId = req.student._id;

      console.log('🔍 Submitting multi-question test:', { 
        testId, 
        studentId, 
        language, 
        questionsCount: questions?.length,
        violations: totalViolations,
        monitoringImages: monitoringImages.length
      });

      const test = await Test.findById(testId);
      if (!test) {
        console.log('❌ Test not found:', testId);
        return res.status(404).json({ 
          success: false, 
          message: 'Test not found' 
        });
      }

      // Check if test has coding section
      if (!test.coding || !test.coding.questions || test.coding.questions.length === 0) {
        console.log('❌ Invalid coding test structure for submission:', {
          hasCoding: !!test.coding,
          hasQuestions: !!test.coding?.questions,
          questionsLength: test.coding?.questions?.length
        });
        return res.status(404).json({ 
          success: false, 
          message: 'This test does not have coding questions' 
        });
      }

      console.log('✅ Test found with coding questions:', test.coding.questions.length);

      const questionResults = [];
      let totalScore = 0;
      let maxPossibleScore = 0;

      // Process each question
      for (const submissionQuestion of questions) {
        const testQuestion = test.coding.questions.find(q => q.id === submissionQuestion.questionId);
        if (!testQuestion) continue;

        maxPossibleScore += testQuestion.marks;

        if (!submissionQuestion.code || submissionQuestion.code.trim() === '') {
          // Empty submission
          questionResults.push({
            questionId: submissionQuestion.questionId,
            questionTitle: testQuestion.title || `Question ${submissionQuestion.questionId}`,
            code: submissionQuestion.code || '',
            language: language,
            score: 0,
            maxScore: testQuestion.marks,
            passedTestCases: 0,
            totalTestCases: testQuestion.testCases.length,
            results: [],
            executionTime: 0,
            codeQuality: {
              linesOfCode: 0,
              complexity: 'low'
            }
          });
          continue;
        }

        try {
          // Run all test cases (including hidden ones)
          const evaluationResult = await judge0Service.runTestCases(
            submissionQuestion.code,
            language,
            testQuestion.testCases
          );

          // Calculate score for this question
          const questionScore = Math.round(
            (evaluationResult.passedTestCases / evaluationResult.totalTestCases) * testQuestion.marks
          );
          totalScore += questionScore;

          // Calculate code quality metrics
          const codeLines = submissionQuestion.code.split('\n').filter(line => line.trim()).length;
          const complexity = codeLines > 50 ? 'high' : codeLines > 20 ? 'medium' : 'low';

          // Calculate percentage for this question
          const questionPercentage = evaluationResult.totalTestCases > 0 
            ? (evaluationResult.passedTestCases / evaluationResult.totalTestCases) * 100 
            : 0;

          // Map evaluation results to test cases format expected by frontend
          const testCases = evaluationResult.results.map((result, index) => ({
            input: result.input || '',
            expectedOutput: result.expected_output || '',
            actualOutput: result.stdout || result.stderr || '',
            passed: result.status === 'passed',
            executionTime: parseFloat(result.time) || 0,
            memory: result.memory || 0,
            points: result.status === 'passed' ? (testQuestion.marks / evaluationResult.totalTestCases) : 0,
            error: result.stderr || (result.status === 'failed' ? result.compile_output || 'Execution failed' : '')
          }));

          questionResults.push({
            questionId: submissionQuestion.questionId,
            questionTitle: testQuestion.title || `Question ${submissionQuestion.questionId}`,
            code: submissionQuestion.code,
            language: language,
            score: questionScore,
            maxScore: testQuestion.marks,
            percentage: questionPercentage,
            passedTestCases: evaluationResult.passedTestCases,
            totalTestCases: evaluationResult.totalTestCases,
            testCases: testCases,
            results: evaluationResult.results,
            executionTime: evaluationResult.results.reduce((sum, r) => sum + (parseFloat(r.executionTime) || 0), 0),
            codeQuality: {
              linesOfCode: codeLines,
              complexity: complexity,
              hasComments: /\/\/|\/\*|\#/.test(submissionQuestion.code)
            }
          });

        } catch (error) {
          console.error(`Error evaluating question ${submissionQuestion.questionId}:`, error);
          questionResults.push({
            questionId: submissionQuestion.questionId,
            questionTitle: testQuestion.title || `Question ${submissionQuestion.questionId}`,
            code: submissionQuestion.code,
            language: language,
            score: 0,
            maxScore: testQuestion.marks,
            percentage: 0,
            passedTestCases: 0,
            totalTestCases: testQuestion.testCases.length,
            testCases: [], // Empty test cases for error case
            results: [],
            executionTime: 0,
            error: error.message,
            codeQuality: {
              linesOfCode: 0,
              complexity: 'low'
            }
          });
        }
      }

      // Calculate overall metrics
      const totalPassedTestCases = questionResults.reduce((sum, qr) => sum + qr.passedTestCases, 0);
      const totalTestCases = questionResults.reduce((sum, qr) => sum + qr.totalTestCases, 0);
      const overallPercentage = maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 100 : 0;

      // Save result
      const result = new Result({
        studentId: studentId,
        testId: testId,
        testTitle: test.title,
        testSubject: test.subject,
        totalMarks: maxPossibleScore,
        marksObtained: totalScore,
        percentage: overallPercentage,
        submittedAt: new Date(submissionTime || Date.now()),
        status: 'done', // Set to done after coding test is attempted
        submissionType: 'multi_question_coding',
        timeTaken: timeTaken,
        // Include monitoring and proctoring data
        violations: violations,
        totalViolations: totalViolations,
        monitoringImages: monitoringImages,
        cameraMonitoring: cameraMonitoring,
        proctoringSettings: proctoringSettings,
        codingResults: {
          totalQuestions: test.coding.questions.length,
          questionsAttempted: questionResults.filter(qr => qr.code && qr.code.trim()).length,
          questionsCompleted: questionResults.filter(qr => qr.passedTestCases > 0).length,
          totalTestCases: totalTestCases,
          passedTestCases: totalPassedTestCases,
          totalScore: totalScore,
          maxScore: maxPossibleScore,
          questionResults: questionResults,
          overallPerformance: {
            accuracy: totalTestCases > 0 ? (totalPassedTestCases / totalTestCases) * 100 : 0,
            efficiency: totalPassedTestCases / totalTestCases > 0.8 ? 'excellent' : 
                       totalPassedTestCases / totalTestCases > 0.6 ? 'good' :
                       totalPassedTestCases / totalTestCases > 0.4 ? 'average' : 'poor',
            codeQuality: 'average', // Default value
            timeManagement: 'average' // Default value
          }
        }
      });

      await result.save();

      res.json({
        success: true,
        message: 'Multi-question coding test submitted successfully!',
        resultId: result._id, // Include the result ID for monitoring system
        result: {
          score: totalScore,
          totalMarks: maxPossibleScore,
          percentage: overallPercentage,
          questionsAttempted: questionResults.filter(qr => qr.code && qr.code.trim()).length,
          totalQuestions: test.coding.questions.length,
          passedTests: totalPassedTestCases,
          totalTests: totalTestCases,
          questionResults: questionResults.map(qr => ({
            questionId: qr.questionId,
            score: qr.score,
            maxScore: qr.maxScore,
            passedTestCases: qr.passedTestCases,
            totalTestCases: qr.totalTestCases,
            codeQuality: qr.codeQuality
          }))
        }
      });

    } catch (error) {
      console.error('Multi-question test submission error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to evaluate multi-question test', 
        error: error.message 
      });
    }
  }
}

module.exports = CodingTestController;
