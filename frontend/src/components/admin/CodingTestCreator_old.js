import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import './CodingTestCreator.css';
import { CLASS_OPTIONS, BOARD_OPTIONS, BOARD_LANGUAGE_RECOMMENDATION } from '../../constants/classBoardOptions';

const CodingTestCreator = ({ onClose, onTestCreated }) => {
  const [formData, setFormData] = useState({
    // Basic test info
    title: '',
    description: '',
    subject: 'Computer Science',
    class: '',
    board: 'CBSE',
    duration: 60,
    totalMarks: 10,
    passingMarks: 5,
    questionsCount: 1,
    startDate: '',
    endDate: '',
    
    // Coding specific
    type: 'coding',
    isCodingTest: true,
    codingLanguage: '',
    
    // Problem details
    problemTitle: '',
    problemDescription: '',
    inputFormat: '',
    outputFormat: '',
    constraints: '',
    timeLimit: 2,
    memoryLimit: 256,
    
    // Examples and test cases
    examples: [{ input: '', output: '', explanation: '' }],
    testCases: [{ input: '', expectedOutput: '', points: 1, isHidden: true }]
  });

  const [loading, setLoading] = useState(false);
  const [testingCode, setTestingCode] = useState(false);
  const [starterCode, setStarterCode] = useState('');
  const [showJsonImport, setShowJsonImport] = useState(false);
  const [jsonInput, setJsonInput] = useState('');

  // Language options based on education boards (centralized)
  const languageOptions = BOARD_LANGUAGE_RECOMMENDATION;

  useEffect(() => {
    // Auto-select language based on board
    const boardLanguage = languageOptions[formData.board];
    if (boardLanguage) {
      setFormData(prev => ({ ...prev, codingLanguage: boardLanguage.language }));
      generateStarterCode(boardLanguage.language, formData.problemTitle || 'Coding Problem');
    }
  }, [formData.board]);

  const generateStarterCode = async (language, problemTitle) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/admin/coding/starter-code', {
        language: language,
        problemTitle: problemTitle
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setStarterCode(response.data.starterCode);
      }
    } catch (error) {
      console.error('Error generating starter code:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: type === 'checkbox' ? checked : value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    }

    // Regenerate starter code when problem title changes
    if (name === 'problemTitle' && value && formData.codingLanguage) {
      generateStarterCode(formData.codingLanguage, value);
    }
  };

  const handleExampleChange = (index, field, value) => {
    const newExamples = [...formData.examples];
    newExamples[index][field] = value;
    setFormData(prev => ({ ...prev, examples: newExamples }));
  };

  const addExample = () => {
    setFormData(prev => ({
      ...prev,
      examples: [...prev.examples, { input: '', output: '', explanation: '' }]
    }));
  };

  const removeExample = (index) => {
    if (formData.examples.length > 1) {
      const newExamples = formData.examples.filter((_, i) => i !== index);
      setFormData(prev => ({ ...prev, examples: newExamples }));
    }
  };

  // JSON Import functionality
  const parseJsonProblem = (jsonText) => {
    try {
      const parsed = JSON.parse(jsonText);
      
      // Handle LeetCode-style JSON structure
      if (parsed.title && parsed.description) {
        setFormData(prev => ({
          ...prev,
          title: parsed.title || prev.title,
          problemTitle: parsed.title || '',
          problemDescription: parsed.description || '',
          inputFormat: parsed.inputFormat || '',
          outputFormat: parsed.outputFormat || '',
          constraints: parsed.constraints || '',
          timeLimit: parsed.timeLimit || 2,
          memoryLimit: parsed.memoryLimit || 256,
          examples: parsed.examples && parsed.examples.length > 0 ? parsed.examples : prev.examples,
          testCases: parsed.testCases && parsed.testCases.length > 0 ? parsed.testCases : prev.testCases,
          totalMarks: parsed.marks || prev.totalMarks,
        }));
        
        // Handle starter code if provided
        if (parsed.starterCode) {
          const language = formData.codingLanguage || 'python';
          if (parsed.starterCode[language]) {
            setStarterCode(parsed.starterCode[language]);
          }
        }
        
        toast.success('✅ JSON problem imported successfully!');
        setShowJsonImport(false);
        setJsonInput('');
      } else {
        throw new Error('Invalid JSON structure. Missing required fields: title, description');
      }
    } catch (error) {
      toast.error(`❌ JSON Parse Error: ${error.message}`);
    }
  };

  const handleJsonImport = () => {
    if (!jsonInput.trim()) {
      toast.warning('Please paste JSON content first');
      return;
    }
    parseJsonProblem(jsonInput);
  };

  const getAiPrompt = () => {
    return `Generate a coding problem in JSON format with the following structure:

{
  "title": "Problem Title",
  "description": "Detailed problem statement with constraints and examples",
  "inputFormat": "Description of input format",
  "outputFormat": "Description of expected output format", 
  "constraints": "Time/space complexity and input constraints",
  "examples": [
    {
      "input": "5 3\\n",
      "output": "8\\n",
      "explanation": "5 + 3 = 8"
    }
  ],
  "testCases": [
    {
      "input": "1 2\\n",
      "expectedOutput": "3\\n", 
      "points": 1,
      "isHidden": false
    },
    {
      "input": "100 -50\\n",
      "expectedOutput": "50\\n",
      "points": 2, 
      "isHidden": true
    }
  ],
  "starterCode": {
    "python": "def solve():\\n    # Write your code here\\n    pass\\n\\nif __name__ == '__main__':\\n    solve()",
    "java": "import java.util.*;\\n\\npublic class Solution {\\n    public static void main(String[] args) {\\n        // Write your code here\\n    }\\n}"
  },
  "timeLimit": 2,
  "memoryLimit": 256,
  "marks": 10
}

Make the problem similar to LeetCode style with clear examples and test cases.`;
  };

  const handleTestCaseChange = (index, field, value) => {
    const newTestCases = [...formData.testCases];
    newTestCases[index][field] = value;
    setFormData(prev => ({ ...prev, testCases: newTestCases }));
  };

  const addTestCase = () => {
    setFormData(prev => ({
      ...prev,
      testCases: [...prev.testCases, { input: '', expectedOutput: '', points: 1, isHidden: true }]
    }));
  };

  const removeTestCase = (index) => {
    if (formData.testCases.length > 1) {
      const newTestCases = formData.testCases.filter((_, i) => i !== index);
      setFormData(prev => ({ ...prev, testCases: newTestCases }));
    }
  };

  const testCode = async (sampleCode) => {
    if (!sampleCode.trim()) {
      toast.error('Please provide sample code to test');
      return;
    }

    setTestingCode(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/admin/coding/test-compile', {
        sourceCode: sampleCode,
        language: formData.codingLanguage,
        testInput: formData.testCases[0]?.input || '',
        expectedOutput: formData.testCases[0]?.expectedOutput || ''
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        const result = response.data.result;
        if (result.passed) {
          toast.success('✅ Test code compiled and ran successfully!');
        } else {
          toast.warning(`⚠️ Code ran but output doesn't match expected result.\nOutput: ${result.output}\nExpected: ${formData.testCases[0]?.expectedOutput}`);
        }
        
        if (result.stderr) {
          toast.error(`Compilation error: ${result.stderr}`);
        }
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to test code');
    } finally {
      setTestingCode(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.title || !formData.problemTitle || !formData.problemDescription) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (formData.testCases.length === 0 || !formData.testCases[0].input || !formData.testCases[0].expectedOutput) {
      toast.error('Please add at least one test case with input and expected output');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      const testData = {
        ...formData,
        type: 'coding',
        isCodingTest: true,
        codingProblem: {
          title: formData.problemTitle,
          description: formData.problemDescription,
          inputFormat: formData.inputFormat,
          outputFormat: formData.outputFormat,
          constraints: formData.constraints,
          examples: formData.examples.filter(ex => ex.input && ex.output),
          testCases: formData.testCases.filter(tc => tc.input && tc.expectedOutput),
          starterCode: {
            [formData.codingLanguage]: starterCode
          },
          timeLimit: formData.timeLimit,
          memoryLimit: formData.memoryLimit
        }
      };

      const response = await axios.post('/api/admin/tests', testData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        toast.success('🎉 Coding test created successfully!');
        if (onTestCreated) {
          onTestCreated(response.data.test);
        }
        if (onClose) {
          onClose();
        }
      }
    } catch (error) {
      console.error('Error creating coding test:', error);
      toast.error(error.response?.data?.message || 'Failed to create coding test');
    } finally {
      setLoading(false);
    }
  };

  const currentLanguageInfo = languageOptions[formData.board];

  return (
    <div className="coding-test-creator">
      <div className="creator-header">
        <h2>🔧 Create Coding Test</h2>
        <button className="close-btn" onClick={onClose}>✕</button>
      </div>

      {/* JSON Import Section */}
      <div className="json-import-section">
        <div className="import-toggle">
          <button 
            type="button" 
            className={`import-btn ${showJsonImport ? 'active' : ''}`}
            onClick={() => setShowJsonImport(!showJsonImport)}
          >
            🤖 Import from AI-Generated JSON
          </button>
          <small>Generate problems with ChatGPT, Claude, or any AI and paste the JSON here</small>
        </div>

        {showJsonImport && (
          <div className="json-import-panel">
            <div className="ai-prompt-section">
              <h4>📝 AI Prompt Template</h4>
              <div className="prompt-box">
                <pre>{getAiPrompt()}</pre>
                <button 
                  type="button" 
                  className="copy-btn"
                  onClick={() => {
                    navigator.clipboard.writeText(getAiPrompt());
                    toast.success('Prompt copied to clipboard!');
                  }}
                >
                  📋 Copy Prompt
                </button>
              </div>
            </div>

            <div className="json-input-section">
              <h4>🔧 Paste Generated JSON</h4>
              <textarea
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder="Paste the AI-generated JSON problem here..."
                rows="12"
                className="json-textarea"
              />
              <div className="import-actions">
                <button type="button" onClick={handleJsonImport} className="parse-btn">
                  ⚡ Parse & Import JSON
                </button>
                <button 
                  type="button" 
                  onClick={() => {
                    setJsonInput('');
                    setShowJsonImport(false);
                  }}
                  className="cancel-btn"
                >
                  ✕ Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="creator-form">
        {/* Basic Test Information */}
        <div className="form-section">
          <h3>📋 Basic Information</h3>
          
          <div className="form-group">
            <label>Test Title *</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="e.g., Python Programming Test - Arrays & Loops"
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Subject</label>
              <select name="subject" value={formData.subject} onChange={handleInputChange}>
                <option value="Computer Science">Computer Science</option>
                <option value="Information Technology">Information Technology</option>
                <option value="Programming">Programming</option>
                <option value="Software Development">Software Development</option>
              </select>
            </div>
            
            <div className="form-group">
              <label>Class</label>
              <select name="class" value={formData.class} onChange={handleInputChange} required>
                <option value="">Select Class</option>
                {CLASS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Education Board</label>
              <select name="board" value={formData.board} onChange={handleInputChange}>
                <option value="">Select Board</option>
                {BOARD_OPTIONS.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Duration (minutes)</label>
              <input
                type="number"
                name="duration"
                value={formData.duration}
                onChange={handleInputChange}
                min="30"
                max="180"
              />
            </div>
            
            <div className="form-group">
              <label>Total Marks</label>
              <input
                type="number"
                name="totalMarks"
                value={formData.totalMarks}
                onChange={handleInputChange}
                min="1"
                max="100"
              />
            </div>

            <div className="form-group">
              <label>Passing Marks</label>
              <input
                type="number"
                name="passingMarks"
                value={formData.passingMarks}
                onChange={handleInputChange}
                min="1"
                max={formData.totalMarks}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Start Date & Time</label>
              <input
                type="datetime-local"
                name="startDate"
                value={formData.startDate}
                onChange={handleInputChange}
                required
              />
            </div>
            
            <div className="form-group">
              <label>End Date & Time</label>
              <input
                type="datetime-local"
                name="endDate"
                value={formData.endDate}
                onChange={handleInputChange}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Brief description of the coding test"
              rows="3"
            />
          </div>
        </div>

        {/* Programming Language */}
        <div className="form-section">
          <h3>💻 Programming Language</h3>
          
          <div className="language-info">
            <div className="recommended-language">
              <strong>Recommended for {formData.board}: </strong>
              <span className="language-badge">{currentLanguageInfo?.label}</span>
            </div>
            <small>
              Language is automatically selected based on the education board.
              CBSE → Python, ICSE/ISC → Java, Others → C
            </small>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Time Limit (seconds per test case)</label>
              <input
                type="number"
                name="timeLimit"
                value={formData.timeLimit}
                onChange={handleInputChange}
                min="1"
                max="10"
              />
            </div>
            
            <div className="form-group">
              <label>Memory Limit (MB)</label>
              <input
                type="number"
                name="memoryLimit"
                value={formData.memoryLimit}
                onChange={handleInputChange}
                min="64"
                max="512"
              />
            </div>
          </div>
        </div>

        {/* Problem Statement */}
        <div className="form-section">
          <h3>📝 Problem Statement</h3>
          
          <div className="form-group">
            <label>Problem Title *</label>
            <input
              type="text"
              name="problemTitle"
              value={formData.problemTitle}
              onChange={handleInputChange}
              placeholder="e.g., Find Maximum Element in Array"
              required
            />
          </div>

          <div className="form-group">
            <label>Problem Description *</label>
            <textarea
              name="problemDescription"
              value={formData.problemDescription}
              onChange={handleInputChange}
              placeholder="Detailed description of the problem..."
              rows="6"
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Input Format</label>
              <textarea
                name="inputFormat"
                value={formData.inputFormat}
                onChange={handleInputChange}
                placeholder="Describe the input format..."
                rows="3"
              />
            </div>
            
            <div className="form-group">
              <label>Output Format</label>
              <textarea
                name="outputFormat"
                value={formData.outputFormat}
                onChange={handleInputChange}
                placeholder="Describe the expected output format..."
                rows="3"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Constraints</label>
            <textarea
              name="constraints"
              value={formData.constraints}
              onChange={handleInputChange}
              placeholder="e.g., 1 ≤ N ≤ 100, 1 ≤ arr[i] ≤ 1000"
              rows="2"
            />
          </div>
        </div>

        {/* Examples */}
        <div className="form-section">
          <h3>📚 Examples (Visible to Students)</h3>
          
          {formData.examples.map((example, index) => (
            <div key={index} className="example-group">
              <div className="example-header">
                <h4>Example {index + 1}</h4>
                {formData.examples.length > 1 && (
                  <button 
                    type="button" 
                    onClick={() => removeExample(index)}
                    className="remove-btn"
                  >
                    Remove
                  </button>
                )}
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Class</label>
                  <select name="class" value={formData.class} onChange={handleInputChange} required>
                    <option value="">Select Class</option>
                    {CLASS_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                
                <div className="form-group">
                  <label>Board *</label>
                  <select name="board" value={formData.board} onChange={handleInputChange}>
                    <option value="">Select Board</option>
                    {BOARD_OPTIONS.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="form-group">
                <label>Output</label>
                <textarea
                  value={example.output}
                  onChange={(e) => handleExampleChange(index, 'output', e.target.value)}
                  placeholder="Expected output for this example..."
                  rows="2"
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Explanation (Optional)</label>
                <textarea
                  value={example.explanation}
                  onChange={(e) => handleExampleChange(index, 'explanation', e.target.value)}
                  placeholder="Explain how the output is derived..."
                  rows="2"
                />
              </div>
            </div>
          ))}
          
          <button type="button" onClick={addExample} className="add-btn">
            + Add Another Example
          </button>
        </div>

        {/* Test Cases */}
        <div className="form-section">
          <h3>🧪 Test Cases (For Evaluation)</h3>
          
          {formData.testCases.map((testCase, index) => (
            <div key={index} className="test-case-group">
              <div className="test-case-header">
                <h4>Test Case {index + 1}</h4>
                <div className="test-case-controls">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={testCase.isHidden}
                      onChange={(e) => handleTestCaseChange(index, 'isHidden', e.target.checked)}
                    />
                    Hidden from students
                  </label>
                  {formData.testCases.length > 1 && (
                    <button 
                      type="button" 
                      onClick={() => removeTestCase(index)}
                      className="remove-btn"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Input *</label>
                  <textarea
                    value={testCase.input}
                    onChange={(e) => handleTestCaseChange(index, 'input', e.target.value)}
                    placeholder="Test input..."
                    rows="3"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label>Expected Output *</label>
                  <textarea
                    value={testCase.expectedOutput}
                    onChange={(e) => handleTestCaseChange(index, 'expectedOutput', e.target.value)}
                    placeholder="Expected output..."
                    rows="3"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label>Points</label>
                  <input
                    type="number"
                    value={testCase.points}
                    onChange={(e) => handleTestCaseChange(index, 'points', parseInt(e.target.value))}
                    min="1"
                    max="10"
                  />
                </div>
              </div>
            </div>
          ))}
          
          <button type="button" onClick={addTestCase} className="add-btn">
            + Add Another Test Case
          </button>
        </div>

        {/* Starter Code Preview */}
        {starterCode && (
          <div className="form-section">
            <h3>🎯 Starter Code Preview ({formData.codingLanguage?.toUpperCase()})</h3>
            
            <div className="code-preview">
              <pre><code>{starterCode}</code></pre>
            </div>
            
            <div className="code-actions">
              <button 
                type="button" 
                onClick={() => testCode(starterCode)} 
                disabled={testingCode}
                className="test-code-btn"
              >
                {testingCode ? '🔄 Testing...' : '🧪 Test Starter Code'}
              </button>
              <small>Test with the first test case to verify setup</small>
            </div>
          </div>
        )}

        {/* Form Actions */}
        <div className="form-actions">
          <button type="button" onClick={onClose} className="cancel-btn">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="create-btn">
            {loading ? '⏳ Creating Test...' : '🚀 Create Coding Test'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CodingTestCreator;
