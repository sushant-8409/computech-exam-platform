import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import './CodingTestReview.css';

const CodingTestReview = () => {
  const { resultId } = useParams();
  const navigate = useNavigate();
  
  const [result, setResult] = useState(null);
  const [testQuestions, setTestQuestions] = useState([]); // Full question details for 'done' status
  const [loading, setLoading] = useState(true);
  const [selectedQuestion, setSelectedQuestion] = useState(0);
  const [expandedTestCase, setExpandedTestCase] = useState(null);
  const [comments, setComments] = useState('');
  const [editableMarks, setEditableMarks] = useState({}); // For editing marks per question
  const [showQuestionDetails, setShowQuestionDetails] = useState(false); // Toggle between solution and question details

  useEffect(() => {
    fetchResultDetails();
  }, [resultId]);

  const fetchResultDetails = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/admin/login');
        return;
      }

      const response = await axios.get(`/api/admin/results/${resultId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setResult(response.data.result);
      if (response.data.result.adminComments) {
        setComments(response.data.result.adminComments);
      }

      // Initialize editable marks for 'done' status tests
      if (response.data.result.status === 'done' && response.data.result.codingResults?.questionResults) {
        const initialMarks = {};
        response.data.result.codingResults.questionResults.forEach((qr, index) => {
          initialMarks[index] = qr.score;
        });
        setEditableMarks(initialMarks);
      }

      // Fetch full question details for 'done' status tests
      if (response.data.result.status === 'done') {
        await fetchQuestionDetails();
      }

    } catch (error) {
      console.error('Failed to fetch result details:', error);
      toast.error('Failed to load result details');
      navigate('/admin/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const fetchQuestionDetails = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/admin/results/${resultId}/questions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTestQuestions(response.data.codingQuestions || []);
    } catch (error) {
      console.error('Failed to fetch question details:', error);
    }
  };

  const updateComments = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.patch(`/api/admin/results/${resultId}/comments`, 
        { comments },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Comments updated successfully');
    } catch (error) {
      console.error('Failed to update comments:', error);
      toast.error('Failed to update comments');
    }
  };

  const updateQuestionMarks = async (questionIndex, newMarks) => {
    try {
      const token = localStorage.getItem('token');
      await axios.patch(`/api/admin/results/${resultId}/question-marks`, 
        { questionIndex, marks: parseFloat(newMarks) },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Update local state
      setEditableMarks(prev => ({ ...prev, [questionIndex]: parseFloat(newMarks) }));
      
      // Update result state
      setResult(prev => {
        const updated = { ...prev };
        if (updated.codingResults && updated.codingResults.questionResults) {
          updated.codingResults.questionResults[questionIndex].score = parseFloat(newMarks);
          // Recalculate total score
          updated.codingResults.totalScore = updated.codingResults.questionResults.reduce(
            (sum, qr) => sum + qr.score, 0
          );
        }
        return updated;
      });
      
      toast.success('Question marks updated successfully');
    } catch (error) {
      console.error('Failed to update question marks:', error);
      toast.error('Failed to update question marks');
    }
  };

  const updateStatus = async (newStatus) => {
    try {
      const token = localStorage.getItem('token');
      await axios.patch(`/api/admin/results/${resultId}/status`, 
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Status updated to ${newStatus}`);
      setResult(prev => ({ ...prev, status: newStatus }));
    } catch (error) {
      console.error('Failed to update status:', error);
      toast.error('Failed to update status');
    }
  };

  if (loading) {
    return (
      <div className="coding-review-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading coding test review...</p>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="coding-review-container">
        <div className="error-message">
          <h2>Result not found</h2>
          <button onClick={() => navigate('/admin/dashboard')} className="btn btn-primary">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const codingResults = result.codingResults;
  const questionResults = codingResults?.questionResults || [];
  const currentQuestion = questionResults[selectedQuestion];
  const currentTestQuestion = testQuestions[selectedQuestion]; // Full question details

  // For 'done' status, show enhanced interface with question details
  const isDoneStatus = result.status === 'done';

  return (
    <div className="coding-review-container">
      {/* Header */}
      <div className="review-header">
        <div className="header-left">
          <button 
            onClick={() => navigate('/admin/dashboard')} 
            className="btn btn-outline back-btn"
          >
            ← Back to Dashboard
          </button>
          <div className="result-info">
            <h1>💻 Coding Test Review</h1>
            <div className="result-meta">
              <span className="student-name">👤 {result.studentId?.name || 'Unknown Student'}</span>
              <span className="test-title">📝 {result.testTitle || 'Unknown Test'}</span>
              <span className="submission-date">📅 {new Date(result.submittedAt).toLocaleString('en-IN')}</span>
              {isDoneStatus && (
                <span className="done-status-badge">🔍 Ready for Review</span>
              )}
            </div>
          </div>
        </div>
        <div className="header-right">
          <div className="status-controls">
            <label>Status:</label>
            <select 
              value={result.status} 
              onChange={(e) => updateStatus(e.target.value)}
              className="status-select"
            >
              <option value="pending">⏳ Pending</option>
              <option value="done">🔍 Done</option>
              <option value="reviewed">👁️ Reviewed</option>
              <option value="completed">✅ Completed</option>
            </select>
          </div>
          {isDoneStatus && (
            <div className="view-toggle">
              <button
                className={`toggle-btn ${!showQuestionDetails ? 'active' : ''}`}
                onClick={() => setShowQuestionDetails(false)}
              >
                💻 Solution View
              </button>
              <button
                className={`toggle-btn ${showQuestionDetails ? 'active' : ''}`}
                onClick={() => setShowQuestionDetails(true)}
              >
                📋 Question Details
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="summary-stats">
        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <h3>{codingResults?.totalScore || 0}/{codingResults?.maxScore || 0}</h3>
            <p>Total Score</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <h3>{codingResults?.passedTestCases || 0}/{codingResults?.totalTestCases || 0}</h3>
            <p>Test Cases Passed</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">💻</div>
          <div className="stat-content">
            <h3>{questionResults.length}</h3>
            <p>Questions Attempted</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⚡</div>
          <div className="stat-content">
            <h3>{result.percentage ? `${result.percentage.toFixed(1)}%` : '0%'}</h3>
            <p>Overall Performance</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="review-content">
        {/* Question Navigation */}
        <div className="question-nav">
          <h3>Questions</h3>
          <div className="question-list">
            {questionResults.map((qr, index) => (
              <button
                key={index}
                className={`question-nav-item ${selectedQuestion === index ? 'active' : ''} ${
                  qr.passedTestCases === qr.totalTestCases ? 'all-passed' : 
                  qr.passedTestCases > 0 ? 'partial-passed' : 'failed'
                }`}
                onClick={() => setSelectedQuestion(index)}
              >
                <div className="question-number">Q{index + 1}</div>
                <div className="question-title">{qr.questionTitle || `Question ${index + 1}`}</div>
                <div className="question-stats">
                  {qr.passedTestCases}/{qr.totalTestCases} Tests
                </div>
                <div className="question-score">
                  {isDoneStatus ? (
                    <div className="editable-score">
                      <input
                        type="number"
                        min="0"
                        max={qr.maxScore}
                        step="0.1"
                        value={editableMarks[index] || qr.score}
                        onChange={(e) => {
                          const newValue = e.target.value;
                          setEditableMarks(prev => ({ ...prev, [index]: newValue }));
                        }}
                        onBlur={(e) => {
                          const newValue = parseFloat(e.target.value);
                          if (!isNaN(newValue) && newValue !== qr.score) {
                            updateQuestionMarks(index, newValue);
                          }
                        }}
                        className="score-input"
                      />
                      <span>/{qr.maxScore}</span>
                    </div>
                  ) : (
                    `${qr.score}/${qr.maxScore} pts`
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Question Details */}
        <div className="question-details">
          {currentQuestion ? (
            <>
              {/* Question Header */}
              <div className="question-header">
                <h2>{currentQuestion.questionTitle || `Question ${selectedQuestion + 1}`}</h2>
                <div className="question-meta">
                  <span className="language-badge">{currentQuestion.language}</span>
                  <span className="score-badge">
                    {isDoneStatus ? (
                      <div className="editable-score-header">
                        <input
                          type="number"
                          min="0"
                          max={currentQuestion.maxScore}
                          step="0.1"
                          value={editableMarks[selectedQuestion] || currentQuestion.score}
                          onChange={(e) => {
                            const newValue = e.target.value;
                            setEditableMarks(prev => ({ ...prev, [selectedQuestion]: newValue }));
                          }}
                          onBlur={(e) => {
                            const newValue = parseFloat(e.target.value);
                            if (!isNaN(newValue) && newValue !== currentQuestion.score) {
                              updateQuestionMarks(selectedQuestion, newValue);
                            }
                          }}
                          className="score-input-large"
                        />
                        <span>/{currentQuestion.maxScore} points</span>
                      </div>
                    ) : (
                      `${currentQuestion.score}/${currentQuestion.maxScore} points`
                    )}
                  </span>
                  <span className={`status-badge ${
                    currentQuestion.passedTestCases === currentQuestion.totalTestCases ? 'passed' : 
                    currentQuestion.passedTestCases > 0 ? 'partial' : 'failed'
                  }`}>
                    {currentQuestion.passedTestCases}/{currentQuestion.totalTestCases} passed
                  </span>
                </div>
              </div>

              {/* Conditional Content Based on Toggle */}
              {isDoneStatus && showQuestionDetails && currentTestQuestion ? (
                // Question Details View for 'done' status
                <>
                  <div className="question-problem-section">
                    <h3>📋 Problem Statement</h3>
                    <div className="problem-description">
                      <p>{currentTestQuestion.description}</p>
                    </div>
                  </div>

                  <div className="question-format-section">
                    <div className="format-item">
                      <h4>📥 Input Format:</h4>
                      <div className="format-content">{currentTestQuestion.inputFormat}</div>
                    </div>
                    <div className="format-item">
                      <h4>📤 Output Format:</h4>
                      <div className="format-content">{currentTestQuestion.outputFormat}</div>
                    </div>
                    <div className="format-item">
                      <h4>⚡ Constraints:</h4>
                      <div className="format-content">{currentTestQuestion.constraints}</div>
                    </div>
                  </div>

                  {currentTestQuestion.examples && (
                    <div className="question-examples-section">
                      <h3>💡 Examples</h3>
                      {currentTestQuestion.examples.map((example, exIndex) => (
                        <div key={exIndex} className="example-item">
                          <h4>Example {exIndex + 1}:</h4>
                          <div className="example-io">
                            <div className="example-input">
                              <strong>Input:</strong>
                              <pre>{example.input}</pre>
                            </div>
                            <div className="example-output">
                              <strong>Output:</strong>
                              <pre>{example.output}</pre>
                            </div>
                            {example.explanation && (
                              <div className="example-explanation">
                                <strong>Explanation:</strong>
                                <p>{example.explanation}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {currentTestQuestion.testCases && (
                    <div className="question-test-cases-section">
                      <h3>🧪 All Test Cases</h3>
                      {currentTestQuestion.testCases.map((testCase, tcIndex) => (
                        <div key={tcIndex} className="predefined-test-case">
                          <h4>Test Case {tcIndex + 1}</h4>
                          <div className="test-case-io">
                            <div className="input-section">
                              <strong>Input:</strong>
                              <pre>{testCase.input}</pre>
                            </div>
                            <div className="output-section">
                              <strong>Expected Output:</strong>
                              <pre>{testCase.expectedOutput}</pre>
                            </div>
                            <div className="points-section">
                              <strong>Points:</strong> {testCase.points}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                // Solution View (default for all status, only view for non-'done' status)
                <>
                  {/* Code Solution */}
                  <div className="code-section">
                    <h3>💻 Student's Solution</h3>
                    <div className="code-container">
                      <div className="code-header">
                        <span className="language">{currentQuestion.language}</span>
                        <span className="execution-time">⏱️ {currentQuestion.executionTime}ms</span>
                      </div>
                      <pre className="code-block">
                        <code>{currentQuestion.code}</code>
                      </pre>
                    </div>
                  </div>

                  {/* Test Cases Results */}
                  <div className="test-cases-section">
                    <h3>🧪 Test Cases Results</h3>
                    <div className="test-cases-list">
                      {currentQuestion.results?.map((testCase, tcIndex) => (
                        <div 
                          key={tcIndex} 
                          className={`test-case-item ${testCase.passed ? 'passed' : 'failed'}`}
                        >
                          <div 
                            className="test-case-header"
                            onClick={() => setExpandedTestCase(expandedTestCase === tcIndex ? null : tcIndex)}
                          >
                            <div className="test-case-info">
                              <span className="test-case-number">Test Case {tcIndex + 1}</span>
                              <span className={`test-case-status ${testCase.passed ? 'passed' : 'failed'}`}>
                                {testCase.passed ? '✅ Passed' : '❌ Failed'}
                              </span>
                            </div>
                            <div className="test-case-metrics">
                              <span className="execution-time">⏱️ {testCase.executionTime}ms</span>
                              <span className="memory">💾 {testCase.memory || 'N/A'}KB</span>
                            </div>
                            <span className="expand-icon">
                              {expandedTestCase === tcIndex ? '▼' : '▶'}
                            </span>
                          </div>
                          
                          {expandedTestCase === tcIndex && (
                            <div className="test-case-details">
                              <div className="test-case-io">
                                <div className="input-section">
                                  <h4>Input:</h4>
                                  <pre className="io-content">{testCase.input || 'No input'}</pre>
                                </div>
                                <div className="output-section">
                                  <h4>Expected Output:</h4>
                                  <pre className="io-content expected">{testCase.expectedOutput}</pre>
                                </div>
                                <div className="output-section">
                                  <h4>Actual Output:</h4>
                                  <pre className={`io-content ${testCase.passed ? 'passed' : 'failed'}`}>
                                    {testCase.actualOutput || 'No output'}
                                  </pre>
                                </div>
                                {testCase.error && (
                                  <div className="error-section">
                                    <h4>Error:</h4>
                                    <pre className="error-content">{testCase.error}</pre>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Code Quality Analysis */}
                  {currentQuestion.codeQuality && (
                    <div className="code-quality-section">
                      <h3>📈 Code Quality Analysis</h3>
                      <div className="quality-metrics">
                        <div className="metric">
                          <span className="metric-label">Lines of Code:</span>
                          <span className="metric-value">{currentQuestion.codeQuality.linesOfCode}</span>
                        </div>
                        <div className="metric">
                          <span className="metric-label">Complexity:</span>
                          <span className={`metric-value complexity-${currentQuestion.codeQuality.complexity}`}>
                            {currentQuestion.codeQuality.complexity}
                          </span>
                        </div>
                        <div className="metric">
                          <span className="metric-label">Has Comments:</span>
                          <span className="metric-value">
                            {currentQuestion.codeQuality.hasComments ? '✅ Yes' : '❌ No'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
            <div className="no-question-selected">
              <h3>Select a question to view details</h3>
            </div>
          )}
        </div>
      </div>

      {/* Comments Section */}
      <div className="comments-section">
        <h3>📝 Admin Comments</h3>
        <div className="comments-container">
          <textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder="Add your review comments here..."
            className="comments-textarea"
          />
          <button onClick={updateComments} className="btn btn-primary">
            💾 Save Comments
          </button>
        </div>
      </div>
    </div>
  );
};

export default CodingTestReview;
