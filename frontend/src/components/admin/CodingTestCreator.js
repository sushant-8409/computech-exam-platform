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
    if (formData.board && languageOptions[formData.board]) {
      const recommendedLang = languageOptions[formData.board][0];
      if (recommendedLang && formData.codingLanguage !== recommendedLang) {
        setFormData(prev => ({ ...prev, codingLanguage: recommendedLang }));
        generateStarterCode(recommendedLang);
      }
    }
  }, [formData.board]);

  useEffect(() => {
    if (formData.codingLanguage) {
      generateStarterCode(formData.codingLanguage);
    }
  }, [formData.codingLanguage, formData.problemTitle]);

  // JSON Import Functions
  const parseJsonProblem = (jsonStr) => {
    try {
      const parsed = JSON.parse(jsonStr);
      
      // Handle both single problem and array of problems
      const problem = Array.isArray(parsed) ? parsed[0] : parsed;
      
      if (!problem.title || !problem.description) {
        throw new Error('JSON must contain title and description fields');
      }

      return {
        problemTitle: problem.title || problem.name || '',
        problemDescription: problem.description || problem.statement || '',
        inputFormat: problem.inputFormat || problem.input_format || '',
        outputFormat: problem.outputFormat || problem.output_format || '',
        constraints: problem.constraints || '',
        timeLimit: problem.timeLimit || problem.time_limit || 2,
        memoryLimit: problem.memoryLimit || problem.memory_limit || 256,
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
      
      // Update form data with parsed values
      setFormData(prev => ({
        ...prev,
        ...parsedData
      }));

      // Clear JSON input and hide panel
      setJsonInput('');
      setShowJsonImport(false);
      
      toast.success('🎉 JSON imported successfully! Form populated with problem data.');
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

  const generateStarterCode = (language) => {
    const problemName = formData.problemTitle || 'solution';
    const functionName = problemName.toLowerCase().replace(/\s+/g, '');

    const templates = {
      'python': `def ${functionName}():
    """
    Problem: ${formData.problemTitle || 'Write your solution here'}
    
    Args:
        # Add your parameters here
        
    Returns:
        # Describe what your function should return
    """
    # Write your solution here
    pass

# Example usage:
# result = ${functionName}()
# print(result)`,

      'cpp': `#include <iostream>
#include <vector>
#include <string>
using namespace std;

class Solution {
public:
    /*
     * Problem: ${formData.problemTitle || 'Write your solution here'}
     */
    void ${functionName}() {
        // Write your solution here
        
    }
};

int main() {
    Solution solution;
    // Test your solution here
    
    return 0;
}`,

      'java': `import java.util.*;
import java.io.*;

public class Solution {
    /*
     * Problem: ${formData.problemTitle || 'Write your solution here'}
     */
    public void ${functionName}() {
        // Write your solution here
        
    }
    
    public static void main(String[] args) {
        Solution solution = new Solution();
        // Test your solution here
        
    }
}`,

      'javascript': `/*
 * Problem: ${formData.problemTitle || 'Write your solution here'}
 */
function ${functionName}() {
    // Write your solution here
    
}

// Example usage:
// const result = ${functionName}();
// console.log(result);`
    };

    setStarterCode(templates[language] || templates['python']);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
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
      setFormData(prev => ({
        ...prev,
        examples: prev.examples.filter((_, i) => i !== index)
      }));
    }
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
      setFormData(prev => ({
        ...prev,
        testCases: prev.testCases.filter((_, i) => i !== index)
      }));
    }
  };

  const testStarterCode = async () => {
    if (!starterCode.trim()) {
      toast.error('No starter code to test');
      return;
    }

    if (!formData.testCases[0]?.input) {
      toast.error('Add at least one test case to run tests');
      return;
    }

    setTestingCode(true);
    try {
      const response = await axios.post('/api/test-code', {
        code: starterCode,
        language: formData.codingLanguage,
        testCase: formData.testCases[0]
      });

      if (response.data.success) {
        toast.success('✅ Code executed successfully!');
      } else {
        toast.error(`❌ Execution failed: ${response.data.error}`);
      }
    } catch (error) {
      toast.error('Failed to test code');
      console.error('Test error:', error);
    } finally {
      setTestingCode(false);
    }
  };

  const validateForm = () => {
    const requiredFields = [
      'title', 'description', 'class', 'codingLanguage',
      'problemTitle', 'problemDescription', 'inputFormat', 'outputFormat'
    ];

    for (let field of requiredFields) {
      if (!formData[field]) {
        toast.error(`Please fill in ${field.replace(/([A-Z])/g, ' $1').toLowerCase()}`);
        return false;
      }
    }

    if (formData.examples.some(ex => !ex.input || !ex.output)) {
      toast.error('All examples must have input and output');
      return false;
    }

    if (formData.testCases.some(tc => !tc.input || !tc.expectedOutput)) {
      toast.error('All test cases must have input and expected output');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    try {
      const testData = {
        ...formData,
        coding: {
          language: formData.codingLanguage,
          starterCode: {
            [formData.codingLanguage]: starterCode
          },
          questions: [{
            title: formData.problemTitle,
            description: formData.problemDescription,
            inputFormat: formData.inputFormat,
            outputFormat: formData.outputFormat,
            constraints: formData.constraints,
            examples: formData.examples,
            testCases: formData.testCases,
            timeLimit: formData.timeLimit,
            memoryLimit: formData.memoryLimit
          }]
        }
      };

      const response = await axios.post('/api/tests', testData);
      
      if (response.data.success) {
        toast.success('🎉 Coding test created successfully!');
        onTestCreated?.(response.data.test);
        onClose();
      } else {
        toast.error('Failed to create test');
      }
    } catch (error) {
      console.error('Error creating test:', error);
      toast.error('Failed to create coding test');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="coding-test-creator-overlay">
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
              <h4>🔧 Paste Generated JSON or Upload File</h4>
              
              {/* File Upload Option */}
              <div className="file-upload-section">
                <label htmlFor="json-file-upload" className="file-upload-label">
                  📁 Upload JSON File
                </label>
                <input
                  id="json-file-upload"
                  type="file"
                  accept=".json"
                  onChange={handleJsonFileUpload}
                  style={{ display: 'none' }}
                />
                <small className="file-upload-hint">Or drag and drop a JSON file here</small>
              </div>
              
              <div className="divider">
                <span>OR</span>
              </div>
              
              {/* Text Area for JSON */}
              <textarea
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder="Paste the AI-generated JSON problem here..."
                rows="12"
                className="json-textarea"
                onDrop={handleJsonFileDrop}
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
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
              placeholder="e.g., Data Structures Quiz - Arrays and Linked Lists"
              required
            />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Brief description of the test objectives and topics covered..."
              rows="3"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Class *</label>
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

          <div className="form-row">
            <div className="form-group">
              <label>Duration (minutes) *</label>
              <input
                type="number"
                name="duration"
                value={formData.duration}
                onChange={handleInputChange}
                min="1"
                max="300"
                required
              />
            </div>

            <div className="form-group">
              <label>Total Marks *</label>
              <input
                type="number"
                name="totalMarks"
                value={formData.totalMarks}
                onChange={handleInputChange}
                min="1"
                required
              />
            </div>

            <div className="form-group">
              <label>Passing Marks *</label>
              <input
                type="number"
                name="passingMarks"
                value={formData.passingMarks}
                onChange={handleInputChange}
                min="1"
                max={formData.totalMarks}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Start Date</label>
              <input
                type="datetime-local"
                name="startDate"
                value={formData.startDate}
                onChange={handleInputChange}
              />
            </div>

            <div className="form-group">
              <label>End Date</label>
              <input
                type="datetime-local"
                name="endDate"
                value={formData.endDate}
                onChange={handleInputChange}
              />
            </div>
          </div>
        </div>

        {/* Coding Configuration */}
        <div className="form-section">
          <h3>💻 Coding Configuration</h3>
          
          <div className="form-group">
            <label>Programming Language *</label>
            <select
              name="codingLanguage"
              value={formData.codingLanguage}
              onChange={handleInputChange}
              required
            >
              <option value="">Select Language</option>
              {languageOptions[formData.board]?.map(lang => (
                <option key={lang} value={lang}>{lang.charAt(0).toUpperCase() + lang.slice(1)}</option>
              )) || (
                <>
                  <option value="python">Python</option>
                  <option value="cpp">C++</option>
                  <option value="java">Java</option>
                  <option value="javascript">JavaScript</option>
                </>
              )}
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Time Limit (seconds)</label>
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

        {/* Problem Details */}
        <div className="form-section">
          <h3>📝 Problem Details</h3>
          
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
              placeholder="Detailed problem statement with context and requirements..."
              rows="6"
              required
            />
          </div>

          <div className="form-group">
            <label>Input Format *</label>
            <textarea
              name="inputFormat"
              value={formData.inputFormat}
              onChange={handleInputChange}
              placeholder="Describe the format of input data..."
              rows="3"
              required
            />
          </div>

          <div className="form-group">
            <label>Output Format *</label>
            <textarea
              name="outputFormat"
              value={formData.outputFormat}
              onChange={handleInputChange}
              placeholder="Describe the expected output format..."
              rows="3"
              required
            />
          </div>

          <div className="form-group">
            <label>Constraints</label>
            <textarea
              name="constraints"
              value={formData.constraints}
              onChange={handleInputChange}
              placeholder="e.g., 1 ≤ n ≤ 10^5, All elements are integers..."
              rows="2"
            />
          </div>
        </div>

        {/* Examples */}
        <div className="form-section">
          <h3>💡 Examples</h3>
          {formData.examples.map((example, index) => (
            <div key={index} className="example-case">
              <div className="case-header">
                <h4>Example {index + 1}</h4>
                {formData.examples.length > 1 && (
                  <button type="button" onClick={() => removeExample(index)} className="remove-btn">
                    Remove
                  </button>
                )}
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Input</label>
                  <textarea
                    value={example.input}
                    onChange={(e) => handleExampleChange(index, 'input', e.target.value)}
                    placeholder="Sample input for this example..."
                    rows="2"
                    required
                  />
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
          <h3>🧪 Test Cases</h3>
          {formData.testCases.map((testCase, index) => (
            <div key={index} className="test-case">
              <div className="case-header">
                <h4>Test Case {index + 1}</h4>
                <div className="case-controls">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={testCase.isHidden}
                      onChange={(e) => handleTestCaseChange(index, 'isHidden', e.target.checked)}
                    />
                    Hidden
                  </label>
                  {formData.testCases.length > 1 && (
                    <button type="button" onClick={() => removeTestCase(index)} className="remove-btn">
                      Remove
                    </button>
                  )}
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Input</label>
                  <textarea
                    value={testCase.input}
                    onChange={(e) => handleTestCaseChange(index, 'input', e.target.value)}
                    placeholder="Test input..."
                    rows="2"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label>Expected Output</label>
                  <textarea
                    value={testCase.expectedOutput}
                    onChange={(e) => handleTestCaseChange(index, 'expectedOutput', e.target.value)}
                    placeholder="Expected output..."
                    rows="2"
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
            <h3>📄 Starter Code Preview</h3>
            <div className="starter-code-preview">
              <pre><code>{starterCode}</code></pre>
              <button 
                type="button" 
                onClick={testStarterCode} 
                disabled={testingCode}
                className="test-btn"
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
