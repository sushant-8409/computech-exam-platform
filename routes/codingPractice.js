const express = require('express');
const router = express.Router();
const CodingProblem = require('../models/CodingProblem');
const ProblemGroup = require('../models/ProblemGroup');
const StudentSubmission = require('../models/StudentSubmission');
const StudyPlanProgress = require('../models/StudyPlanProgress');
const ProblemNotes = require('../models/ProblemNotes');
const pistonService = require('../services/pistonService');
const { authenticateStudent, authenticateAdmin } = require('../middleware/auth');

// =============================================================================
// ADMIN ROUTES - Problem Management
// =============================================================================

// Get all problems (admin)
router.get('/admin/problems', authenticateAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, difficulty, search, sortBy = 'problemNumber' } = req.query;
    
    let query = {};
    if (difficulty) query.difficulty = difficulty;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { topics: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    const problems = await CodingProblem.find(query)
      .sort({ [sortBy]: sortBy === 'problemNumber' ? 1 : -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await CodingProblem.countDocuments(query);

    res.json({
      success: true,
      problems,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Error fetching problems:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch problems' });
  }
});

// Create single problem (admin)
router.post('/admin/problems', authenticateAdmin, async (req, res) => {
  try {
    const problemData = req.body;
    problemData.createdBy = req.user.email;
    
    // Auto-assign problem number if not provided
    if (!problemData.problemNumber) {
      problemData.problemNumber = await CodingProblem.getNextProblemNumber();
    }

    const problem = new CodingProblem(problemData);
    await problem.save();

    res.status(201).json({
      success: true,
      message: 'Problem created successfully',
      problem
    });
  } catch (error) {
    console.error('Error creating problem:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create problem',
      error: error.message 
    });
  }
});

// Bulk create problems from JSON (admin)
router.post('/admin/problems/bulk', authenticateAdmin, async (req, res) => {
  try {
    const { problems } = req.body;
    
    if (!Array.isArray(problems)) {
      return res.status(400).json({
        success: false,
        message: 'Problems must be an array'
      });
    }

    let nextProblemNumber = await CodingProblem.getNextProblemNumber();
    const createdProblems = [];
    const errors = [];

    for (let i = 0; i < problems.length; i++) {
      try {
        const problemData = problems[i];
        problemData.createdBy = req.user.email;
        problemData.problemNumber = nextProblemNumber++;

        const problem = new CodingProblem(problemData);
        await problem.save();
        createdProblems.push(problem);
      } catch (error) {
        errors.push({
          index: i,
          problem: problems[i].title || `Problem ${i + 1}`,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      message: `${createdProblems.length} problems created successfully`,
      created: createdProblems.length,
      errors: errors.length,
      problemErrors: errors
    });
  } catch (error) {
    console.error('Error bulk creating problems:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to bulk create problems' 
    });
  }
});

// Update problem (admin)
router.put('/admin/problems/:id', authenticateAdmin, async (req, res) => {
  try {
    const problem = await CodingProblem.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!problem) {
      return res.status(404).json({
        success: false,
        message: 'Problem not found'
      });
    }

    res.json({
      success: true,
      message: 'Problem updated successfully',
      problem
    });
  } catch (error) {
    console.error('Error updating problem:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update problem' 
    });
  }
});

// Delete problem (admin) - with proper numbering management
router.delete('/admin/problems/:id', authenticateAdmin, async (req, res) => {
  try {
    const problemToDelete = await CodingProblem.findById(req.params.id);
    
    if (!problemToDelete) {
      return res.status(404).json({
        success: false,
        message: 'Problem not found'
      });
    }

    const deletedProblemNumber = problemToDelete.problemNumber;

    // Remove the problem
    await CodingProblem.findByIdAndDelete(req.params.id);

    // Remove from all groups
    await ProblemGroup.updateMany(
      { problems: problemToDelete._id },
      { $pull: { problems: problemToDelete._id } }
    );

    // Clean up related submissions and comments
    const StudentSubmission = require('../models/StudentSubmission');
    const ProblemComment = require('../models/ProblemComment');
    
    // Remove submissions for this problem (optional - you may want to keep for historical data)
    // await StudentSubmission.deleteMany({ problemId: problemToDelete._id });
    
    // Remove comments for this problem
    await ProblemComment.deleteMany({ problemId: problemToDelete._id });

    // Renumber all problems that have higher problem numbers
    // This ensures continuous numbering without gaps
    await CodingProblem.updateMany(
      { problemNumber: { $gt: deletedProblemNumber } },
      { $inc: { problemNumber: -1 } }
    );

    res.json({
      success: true,
      message: 'Problem deleted successfully and numbering updated'
    });
  } catch (error) {
    console.error('Error deleting problem:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete problem' 
    });
  }
});

// =============================================================================
// ADMIN ROUTES - Group Management
// =============================================================================

// Get all groups (admin)
router.get('/admin/groups', authenticateAdmin, async (req, res) => {
  try {
    const groups = await ProblemGroup.find()
      .populate('problems', 'problemNumber title difficulty')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      groups
    });
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch groups' });
  }
});

// Create group (admin)
router.post('/admin/groups', authenticateAdmin, async (req, res) => {
  try {
    const groupData = req.body;
    groupData.createdBy = req.user.email;

    const group = new ProblemGroup(groupData);
    await group.save();

    res.status(201).json({
      success: true,
      message: 'Group created successfully',
      group
    });
  } catch (error) {
    console.error('Error creating group:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create group',
      error: error.message 
    });
  }
});

// Add problems to group (admin)
router.post('/admin/groups/:id/problems', authenticateAdmin, async (req, res) => {
  try {
    const { problemIds } = req.body;
    const group = await ProblemGroup.findById(req.params.id);

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    // Add problems to group (avoid duplicates)
    const newProblems = problemIds.filter(id => !group.problems.includes(id));
    group.problems.push(...newProblems);
    await group.updateProblemCount();

    const updatedGroup = await ProblemGroup.findById(req.params.id)
      .populate('problems', 'problemNumber title difficulty');

    res.json({
      success: true,
      message: `${newProblems.length} problems added to group`,
      group: updatedGroup
    });
  } catch (error) {
    console.error('Error adding problems to group:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to add problems to group' 
    });
  }
});

// Update group (admin)
router.put('/admin/groups/:id', authenticateAdmin, async (req, res) => {
  try {
    const { name, description, difficulty, allowedStudentClasses } = req.body;
    
    const updatedGroup = await ProblemGroup.findByIdAndUpdate(
      req.params.id,
      {
        name,
        description,
        difficulty,
        allowedStudentClasses
      },
      { new: true }
    ).populate('problems', 'problemNumber title difficulty');

    if (!updatedGroup) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    res.json({
      success: true,
      message: 'Group updated successfully',
      group: updatedGroup
    });
  } catch (error) {
    console.error('Error updating group:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update group',
      error: error.message 
    });
  }
});

// Delete group (admin)
router.delete('/admin/groups/:id', authenticateAdmin, async (req, res) => {
  try {
    const deletedGroup = await ProblemGroup.findByIdAndDelete(req.params.id);

    if (!deletedGroup) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    res.json({
      success: true,
      message: 'Group deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting group:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete group',
      error: error.message 
    });
  }
});

// Get user notes for a problem
router.get('/problems/:problemId/notes', authenticateStudent, async (req, res) => {
  try {
    const { problemId } = req.params;
    const studentId = req.student._id;

    // Find existing notes
    const notes = await ProblemNotes.findOne({ studentId, problemId });
    
    res.json({
      success: true,
      notes: notes?.content || ''
    });
  } catch (error) {
    console.error('Error fetching notes:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch notes',
      error: error.message 
    });
  }
});

// Save user notes for a problem
router.post('/problems/:problemId/notes', authenticateStudent, async (req, res) => {
  try {
    const { problemId } = req.params;
    const { notes } = req.body;
    const studentId = req.student._id;

    // Update or create notes
    const updatedNotes = await ProblemNotes.findOneAndUpdate(
      { studentId, problemId },
      { 
        studentId, 
        problemId, 
        content: notes,
        updatedAt: new Date()
      },
      { 
        upsert: true, 
        new: true 
      }
    );

    res.json({
      success: true,
      message: 'Notes saved successfully',
      notes: updatedNotes
    });
  } catch (error) {
    console.error('Error saving notes:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to save notes',
      error: error.message 
    });
  }
});

// Remove problem from group (admin)
router.delete('/admin/groups/:groupId/problems/:problemId', authenticateAdmin, async (req, res) => {
  try {
    const group = await ProblemGroup.findById(req.params.groupId);
    
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    await group.removeProblem(req.params.problemId);

    res.json({
      success: true,
      message: 'Problem removed from group'
    });
  } catch (error) {
    console.error('Error removing problem from group:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to remove problem from group' 
    });
  }
});

// =============================================================================
// STUDENT ROUTES - Problem Browsing
// =============================================================================

// Get student dashboard stats
router.get('/student/dashboard', authenticateStudent, async (req, res) => {
  try {
    const studentId = req.user.id;
    
    // Get student statistics
    const stats = await StudentSubmission.getStudentStats(studentId);
    const languageStats = await StudentSubmission.getLanguageStats(studentId);
    
    // Get student rank information
    const rank = await StudentSubmission.getStudentRank(studentId);
    
    // Enhance stats with rank information
    const enhancedStats = {
      ...stats,
      rank: rank?.rank || null,
      totalScore: rank?.totalScore || 0,
      easyProblems: rank?.easyProblems || 0,
      mediumProblems: rank?.mediumProblems || 0,
      hardProblems: rank?.hardProblems || 0,
      problemsSolved: rank?.problemsSolved || stats?.solvedProblems || 0
    };
    
    // Get recent submissions
    const recentSubmissions = await StudentSubmission.find({ studentId })
      .populate('problemId', 'problemNumber title difficulty')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    // Get available groups for student's class
    const studentClass = req.student?.class || req.user.class;
    const availableGroups = await ProblemGroup.find({
      isActive: true,
      $or: [
        { allowedStudentClasses: { $in: [studentClass] } },
        { allowedStudentClasses: { $size: 0 } } // Open to all
      ]
    }).populate('problems', 'problemNumber title difficulty').lean();

    // Get study plan progress for each group
    const studyPlanProgresses = await StudyPlanProgress.find({ 
      studentId,
      groupId: { $in: availableGroups.map(g => g._id) }
    }).lean();

    // Enhance groups with progress data
    const groupsWithProgress = availableGroups.map(group => {
      const progress = studyPlanProgresses.find(p => p.groupId.toString() === group._id.toString());
      
      return {
        ...group,
        studentProgress: progress ? {
          status: progress.status,
          startedAt: progress.startedAt,
          completedAt: progress.completedAt,
          solvedProblems: progress.solvedProblems.length,
          totalProblems: group.problems.length,
          progressPercentage: group.problems.length > 0 ? 
            Math.round((progress.solvedProblems.length / group.problems.length) * 100) : 0,
          rank: progress.rank,
          currentStreak: progress.currentStreak,
          maxStreak: progress.maxStreak,
          lastAccessedAt: progress.lastAccessedAt
        } : null
      };
    });

    res.json({
      success: true,
      dashboard: {
        stats: enhancedStats,
        languageStats,
        recentSubmissions,
        availableGroups: groupsWithProgress
      }
    });
  } catch (error) {
    console.error('Error fetching student dashboard:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch dashboard data' 
    });
  }
});

// =============================================================================
// STUDY PLAN ROUTES
// =============================================================================

// Start a study plan
router.post('/student/study-plans/:groupId/start', authenticateStudent, async (req, res) => {
  try {
    const { groupId } = req.params;
    const studentId = req.user.id;

    // Check if group exists and is accessible
    const studentClass = req.student?.class || req.user.class;
    const group = await ProblemGroup.findOne({
      _id: groupId,
      isActive: true,
      $or: [
        { allowedStudentClasses: { $in: [studentClass] } },
        { allowedStudentClasses: { $size: 0 } } // Open to all
      ]
    }).populate('problems');

    if (!group) {
      return res.status(404).json({ 
        success: false, 
        message: 'Study plan not found or not accessible' 
      });
    }

    // Check if already started
    let progress = await StudyPlanProgress.findOne({ studentId, groupId });
    
    if (progress) {
      // Resume existing study plan
      progress.status = 'active';
      progress.lastAccessedAt = new Date();
      await progress.save();
      
      return res.json({
        success: true,
        message: 'Study plan resumed successfully',
        progress: {
          ...progress.toObject(),
          progressPercentage: progress.progressPercentage,
          isCompleted: progress.isCompleted
        }
      });
    }

    // Create new study plan progress
    progress = new StudyPlanProgress({
      studentId,
      groupId,
      totalProblems: group.problems.length,
      status: 'active'
    });

    await progress.save();

    res.json({
      success: true,
      message: 'Study plan started successfully',
      progress: {
        ...progress.toObject(),
        progressPercentage: progress.progressPercentage,
        isCompleted: progress.isCompleted
      }
    });
  } catch (error) {
    console.error('Error starting study plan:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to start study plan' 
    });
  }
});

// Get study plan progress
router.get('/student/study-plans/:groupId/progress', authenticateStudent, async (req, res) => {
  try {
    const { groupId } = req.params;
    const studentId = req.user.id;

    const progress = await StudyPlanProgress.findOne({ studentId, groupId })
      .populate('solvedProblems', 'problemNumber title difficulty')
      .lean();

    if (!progress) {
      return res.status(404).json({ 
        success: false, 
        message: 'Study plan not started yet' 
      });
    }

    // Get group details
    const group = await ProblemGroup.findById(groupId)
      .populate('problems', 'problemNumber title difficulty')
      .lean();

    res.json({
      success: true,
      progress: {
        ...progress,
        progressPercentage: group.problems.length > 0 ? 
          Math.round((progress.solvedProblems.length / group.problems.length) * 100) : 0,
        isCompleted: progress.status === 'completed' || 
          (group.problems.length > 0 && progress.solvedProblems.length >= group.problems.length),
        group: {
          name: group.name,
          description: group.description,
          totalProblems: group.problems.length,
          difficulty: group.difficulty
        }
      }
    });
  } catch (error) {
    console.error('Error fetching study plan progress:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch study plan progress' 
    });
  }
});

// Get study plan rankings
router.get('/student/study-plans/:groupId/rankings', authenticateStudent, async (req, res) => {
  try {
    const { groupId } = req.params;
    
    const rankings = await StudyPlanProgress.find({ groupId })
      .populate('studentId', 'name email class')
      .sort({ 'solvedProblems.length': -1, startedAt: 1 })
      .limit(50)
      .lean();

    // Add rank numbers
    const rankedList = rankings.map((progress, index) => ({
      ...progress,
      rank: index + 1,
      progressPercentage: progress.totalProblems > 0 ? 
        Math.round((progress.solvedProblems.length / progress.totalProblems) * 100) : 0
    }));

    res.json({
      success: true,
      rankings: rankedList
    });
  } catch (error) {
    console.error('Error fetching study plan rankings:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch rankings' 
    });
  }
});

// Get problems for student (with progress)
router.get('/student/problems', authenticateStudent, async (req, res) => {
  try {
    const { groupId, difficulty, page = 1, limit = 20, search, topic } = req.query;
    const studentId = req.user.id;

    let query = { isActive: true };
    
    // Filter by group
    if (groupId) {
      const group = await ProblemGroup.findById(groupId);
      if (group) {
        query._id = { $in: group.problems };
      }
    }
    
    // Filter by difficulty
    if (difficulty) {
      query.difficulty = difficulty;
    }

    // Filter by specific topic/tag
    if (topic && topic !== 'all') {
      query.topics = { $in: [topic] };
    }
    
    // Search filter
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { topics: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    const problems = await CodingProblem.find(query)
      .select('problemNumber title difficulty topics acceptanceRate totalSubmissions')
      .sort({ problemNumber: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    // Get student's progress for these problems
    const problemIds = problems.map(p => p._id);
    const submissions = await StudentSubmission.find({
      studentId,
      problemId: { $in: problemIds }
    }).lean();

    // Create a map of problem progress
    const progressMap = {};
    submissions.forEach(sub => {
      const problemId = sub.problemId.toString();
      if (!progressMap[problemId] || sub.createdAt > progressMap[problemId].createdAt) {
        progressMap[problemId] = {
          status: sub.status,
          attempts: progressMap[problemId] ? progressMap[problemId].attempts + 1 : 1,
          bestScore: Math.max(progressMap[problemId]?.bestScore || 0, sub.score),
          createdAt: sub.createdAt,
          hasSolved: (progressMap[problemId]?.hasSolved || sub.status === 'Accepted')
        };
      }
    });

    // Combine problems with progress
    const problemsWithProgress = problems.map(problem => ({
      ...problem,
      progress: progressMap[problem._id.toString()] || {
        status: 'Not Attempted',
        attempts: 0,
        bestScore: 0,
        hasSolved: false
      }
    }));

    const total = await CodingProblem.countDocuments(query);

    res.json({
      success: true,
      problems: problemsWithProgress,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Error fetching problems for student:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch problems' 
    });
  }
});

// Get unique topics available for the student (optionally scoped to a group)
router.get('/student/topics', authenticateStudent, async (req, res) => {
  try {
    const { groupId, search } = req.query;
    let problemQuery = { isActive: true };

    // Scope by group if provided
    if (groupId && groupId !== 'all') {
      const group = await ProblemGroup.findById(groupId);
      if (group) {
        problemQuery._id = { $in: group.problems };
      }
    }

    // Optional search over topic names
    if (search) {
      problemQuery.topics = { $in: [new RegExp(search, 'i')] };
    }

    const topicsAgg = await CodingProblem.aggregate([
      { $match: problemQuery },
      { $unwind: '$topics' },
      { $group: { _id: { $toLower: '$topics' }, label: { $first: '$topics' }, count: { $sum: 1 } } },
      { $sort: { label: 1 } }
    ]);

    res.json({ success: true, topics: topicsAgg.map(t => ({ key: t._id, label: t.label, count: t.count })) });
  } catch (error) {
    console.error('Error fetching topics:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch topics' });
  }
});

// Get single problem details for student
router.get('/student/problems/:id', authenticateStudent, async (req, res) => {
  try {
    const problemId = req.params.id;
    const studentId = req.user.id;

    const problem = await CodingProblem.findById(problemId).lean();
    if (!problem) {
      return res.status(404).json({
        success: false,
        message: 'Problem not found'
      });
    }

    // Get student's submissions for this problem
    const submissions = await StudentSubmission.find({
      studentId,
      problemId
    }).sort({ createdAt: -1 }).limit(5).lean();

    // Determine if student has solved the problem
    const hasSolved = submissions.some(s => s.status === 'Accepted');

    // Filter test cases (show only sample test cases)
    const sampleTestCases = problem.testCases.filter(tc => !tc.isHidden);

    // Prepare problem payload. Hide official solution unless solved
    const safeProblem = { ...problem, testCases: sampleTestCases };
    if (!hasSolved && safeProblem.solution) {
      // Strip solution content for unsolved students
      safeProblem.solution = undefined;
    }

    res.json({
      success: true,
      problem: safeProblem,
      submissions,
      hasSolved
    });
  } catch (error) {
    console.error('Error fetching problem details:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch problem details' 
    });
  }
});

// =============================================================================
// CODE EXECUTION ROUTES
// =============================================================================

// Run code (sample test cases only)
router.post('/student/problems/:id/run', authenticateStudent, async (req, res) => {
  try {
    const { language, code } = req.body;
    const problemId = req.params.id;
    const studentId = req.user.id;

    const problem = await CodingProblem.findById(problemId);
    if (!problem) {
      return res.status(404).json({
        success: false,
        message: 'Problem not found'
      });
    }

    // Get only sample test cases for running
    const sampleTestCases = problem.testCases.filter(tc => !tc.isHidden);
    
    if (sampleTestCases.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No sample test cases available'
      });
    }

    // Execute code with sample test cases
    const result = await pistonService.runTestCases(language, code, sampleTestCases);

    // Save as 'run' submission (not counted towards final score)
    const submission = new StudentSubmission({
      studentId,
      problemId,
      language,
      code,
      submissionType: 'run',
      status: result.status,
      totalTestCases: result.totalTestCases,
      passedTestCases: result.passedTestCases,
      failedTestCases: result.failedTestCases,
      score: result.totalScore,
      maxScore: result.maxScore,
      percentage: result.percentage,
      executionTime: result.avgExecutionTime,
      memoryUsed: result.maxMemoryUsed,
      testCaseResults: result.results
    });

    await submission.save();

    // Create a readable output summary
    const outputSummary = `Sample Test Results:\n${result.results.map((test, index) => 
      `Test ${index + 1}: ${test.passed ? '✅ PASSED' : '❌ FAILED'}\n` +
      `Input: ${test.input}\n` +
      `Expected: ${test.expectedOutput}\n` +
      `Got: ${test.actualOutput}\n` +
      (test.stderr ? `Error: ${test.stderr}\n` : '') +
      `---`
    ).join('\n')}`;

    res.json({
      success: true,
      message: 'Code executed successfully',
      output: outputSummary,
      result: {
        status: result.status,
        passedTestCases: result.passedTestCases,
        totalTestCases: result.totalTestCases,
        testResults: result.results,
        executionTime: result.avgExecutionTime,
        memoryUsed: result.maxMemoryUsed
      }
    });
  } catch (error) {
    console.error('Error running code:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to execute code',
      error: error.message 
    });
  }
});

// Submit code (all test cases)
router.post('/student/problems/:id/submit', authenticateStudent, async (req, res) => {
  try {
    const { language, code, timeSpent = 0 } = req.body;
    const problemId = req.params.id;
    const studentId = req.user.id;

    // Ensure student data is synced for rankings (run in background)
    try {
      const StudentDataSync = require('../services/studentDataSync');
      const sync = new StudentDataSync();
      // Don't await - run in background to not slow down submission
      sync.syncStudents().catch(console.error);
    } catch (syncError) {
      // Ignore sync errors to not break submission flow
      console.warn('Student sync failed:', syncError.message);
    }

    const problem = await CodingProblem.findById(problemId);
    if (!problem) {
      return res.status(404).json({
        success: false,
        message: 'Problem not found'
      });
    }

    // Execute code with all test cases
    const result = await pistonService.runTestCases(language, code, problem.testCases);

    // Update problem statistics
    problem.totalSubmissions += 1;
    if (result.status === 'Accepted') {
      problem.acceptedSubmissions += 1;
    }
    await problem.updateAcceptanceRate();

    // Save submission
    const submission = new StudentSubmission({
      studentId,
      problemId,
      language,
      code,
      submissionType: 'submit',
      status: result.status,
      totalTestCases: result.totalTestCases,
      passedTestCases: result.passedTestCases,
      failedTestCases: result.failedTestCases,
      score: result.totalScore,
      maxScore: result.maxScore,
      percentage: result.percentage,
      executionTime: result.avgExecutionTime,
      memoryUsed: result.maxMemoryUsed,
      testCaseResults: result.results,
      timeSpent
    });

    await submission.save();

    // Update study plan progress if problem is solved
    if (submission.status === 'Accepted') {
      try {
        // Find all study plans that include this problem
        const groups = await ProblemGroup.find({ problems: problemId }).lean();
        
        for (const group of groups) {
          const progress = await StudyPlanProgress.findOne({ 
            studentId, 
            groupId: group._id 
          });
          
          if (progress) {
            await progress.addSolvedProblem(problemId);
            // Update rank after solving a problem
            await progress.updateRank();
          }
        }
      } catch (studyPlanError) {
        console.error('Error updating study plan progress:', studyPlanError);
        // Don't fail the submission if study plan update fails
      }
    }

    res.json({
      success: true,
      message: 'Code submitted successfully',
      submission: {
        id: submission._id,
        status: submission.status,
        score: submission.score,
        maxScore: submission.maxScore,
        percentage: submission.percentage,
        passedTestCases: submission.passedTestCases,
        totalTestCases: submission.totalTestCases,
        executionTime: submission.executionTime,
        submittedCode: submission.code,
        language: submission.language,
        testCaseResults: submission.testCaseResults
        },
        hasSolved: submission.status === 'Accepted'
    });
  } catch (error) {
    console.error('Error submitting code:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to submit code',
      error: error.message 
    });
  }
});

// Get starter code
router.get('/student/problems/:id/starter/:language', authenticateStudent, async (req, res) => {
  try {
    const { language } = req.params;
    const problemId = req.params.id;

    const problem = await CodingProblem.findById(problemId);
    if (!problem) {
      return res.status(404).json({
        success: false,
        message: 'Problem not found'
      });
    }

    // Check if problem has custom starter code
    let starterCode = problem.starterCode?.[language];
    
    // If no custom starter code, generate default
    if (!starterCode) {
      starterCode = pistonService.getStarterCode(language, problem.title);
    }

    res.json({
      success: true,
      starterCode
    });
  } catch (error) {
    console.error('Error getting starter code:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get starter code' 
    });
  }
});

// Get available groups for student
router.get('/student/groups', authenticateStudent, async (req, res) => {
  try {
    const studentClass = req.student?.class || req.user.class;
    
    const groups = await ProblemGroup.find({
      isActive: true,
      $or: [
        { allowedStudentClasses: { $in: [studentClass] } },
        { allowedStudentClasses: { $size: 0 } }
      ]
    })
    .populate('problems', 'problemNumber title difficulty')
    .sort({ name: 1 })
    .lean();

    res.json({
      success: true,
      groups
    });
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch groups' 
    });
  }
});

// Health check
router.get('/health', async (req, res) => {
  try {
    const pistonHealth = await pistonService.checkHealth();
    
    res.json({
      success: true,
      message: 'Coding practice API is healthy',
      services: {
        piston: pistonHealth,
        database: 'connected'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Health check failed',
      error: error.message
    });
  }
});

// Get student rankings
router.get('/rankings', authenticateStudent, async (req, res) => {
  try {
    const rankings = await StudentSubmission.getStudentRankings();
    
    res.json({
      success: true,
      data: rankings,
      message: 'Rankings retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching rankings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch rankings',
      error: error.message
    });
  }
});

// Get specific student's rank
router.get('/student/rank', authenticateStudent, async (req, res) => {
  try {
    const studentId = req.user.id;
    const rank = await StudentSubmission.getStudentRank(studentId);
    
    if (!rank) {
      return res.json({
        success: true,
        data: {
          rank: null,
          totalScore: 0,
          problemsSolved: 0,
          easyProblems: 0,
          mediumProblems: 0,
          hardProblems: 0,
          message: 'No submissions yet'
        },
        message: 'Student has no ranking yet'
      });
    }

    res.json({
      success: true,
      data: rank,
      message: 'Student rank retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching student rank:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch student rank',
      error: error.message
    });
  }
});

// Admin: Get all students' coding practice statistics
router.get('/admin/student-stats', authenticateAdmin, async (req, res) => {
  try {
    console.log('📊 Fetching student rankings...');
    const rankings = await StudentSubmission.getStudentRankings();
    console.log(`📊 Found ${rankings.length} students with rankings`);

    // Also fetch all students who have any submissions (even if none accepted)
    console.log('📊 Fetching submission summary...');
    const summaryAgg = await StudentSubmission.aggregate([
      { $group: { _id: '$studentId', totalSubmissions: { $sum: 1 }, uniqueProblems: { $addToSet: '$problemId' }, acceptedCount: { $sum: { $cond: [{ $eq: ['$status', 'Accepted'] }, 1, 0] } } } },
      { $project: { studentId: '$_id', _id: 0, totalSubmissions: 1, totalProblemsAttempted: { $size: '$uniqueProblems' }, acceptedCount: 1 } }
    ]);
    console.log(`📊 Found ${summaryAgg.length} students with submissions`);

    const allStudentIds = new Set([ ...rankings.map(r => r.studentId.toString()), ...summaryAgg.map(s => s.studentId.toString()) ]);

    // Build detailed stats list for all with submissions
    const detailedStats = await Promise.all(Array.from(allStudentIds).map(async (sid) => {
      const studentId = sid;
      const baseRank = rankings.find(r => r.studentId.toString() === studentId) || null;
      const baseSummary = summaryAgg.find(s => s.studentId.toString() === studentId) || { totalSubmissions: 0, totalProblemsAttempted: 0, acceptedCount: 0 };
      const stats = await StudentSubmission.getStudentStats(studentId);
      const languageStats = await StudentSubmission.getLanguageStats(studentId);
      const problemsSolved = baseRank?.problemsSolved ?? stats?.solvedProblems ?? 0;
      const accuracyRate = typeof stats?.accuracyRate === 'number' ? stats.accuracyRate : (
        (stats?.totalProblems || 0) > 0 ? ((stats?.solvedProblems || 0) / (stats.totalProblems)) * 100 : 0
      );
      return {
        studentId,
        rank: baseRank?.rank ?? null,
        studentName: baseRank?.studentName ?? undefined,
        email: baseRank?.email ?? undefined,
        totalSubmissions: baseSummary.totalSubmissions || stats?.totalSubmissions || 0,
        totalProblemsAttempted: baseSummary.totalProblemsAttempted || 0,
        acceptedSubmissions: baseSummary.acceptedCount || 0,
        totalProblems: stats?.totalProblems || 0,
        solvedProblems: stats?.solvedProblems || 0,
        problemsSolved,
        accuracyRate,
        easyProblems: baseRank?.easyProblems || 0,
        mediumProblems: baseRank?.mediumProblems || 0,
        hardProblems: baseRank?.hardProblems || 0,
        totalScore: baseRank?.totalScore || 0,
        languageStats,
        lastSolved: baseRank?.lastSolved || null
      };
    }));

    console.log(`📊 Returning ${detailedStats.length} detailed stats`);
    res.json({
      success: true,
      data: detailedStats,
      message: 'Student statistics retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching student statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch student statistics',
      error: error.message
    });
  }
});

// Sync student data between databases
router.post('/admin/sync-student-data', authenticateAdmin, async (req, res) => {
  try {
    console.log('Starting student data sync...');
    const StudentDataSync = require('../services/studentDataSync');
    const syncService = new StudentDataSync();
    
    const result = await syncService.syncStudents();
    
    console.log('Sync completed:', result);
    res.json({
      success: true,
      message: 'Student data synchronized successfully',
      data: result
    });
  } catch (error) {
    console.error('Error syncing student data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to sync student data',
      error: error.message
    });
  }
});

// =============================================================================
// DISCUSSION ROUTES
// =============================================================================

// Get comments for a problem
router.get('/problems/:id/comments', authenticateStudent, async (req, res) => {
  try {
    const problemId = req.params.id;
    const ProblemComment = require('../models/ProblemComment');
    
    const comments = await ProblemComment.find({ problemId })
      .populate('author', 'name email')
      .populate('replies.author', 'name email')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    // Add vote counts and user vote status
    const studentId = req.user.id;
    const enrichedComments = comments.map(comment => ({
      ...comment,
      upvoteCount: comment.upvotes?.length || 0,
      downvoteCount: comment.downvotes?.length || 0,
      userVote: comment.upvotes?.includes(studentId) ? 'upvote' : 
                comment.downvotes?.includes(studentId) ? 'downvote' : null,
      isOwner: comment.author._id.toString() === studentId
    }));

    res.json({
      success: true,
      comments: enrichedComments
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch comments' 
    });
  }
});

// Post a comment on a problem
router.post('/problems/:id/comments', authenticateStudent, async (req, res) => {
  try {
    const problemId = req.params.id;
    const { content } = req.body;
    const studentId = req.user.id;
    
    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Comment content is required'
      });
    }

    const ProblemComment = require('../models/ProblemComment');
    
    const comment = new ProblemComment({
      problemId,
      author: studentId,
      content: content.trim()
    });

    await comment.save();
    await comment.populate('author', 'name email');

    res.status(201).json({
      success: true,
      comment,
      message: 'Comment posted successfully'
    });
  } catch (error) {
    console.error('Error posting comment:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to post comment' 
    });
  }
});

// Vote on a comment
router.post('/comments/:commentId/vote', authenticateStudent, async (req, res) => {
  try {
    const { commentId } = req.params;
    const { type } = req.body; // 'upvote' or 'downvote'
    const studentId = req.user.id;
    
    const ProblemComment = require('../models/ProblemComment');
    const comment = await ProblemComment.findById(commentId);
    
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found'
      });
    }

    // Check current user vote
    const hasUpvoted = comment.upvotes.includes(studentId);
    const hasDownvoted = comment.downvotes.includes(studentId);
    
    // Remove existing votes by this user
    comment.upvotes = comment.upvotes.filter(id => id.toString() !== studentId);
    comment.downvotes = comment.downvotes.filter(id => id.toString() !== studentId);

    let finalUserVote = null;

    // Toggle behavior: if user clicks same vote type, remove it; otherwise add new vote
    if (type === 'upvote' && !hasUpvoted) {
      comment.upvotes.push(studentId);
      finalUserVote = 'upvote';
    } else if (type === 'downvote' && !hasDownvoted) {
      comment.downvotes.push(studentId);
      finalUserVote = 'downvote';
    }
    // If user clicks same vote type they already have, finalUserVote remains null (vote removed)

    await comment.save();

    res.json({
      success: true,
      upvotes: comment.upvotes.length,
      downvotes: comment.downvotes.length,
      userVote: finalUserVote
    });
  } catch (error) {
    console.error('Error voting on comment:', error);
    res.status(500).json({ success: false, message: 'Failed to vote on comment' });
  }
});

// Reply to a comment
router.post('/comments/:commentId/reply', authenticateStudent, async (req, res) => {
  try {
    const { commentId } = req.params;
    const { content } = req.body;
    const studentId = req.user.id;
    
    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Reply content is required'
      });
    }

    const ProblemComment = require('../models/ProblemComment');
    const comment = await ProblemComment.findById(commentId);
    
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found'
      });
    }

    const reply = {
      author: studentId,
      content: content.trim(),
      createdAt: new Date()
    };

    comment.replies.push(reply);
    await comment.save();
    await comment.populate('replies.author', 'name email');

    res.json({
      success: true,
      reply: comment.replies[comment.replies.length - 1],
      message: 'Reply posted successfully'
    });
  } catch (error) {
    console.error('Error posting reply:', error);
    res.status(500).json({ success: false, message: 'Failed to post reply' });
  }
});

// Delete a comment
router.delete('/comments/:commentId', authenticateStudent, async (req, res) => {
  try {
    const { commentId } = req.params;
    const studentId = req.user.id;
    
    const ProblemComment = require('../models/ProblemComment');
    const comment = await ProblemComment.findById(commentId);
    
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found'
      });
    }

    // Only allow the comment author to delete
    if (comment.author.toString() !== studentId) {
      return res.status(403).json({
        success: false,  
        message: 'You can only delete your own comments'
      });
    }

    await ProblemComment.findByIdAndDelete(commentId);

    res.json({
      success: true,
      message: 'Comment deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ success: false, message: 'Failed to delete comment' });
  }
});

// =============================================================================
// AI DOUBT SOLVER ROUTES
// =============================================================================

// Get doubt history for a problem
router.get('/problems/:id/doubts', authenticateStudent, async (req, res) => {
  try {
    const problemId = req.params.id;
    const studentId = req.user.id;
    const StudentDoubt = require('../models/StudentDoubt');
    
    const doubts = await StudentDoubt.find({ 
      problemId, 
      studentId 
    })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

    res.json({
      success: true,
      doubts
    });
  } catch (error) {
    console.error('Error fetching doubts:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch doubt history' 
    });
  }
});

// Ask Gemini AI for help
router.post('/ask-gemini', authenticateStudent, async (req, res) => {
  try {
    const { problemId, problemDescription, studentCode, language, query } = req.body;
    const studentId = req.user.id;

    if (!query || !query.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Query is required'
      });
    }

    // Call Gemini API service
    const geminiService = require('../services/geminiService');
    const aiResponse = await geminiService.askForHelp({
      problemDescription,
      studentCode,
      language,
      query: query.trim()
    });

    // Save the doubt and response
    const StudentDoubt = require('../models/StudentDoubt');
    const doubt = new StudentDoubt({
      problemId,
      studentId,
      query: query.trim(),
      response: aiResponse,
      language,
      studentCode
    });

    await doubt.save();

    res.json({
      success: true,
      response: aiResponse,
      doubt: {
        _id: doubt._id,
        query: doubt.query,
        response: doubt.response,
        createdAt: doubt.createdAt
      }
    });
  } catch (error) {
    console.error('Error asking Gemini:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get AI response',
      error: error.message 
    });
  }
});

module.exports = router;