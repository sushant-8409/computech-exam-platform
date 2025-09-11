import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import './CodingTestCreatorMulti.css';
import { CLASS_OPTIONS, BOARD_OPTIONS } from '../../constants/classBoardOptions';

const CodingTestCreator = ({ onClose, onTestCreated }) => {
  const [formData, setFormData] = useState({
    // Basic test info
    title: '',
    description: '',
    subject: 'Computer Science',
    class: '',
    board: 'CBSE',
    duration: 120, // Increased default for multiple questions
    totalMarks: 0, // Will be calculated from questions
    passingMarks: 0,
    questionsCount: 0, // Will be auto-calculated
    startDate: '',
    endDate: '',
    
    // Coding test type
    type: 'coding',
    
    // Multiple questions support
    coding: {
      questions: [],
      totalQuestions: 0,
      allowQuestionSwitching: true,
      showQuestionProgress: true
    },
    
    // Proctoring settings
    proctoringSettings: {
      strictMode: true,
      allowTabSwitch: 0,
      requireFullscreen: true,
      blockRightClick: true,
      blockKeyboardShortcuts: true,
      maxViolations: 5
    },
    
    // Camera monitoring for coding tests
    cameraMonitoring: {
      enabled: true,
      captureInterval: 30, // More frequent for coding tests
      saveToGoogleDrive: true,
      requireCameraAccess: true,
      faceDetection: true,
      suspiciousActivityDetection: true
    }
  });

  const [currentQuestion, setCurrentQuestion] = useState({
    id: '',
    title: '',
    description: '',
    inputFormat: '',
    outputFormat: '',
    constraints: '',
    examples: [{ input: '', output: '', explanation: '' }],
    testCases: [{ input: '', expectedOutput: '', points: 1, isHidden: true }],
    marks: 10,
    timeLimit: 2,
    memoryLimit: 256,
    difficulty: 'medium',
    starterCode: {
      python: '',
      java: '',
      c: '',
      cpp: '',
      javascript: ''
    }
  });

  const [editingQuestionIndex, setEditingQuestionIndex] = useState(-1);
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // JSON Import states
  const [showJsonImport, setShowJsonImport] = useState(false);
  const [jsonInput, setJsonInput] = useState('');

  // Auto-calculate total marks and questions count
  useEffect(() => {
    const totalMarks = formData.coding.questions.reduce((sum, q) => sum + (q.marks || 0), 0);
    const questionsCount = formData.coding.questions.length;
    
    setFormData(prev => ({
      ...prev,
      totalMarks,
      questionsCount,
      passingMarks: Math.ceil(totalMarks * 0.4), // 40% passing marks
      coding: {
        ...prev.coding,
        totalQuestions: questionsCount
      }
    }));
  }, [formData.coding.questions]);

  const generateQuestionId = () => {
    return 'q_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  };

  const generateStarterCode = async (language, problemTitle) => {
    try {
      const response = await axios.post('/api/admin/coding/starter-code', {
        language,
        problemTitle
      });
      return response.data.starterCode;
    } catch (error) {
      console.error('Error generating starter code:', error);
      return getDefaultStarterCode(language);
    }
  };

  const getDefaultStarterCode = (language) => {
    const templates = {
      python: `def solve():\n    # Write your solution here\n    pass\n\n# Read input\n# Write output`,
      java: `public class Solution {\n    public static void main(String[] args) {\n        // Write your solution here\n        \n    }\n}`,
      c: `#include <stdio.h>\n\nint main() {\n    // Write your solution here\n    \n    return 0;\n}`,
      cpp: `#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your solution here\n    \n    return 0;\n}`,
      javascript: `function solve() {\n    // Write your solution here\n    \n}\n\nsolve();`
    };
    return templates[language] || templates.python;
  };

  const addExample = () => {
    setCurrentQuestion(prev => ({
      ...prev,
      examples: [...prev.examples, { input: '', output: '', explanation: '' }]
    }));
  };

  const removeExample = (index) => {
    setCurrentQuestion(prev => ({
      ...prev,
      examples: prev.examples.filter((_, i) => i !== index)
    }));
  };

  const addTestCase = () => {
    setCurrentQuestion(prev => ({
      ...prev,
      testCases: [...prev.testCases, { input: '', expectedOutput: '', points: 1, isHidden: true }]
    }));
  };

  const removeTestCase = (index) => {
    setCurrentQuestion(prev => ({
      ...prev,
      testCases: prev.testCases.filter((_, i) => i !== index)
    }));
  };

  const openQuestionForm = (questionIndex = -1) => {
    if (questionIndex >= 0) {
      // Editing existing question
      setCurrentQuestion(formData.coding.questions[questionIndex]);
      setEditingQuestionIndex(questionIndex);
    } else {
      // Adding new question
      const newId = generateQuestionId();
      setCurrentQuestion({
        id: newId,
        title: '',
        description: '',
        inputFormat: '',
        outputFormat: '',
        constraints: '',
        examples: [{ input: '', output: '', explanation: '' }],
        testCases: [{ input: '', expectedOutput: '', points: 1, isHidden: true }],
        marks: 10,
        timeLimit: 2,
        memoryLimit: 256,
        difficulty: 'medium',
        starterCode: {
          python: '',
          java: '',
          c: '',
          cpp: '',
          javascript: ''
        }
      });
      setEditingQuestionIndex(-1);
    }
    setShowQuestionForm(true);
  };

  const closeQuestionForm = () => {
    setShowQuestionForm(false);
    setShowJsonImport(false);
    setJsonInput('');
    setCurrentQuestion({
      id: '',
      title: '',
      description: '',
      inputFormat: '',
      outputFormat: '',
      constraints: '',
      examples: [{ input: '', output: '', explanation: '' }],
      testCases: [{ input: '', expectedOutput: '', points: 1, isHidden: true }],
      marks: 10,
      timeLimit: 2,
      memoryLimit: 256,
      difficulty: 'medium',
      starterCode: {
        python: '',
        java: '',
        c: '',
        cpp: '',
        javascript: ''
      }
    });
    setEditingQuestionIndex(-1);
  };

  // JSON Import Functions for Questions
  const parseJsonProblem = (jsonStr) => {
    try {
      const parsed = JSON.parse(jsonStr);
      
      // Handle both single problem and array of problems
      const problem = Array.isArray(parsed) ? parsed[0] : parsed;
      
      if (!problem.title || !problem.description) {
        throw new Error('JSON must contain title and description fields');
      }

      return {
        title: problem.title || problem.name || '',
        description: problem.description || problem.statement || '',
        inputFormat: problem.inputFormat || problem.input_format || '',
        outputFormat: problem.outputFormat || problem.output_format || '',
        constraints: problem.constraints || '',
        marks: problem.marks || problem.points || 10,
        timeLimit: problem.timeLimit || problem.time_limit || 2,
        memoryLimit: problem.memoryLimit || problem.memory_limit || 256,
        difficulty: problem.difficulty || 'medium',
        examples: problem.examples || problem.sample_cases || [{ input: '', output: '', explanation: '' }],
        testCases: problem.testCases || problem.test_cases || [{ input: '', expectedOutput: '', points: 1, isHidden: true }]
      };
    } catch (error) {
      throw new Error(`Invalid JSON format: ${error.message}`);
    }
  };

  const handleJsonImport = () => {
    if (!jsonInput.trim()) {
      toast.error('Please paste JSON content first');
      return;
    }

    try {
      const parsedData = parseJsonProblem(jsonInput);
      
      // Update current question with parsed values
      setCurrentQuestion(prev => ({
        ...prev,
        ...parsedData,
        id: prev.id, // Keep existing ID
        starterCode: prev.starterCode // Keep existing starter code
      }));

      // Clear JSON input and hide panel
      setJsonInput('');
      setShowJsonImport(false);
      
      toast.success('🎉 JSON imported successfully! Question form populated with problem data.');
    } catch (error) {
      toast.error(`Failed to parse JSON: ${error.message}`);
    }
  };

  // JSON File Upload Functions
  const handleJsonFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      readJsonFile(file);
    }
  };

  const handleJsonFileDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    
    const files = Array.from(event.dataTransfer.files);
    const jsonFile = files.find(file => file.type === 'application/json' || file.name.endsWith('.json'));
    
    if (jsonFile) {
      readJsonFile(jsonFile);
    } else {
      toast.error('Please drop a valid JSON file');
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDragEnter = (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.classList.add('drag-over');
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.classList.remove('drag-over');
  };

  const readJsonFile = (file) => {
    if (file.size > 1024 * 1024) { // 1MB limit
      toast.error('File size too large. Please use a file smaller than 1MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target.result;
        setJsonInput(content);
        toast.success(`📁 File "${file.name}" loaded successfully! Click "Parse & Import" to continue.`);
      } catch (error) {
        toast.error('Failed to read the file');
      }
    };
    reader.onerror = () => {
      toast.error('Error reading the file');
    };
    reader.readAsText(file);
  };

  const getAiPrompt = () => {
    return `Generate a coding problem in JSON format for educational purposes. Use this exact structure:

{
  "title": "Problem Title",
  "description": "Clear problem statement with context and requirements",
  "inputFormat": "Description of input format",
  "outputFormat": "Description of expected output format", 
  "constraints": "Time/space/value constraints",
  "marks": 10,
  "difficulty": "medium",
  "timeLimit": 2,
  "memoryLimit": 256,
  "examples": [
    {
      "input": "sample input",
      "output": "expected output",
      "explanation": "why this output is correct"
    }
  ],
  "testCases": [
    {
      "input": "test input",
      "expectedOutput": "expected result",
      "points": 1,
      "isHidden": true
    }
  ]
}

Make the problem appropriate for ${formData.class || 'high school'} level students studying ${formData.subject || 'Computer Science'}.`;
  };

  const saveQuestion = async () => {
    if (!currentQuestion.title || !currentQuestion.description) {
      toast.error('Please fill in question title and description');
      return;
    }

    if (currentQuestion.testCases.length === 0) {
      toast.error('Please add at least one test case');
      return;
    }

    // Generate starter code for all languages
    const languages = ['python', 'java', 'c', 'cpp', 'javascript'];
    const starterCode = { ...currentQuestion.starterCode };
    
    for (const lang of languages) {
      if (!starterCode[lang]) {
        starterCode[lang] = await generateStarterCode(lang, currentQuestion.title);
      }
    }

    const questionToSave = {
      ...currentQuestion,
      starterCode
    };

    if (editingQuestionIndex >= 0) {
      // Update existing question
      const updatedQuestions = [...formData.coding.questions];
      updatedQuestions[editingQuestionIndex] = questionToSave;
      setFormData(prev => ({
        ...prev,
        coding: {
          ...prev.coding,
          questions: updatedQuestions
        }
      }));
      toast.success('Question updated successfully');
    } else {
      // Add new question
      setFormData(prev => ({
        ...prev,
        coding: {
          ...prev.coding,
          questions: [...prev.coding.questions, questionToSave]
        }
      }));
      toast.success('Question added successfully');
    }

    closeQuestionForm();
  };

  const deleteQuestion = (questionIndex) => {
    const updatedQuestions = formData.coding.questions.filter((_, i) => i !== questionIndex);
    setFormData(prev => ({
      ...prev,
      coding: {
        ...prev.coding,
        questions: updatedQuestions
      }
    }));
    toast.success('Question deleted successfully');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.coding.questions.length === 0) {
      toast.error('Please add at least one coding question');
      return;
    }

    if (!formData.title || !formData.startDate || !formData.endDate) {
      toast.error('Please fill in all required fields');
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post('/api/admin/tests', {
        ...formData,
        type: 'coding'
      });

      toast.success('Coding test created successfully!');
      onTestCreated && onTestCreated(response.data);
      onClose();
    } catch (error) {
      console.error('Error creating coding test:', error);
      toast.error(error.response?.data?.message || 'Failed to create coding test');
    } finally {
      setLoading(false);
    }
  };

  if (showQuestionForm) {
    return (
      <div className="coding-test-creator-overlay">
        <div className="coding-test-creator-modal question-form-modal">
          <div className="modal-header">
            <h2>{editingQuestionIndex >= 0 ? 'Edit' : 'Add'} Coding Question</h2>
            <button className="close-btn" onClick={closeQuestionForm}>×</button>
          </div>

          <div className="modal-content">
            {/* JSON Import Section */}
            <div className="form-section">
              <div className="section-header">
                <h3>Quick Import</h3>
                <button
                  type="button"
                  className="toggle-btn"
                  onClick={() => setShowJsonImport(!showJsonImport)}
                >
                  {showJsonImport ? '📝 Manual Entry' : '📋 JSON Import'}
                </button>
              </div>

              {showJsonImport && (
                <div className="json-import-section">
                  {/* File Upload */}
                  <div className="file-upload-section">
                    <div
                      className="file-drop-zone"
                      onDrop={handleJsonFileDrop}
                      onDragOver={handleDragOver}
                      onDragEnter={handleDragEnter}
                      onDragLeave={handleDragLeave}
                    >
                      <div className="drop-content">
                        <span className="upload-icon">📁</span>
                        <p>Drag & drop a JSON file here, or</p>
                        <label className="file-upload-btn">
                          <input
                            type="file"
                            accept=".json,application/json"
                            onChange={handleJsonFileUpload}
                            style={{ display: 'none' }}
                          />
                          Choose File
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="divider">
                    <span>OR</span>
                  </div>

                  {/* Manual JSON Input */}
                  <div className="json-input-section">
                    <div className="json-controls">
                      <label>Paste JSON Problem Data:</label>
                      <div className="json-actions">
                        <button
                          type="button"
                          className="ai-prompt-btn"
                          onClick={() => {
                            navigator.clipboard.writeText(getAiPrompt());
                            toast.success('🤖 AI prompt copied! Use it with ChatGPT, Claude, or any AI assistant.');
                          }}
                          title="Copy AI prompt for generating JSON problems"
                        >
                          🤖 Copy AI Prompt
                        </button>
                        <button
                          type="button"
                          className="clear-btn"
                          onClick={() => setJsonInput('')}
                          disabled={!jsonInput.trim()}
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                    
                    <textarea
                      className="json-textarea"
                      value={jsonInput}
                      onChange={(e) => setJsonInput(e.target.value)}
                      placeholder="Paste JSON problem data here... (supports LeetCode format)"
                      rows="8"
                    />
                    
                    <button
                      type="button"
                      className="import-btn"
                      onClick={handleJsonImport}
                      disabled={!jsonInput.trim()}
                    >
                      📥 Parse & Import JSON
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="question-form">
              {/* Question Basic Info */}
              <div className="form-section">
                <h3>Question Details</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>Question Title *</label>
                    <input
                      type="text"
                      value={currentQuestion.title}
                      onChange={(e) => setCurrentQuestion(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="e.g., Two Sum Problem"
                    />
                  </div>
                  <div className="form-group">
                    <label>Marks *</label>
                    <input
                      type="number"
                      value={currentQuestion.marks}
                      onChange={(e) => setCurrentQuestion(prev => ({ ...prev, marks: parseInt(e.target.value) || 0 }))}
                      min="1"
                      max="100"
                    />
                  </div>
                  <div className="form-group">
                    <label>Difficulty</label>
                    <select
                      value={currentQuestion.difficulty}
                      onChange={(e) => setCurrentQuestion(prev => ({ ...prev, difficulty: e.target.value }))}
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Problem Description *</label>
                  <textarea
                    value={currentQuestion.description}
                    onChange={(e) => setCurrentQuestion(prev => ({ ...prev, description: e.target.value }))}
                    rows="4"
                    placeholder="Describe the problem statement clearly..."
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Input Format</label>
                    <textarea
                      value={currentQuestion.inputFormat}
                      onChange={(e) => setCurrentQuestion(prev => ({ ...prev, inputFormat: e.target.value }))}
                      rows="2"
                      placeholder="Describe the input format..."
                    />
                  </div>
                  <div className="form-group">
                    <label>Output Format</label>
                    <textarea
                      value={currentQuestion.outputFormat}
                      onChange={(e) => setCurrentQuestion(prev => ({ ...prev, outputFormat: e.target.value }))}
                      rows="2"
                      placeholder="Describe the output format..."
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Constraints</label>
                  <textarea
                    value={currentQuestion.constraints}
                    onChange={(e) => setCurrentQuestion(prev => ({ ...prev, constraints: e.target.value }))}
                    rows="2"
                    placeholder="e.g., 1 <= n <= 10^5, 1 <= arr[i] <= 10^9"
                  />
                </div>
              </div>

              {/* Examples */}
              <div className="form-section">
                <div className="section-header">
                  <h3>Examples</h3>
                  <button type="button" className="add-btn" onClick={addExample}>+ Add Example</button>
                </div>
                {currentQuestion.examples.map((example, index) => (
                  <div key={index} className="example-item">
                    <div className="example-header">
                      <span>Example {index + 1}</span>
                      {currentQuestion.examples.length > 1 && (
                        <button type="button" className="remove-btn" onClick={() => removeExample(index)}>Remove</button>
                      )}
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Input</label>
                        <textarea
                          value={example.input}
                          onChange={(e) => {
                            const updatedExamples = [...currentQuestion.examples];
                            updatedExamples[index].input = e.target.value;
                            setCurrentQuestion(prev => ({ ...prev, examples: updatedExamples }));
                          }}
                          rows="2"
                        />
                      </div>
                      <div className="form-group">
                        <label>Output</label>
                        <textarea
                          value={example.output}
                          onChange={(e) => {
                            const updatedExamples = [...currentQuestion.examples];
                            updatedExamples[index].output = e.target.value;
                            setCurrentQuestion(prev => ({ ...prev, examples: updatedExamples }));
                          }}
                          rows="2"
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Explanation (Optional)</label>
                      <textarea
                        value={example.explanation}
                        onChange={(e) => {
                          const updatedExamples = [...currentQuestion.examples];
                          updatedExamples[index].explanation = e.target.value;
                          setCurrentQuestion(prev => ({ ...prev, examples: updatedExamples }));
                        }}
                        rows="2"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Test Cases */}
              <div className="form-section">
                <div className="section-header">
                  <h3>Test Cases</h3>
                  <button type="button" className="add-btn" onClick={addTestCase}>+ Add Test Case</button>
                </div>
                {currentQuestion.testCases.map((testCase, index) => (
                  <div key={index} className="test-case-item">
                    <div className="test-case-header">
                      <span>Test Case {index + 1}</span>
                      {currentQuestion.testCases.length > 1 && (
                        <button type="button" className="remove-btn" onClick={() => removeTestCase(index)}>Remove</button>
                      )}
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Input</label>
                        <textarea
                          value={testCase.input}
                          onChange={(e) => {
                            const updatedTestCases = [...currentQuestion.testCases];
                            updatedTestCases[index].input = e.target.value;
                            setCurrentQuestion(prev => ({ ...prev, testCases: updatedTestCases }));
                          }}
                          rows="2"
                        />
                      </div>
                      <div className="form-group">
                        <label>Expected Output</label>
                        <textarea
                          value={testCase.expectedOutput}
                          onChange={(e) => {
                            const updatedTestCases = [...currentQuestion.testCases];
                            updatedTestCases[index].expectedOutput = e.target.value;
                            setCurrentQuestion(prev => ({ ...prev, testCases: updatedTestCases }));
                          }}
                          rows="2"
                        />
                      </div>
                      <div className="form-group">
                        <label>Points</label>
                        <input
                          type="number"
                          value={testCase.points}
                          onChange={(e) => {
                            const updatedTestCases = [...currentQuestion.testCases];
                            updatedTestCases[index].points = parseInt(e.target.value) || 1;
                            setCurrentQuestion(prev => ({ ...prev, testCases: updatedTestCases }));
                          }}
                          min="1"
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label>
                        <input
                          type="checkbox"
                          checked={testCase.isHidden}
                          onChange={(e) => {
                            const updatedTestCases = [...currentQuestion.testCases];
                            updatedTestCases[index].isHidden = e.target.checked;
                            setCurrentQuestion(prev => ({ ...prev, testCases: updatedTestCases }));
                          }}
                        />
                        Hidden Test Case (not visible to students)
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              {/* Execution Settings */}
              <div className="form-section">
                <h3>Execution Settings</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>Time Limit (seconds)</label>
                    <input
                      type="number"
                      value={currentQuestion.timeLimit}
                      onChange={(e) => setCurrentQuestion(prev => ({ ...prev, timeLimit: parseInt(e.target.value) || 2 }))}
                      min="1"
                      max="30"
                    />
                  </div>
                  <div className="form-group">
                    <label>Memory Limit (MB)</label>
                    <input
                      type="number"
                      value={currentQuestion.memoryLimit}
                      onChange={(e) => setCurrentQuestion(prev => ({ ...prev, memoryLimit: parseInt(e.target.value) || 256 }))}
                      min="64"
                      max="1024"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={closeQuestionForm}>Cancel</button>
              <button type="button" className="btn-primary" onClick={saveQuestion}>
                {editingQuestionIndex >= 0 ? 'Update' : 'Add'} Question
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="coding-test-creator-overlay">
      <div className="coding-test-creator-modal">
        <div className="modal-header">
          <h2>Create Multi-Question Coding Test</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-content">
          {/* Basic Test Information */}
          <div className="form-section">
            <h3>Test Information</h3>
            <div className="form-row">
              <div className="form-group">
                <label>Test Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label>Subject</label>
                <select
                  value={formData.subject}
                  onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                >
                  <option value="Computer Science">Computer Science</option>
                  <option value="Computer Application">Computer Application</option>
                  <option value="Programming">Programming</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows="3"
                placeholder="Brief description of the coding test..."
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Class</label>
                <select
                  value={formData.class}
                  onChange={(e) => setFormData(prev => ({ ...prev, class: e.target.value }))}
                  required
                >
                    <option value="">Select Class</option>
                    {CLASS_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
              </div>
              <div className="form-group">
                <label>Board</label>
                <select
                  value={formData.board}
                  onChange={(e) => setFormData(prev => ({ ...prev, board: e.target.value }))}
                >
                    <option value="">Select Board</option>
                    {BOARD_OPTIONS.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                </select>
              </div>
              <div className="form-group">
                <label>Duration (minutes)</label>
                <input
                  type="number"
                  value={formData.duration}
                  onChange={(e) => setFormData(prev => ({ ...prev, duration: parseInt(e.target.value) || 120 }))}
                  min="30"
                  max="300"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Start Date & Time *</label>
                <input
                  type="datetime-local"
                  value={formData.startDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label>End Date & Time *</label>
                <input
                  type="datetime-local"
                  value={formData.endDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Total Questions: {formData.questionsCount}</label>
              </div>
              <div className="form-group">
                <label>Total Marks: {formData.totalMarks}</label>
              </div>
              <div className="form-group">
                <label>Passing Marks: {formData.passingMarks}</label>
              </div>
            </div>
          </div>

          {/* Questions Management */}
          <div className="form-section">
            <div className="section-header">
              <h3>Coding Questions ({formData.coding.questions.length})</h3>
              <button type="button" className="add-btn" onClick={() => openQuestionForm()}>
                + Add Question
              </button>
            </div>

            {formData.coding.questions.length === 0 ? (
              <div className="empty-state">
                <p>No questions added yet. Click "Add Question" to create your first coding problem.</p>
              </div>
            ) : (
              <div className="questions-list">
                {formData.coding.questions.map((question, index) => (
                  <div key={question.id} className="question-item">
                    <div className="question-header">
                      <div className="question-info">
                        <h4>{question.title}</h4>
                        <div className="question-meta">
                          <span className={`difficulty-badge ${question.difficulty}`}>
                            {question.difficulty}
                          </span>
                          <span className="marks-badge">{question.marks} marks</span>
                          <span className="test-cases-badge">
                            {question.testCases.length} test cases
                          </span>
                        </div>
                      </div>
                      <div className="question-actions">
                        <button
                          type="button"
                          className="btn-edit"
                          onClick={() => openQuestionForm(index)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn-delete"
                          onClick={() => deleteQuestion(index)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    <div className="question-preview">
                      <p>{question.description.substring(0, 200)}...</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Test Settings */}
          <div className="form-section">
            <h3>Test Settings</h3>
            <div className="form-row">
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.coding.allowQuestionSwitching}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      coding: { ...prev.coding, allowQuestionSwitching: e.target.checked }
                    }))}
                  />
                  Allow Question Switching
                </label>
              </div>
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.coding.showQuestionProgress}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      coding: { ...prev.coding, showQuestionProgress: e.target.checked }
                    }))}
                  />
                  Show Question Progress
                </label>
              </div>
            </div>
          </div>

          {/* Proctoring Settings */}
          <div className="form-section">
            <h3>Proctoring & Security</h3>
            <div className="proctoring-settings">
              <div className="form-row">
                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.proctoringSettings.strictMode}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        proctoringSettings: { ...prev.proctoringSettings, strictMode: e.target.checked }
                      }))}
                    />
                    Strict Mode
                  </label>
                </div>
                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.proctoringSettings.requireFullscreen}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        proctoringSettings: { ...prev.proctoringSettings, requireFullscreen: e.target.checked }
                      }))}
                    />
                    Require Fullscreen
                  </label>
                </div>
                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.proctoringSettings.blockRightClick}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        proctoringSettings: { ...prev.proctoringSettings, blockRightClick: e.target.checked }
                      }))}
                    />
                    Block Right Click
                  </label>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Max Tab Switches Allowed</label>
                  <input
                    type="number"
                    value={formData.proctoringSettings.allowTabSwitch}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      proctoringSettings: { ...prev.proctoringSettings, allowTabSwitch: parseInt(e.target.value) || 0 }
                    }))}
                    min="0"
                    max="10"
                  />
                </div>
                <div className="form-group">
                  <label>Max Violations Allowed</label>
                  <input
                    type="number"
                    value={formData.proctoringSettings.maxViolations}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      proctoringSettings: { ...prev.proctoringSettings, maxViolations: parseInt(e.target.value) || 5 }
                    }))}
                    min="1"
                    max="10"
                  />
                </div>
              </div>
            </div>

            <div className="camera-monitoring">
              <h4>Camera Monitoring</h4>
              <div className="form-row">
                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.cameraMonitoring.enabled}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        cameraMonitoring: { ...prev.cameraMonitoring, enabled: e.target.checked }
                      }))}
                    />
                    Enable Camera Monitoring
                  </label>
                </div>
                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.cameraMonitoring.requireCameraAccess}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        cameraMonitoring: { ...prev.cameraMonitoring, requireCameraAccess: e.target.checked }
                      }))}
                      disabled={!formData.cameraMonitoring.enabled}
                    />
                    Require Camera Access
                  </label>
                </div>
                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.cameraMonitoring.faceDetection}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        cameraMonitoring: { ...prev.cameraMonitoring, faceDetection: e.target.checked }
                      }))}
                      disabled={!formData.cameraMonitoring.enabled}
                    />
                    Face Detection
                  </label>
                </div>
              </div>
              
              {formData.cameraMonitoring.enabled && (
                <div className="form-group">
                  <label>Capture Interval (seconds)</label>
                  <input
                    type="number"
                    value={formData.cameraMonitoring.captureInterval}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      cameraMonitoring: { ...prev.cameraMonitoring, captureInterval: parseInt(e.target.value) || 30 }
                    }))}
                    min="10"
                    max="300"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create Coding Test'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CodingTestCreator;
