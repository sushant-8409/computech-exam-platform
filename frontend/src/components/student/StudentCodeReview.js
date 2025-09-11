import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import styles from './StudentCodeReview.module.css';

const StudentCodeReview = () => {
  const { resultId } = useParams();
  const navigate = useNavigate();
  
  const [result, setResult] = useState(null);
  const [testQuestions, setTestQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuestion, setSelectedQuestion] = useState(0);
  const [expandedTestCase, setExpandedTestCase] = useState(null);

  useEffect(() => {
    fetchResultDetails();
  }, [resultId]);

  const fetchResultDetails = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      const response = await axios.get(`/api/student/results/${resultId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setResult(response.data.result);

      // Extract coding questions from test data
      const testData = response.data.test;
      let questions = [];
      
      if (testData) {
        // For modern coding tests
        if (testData.type === 'coding' && testData.coding && testData.coding.questions) {
          questions = testData.coding.questions;
        }
        // For legacy coding tests
        else if (testData.isCodingTest && testData.codingProblem) {
          questions = [{
            id: 'legacy',
            title: testData.codingProblem.title,
            description: testData.codingProblem.description,
            inputFormat: testData.codingProblem.inputFormat,
            outputFormat: testData.codingProblem.outputFormat,
            constraints: testData.codingProblem.constraints,
            examples: testData.codingProblem.examples,
            testCases: testData.codingProblem.testCases
          }];
        }
        // For traditional tests
        else if (testData.questions) {
          questions = testData.questions;
        }
      }
      
      setTestQuestions(questions);
      console.log('📊 Code Review Debug:', {
        testType: testData?.type,
        isCodingTest: testData?.isCodingTest,
        questionsFound: questions.length,
        codingResults: response.data.result.codingResults
      });

    } catch (error) {
      console.error('Error fetching result:', error);
      toast.error('Error loading result details');
      navigate('/student');
    } finally {
      setLoading(false);
    }
  };

  const toggleTestCase = (qIndex, tcIndex) => {
    const key = `${qIndex}-${tcIndex}`;
    setExpandedTestCase(expandedTestCase === key ? null : key);
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p>Loading code review...</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className={styles.error}>
        <h3>Result not found</h3>
        <button onClick={() => navigate('/student')} className={styles.backBtn}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  const codingResults = result.codingResults || {};
  const questionResults = codingResults.questionResults || [];
  const selectedQuestionResult = questionResults[selectedQuestion];
  const selectedTestQuestion = testQuestions[selectedQuestion];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <button 
            onClick={() => navigate('/student')} 
            className={styles.backBtn}
          >
            ← Back to Dashboard
          </button>
          <div className={styles.testInfo}>
            <h2>{result.testTitle}</h2>
            <div className={styles.testMeta}>
              <span className={styles.status}>{result.status}</span>
              <span className={styles.score}>
                Score: {codingResults.totalScore || 0}/{codingResults.maxScore || 0}
              </span>
              <span className={styles.percentage}>
                ({((codingResults.totalScore || 0) / (codingResults.maxScore || 0) * 100).toFixed(1)}%)
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.content}>
        {/* No Coding Results Message */}
        {questionResults.length === 0 ? (
          <div className={styles.noCodingResults}>
            <div className={styles.noResultsContent}>
              <h3>📝 No Coding Results Available</h3>
              <p>This test submission doesn't contain any coding results or test case data.</p>
              <div className={styles.resultInfo}>
                <p><strong>Test Status:</strong> {result.status}</p>
                <p><strong>Submission Type:</strong> {result.submissionType || 'Unknown'}</p>
                {result.marksObtained !== undefined && (
                  <p><strong>Score:</strong> {result.marksObtained}/{result.totalMarks}</p>
                )}
              </div>
              <p>If this was a coding test, the results might still be processing or there might have been an issue during submission.</p>
              <button 
                onClick={() => navigate('/student')} 
                className={styles.primaryBtn}
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Question Navigation */}
            <div className={styles.questionNav}>
              <h3>Questions</h3>
              <div className={styles.questionList}>
                {questionResults.map((qr, index) => (
                  <button
                    key={index}
                    className={`${styles.questionBtn} ${selectedQuestion === index ? styles.active : ''}`}
                    onClick={() => setSelectedQuestion(index)}
                  >
                    <div className={styles.questionNumber}>Q{index + 1}</div>
                    <div className={styles.questionScore}>
                      {qr.score || 0}/{qr.maxScore || 0}
                    </div>
                    <div className={styles.questionStatus}>
                      {qr.passedTestCases || 0}/{qr.totalTestCases || 0} tests
                    </div>
                  </button>
                ))}
              </div>
            </div>

        {/* Question Details */}
        <div className={styles.questionDetails}>
          {selectedQuestionResult ? (
            <>
              {/* Problem Statement */}
              {selectedTestQuestion && (
                <div className={styles.problemSection}>
                  <h4>Problem Statement</h4>
                  <div className={styles.problemContent}>
                    <div className={styles.problemTitle}>
                      {selectedTestQuestion.title || `Question ${selectedQuestion + 1}`}
                    </div>
                    <div className={styles.problemDescription}>
                      {selectedTestQuestion.description || selectedTestQuestion.problemStatement}
                    </div>
                    
                    {/* Examples */}
                    {selectedTestQuestion.examples && selectedTestQuestion.examples.length > 0 && (
                      <div className={styles.examples}>
                        <h5>Examples:</h5>
                        {selectedTestQuestion.examples.map((example, idx) => (
                          <div key={idx} className={styles.example}>
                            <div className={styles.exampleInput}>
                              <strong>Input:</strong>
                              <pre>{example.input}</pre>
                            </div>
                            <div className={styles.exampleOutput}>
                              <strong>Output:</strong>
                              <pre>{example.output}</pre>
                            </div>
                            {example.explanation && (
                              <div className={styles.exampleExplanation}>
                                <strong>Explanation:</strong>
                                <p>{example.explanation}</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Constraints */}
                    {selectedTestQuestion.constraints && (
                      <div className={styles.constraints}>
                        <h5>Constraints:</h5>
                        <pre>{selectedTestQuestion.constraints}</pre>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Your Solution */}
              <div className={styles.solutionSection}>
                <h4>Your Solution</h4>
                <div className={styles.solutionMeta}>
                  <span>Language: {selectedQuestionResult.language || 'Not specified'}</span>
                  <span>Score: {selectedQuestionResult.score || 0}/{selectedQuestionResult.maxScore || 0}</span>
                  <span>Status: {selectedQuestionResult.status || 'Unknown'}</span>
                </div>
                <div className={styles.codeContainer}>
                  <pre className={styles.code}>
                    {selectedQuestionResult.code || selectedQuestionResult.submittedCode || 'No code submitted'}
                  </pre>
                </div>
              </div>

              {/* Test Cases Results */}
              <div className={styles.testCasesSection}>
                <h4>Test Cases Results</h4>
                <div className={styles.testCasesSummary}>
                  <div className={styles.summaryStats}>
                    <span className={styles.passedCount}>
                      ✓ Passed: {selectedQuestionResult.testCasesPassed || 0}
                    </span>
                    <span className={styles.failedCount}>
                      ✗ Failed: {(selectedQuestionResult.totalTestCases || 0) - (selectedQuestionResult.testCasesPassed || 0)}
                    </span>
                    <span className={styles.totalCount}>
                      Total: {selectedQuestionResult.totalTestCases || 0}
                    </span>
                    <span className={styles.successRate}>
                      Success Rate: {
                        selectedQuestionResult.totalTestCases > 0 
                          ? ((selectedQuestionResult.testCasesPassed || 0) / selectedQuestionResult.totalTestCases * 100).toFixed(1)
                          : 0
                      }%
                    </span>
                  </div>
                </div>
                
                {selectedQuestionResult.testCases && selectedQuestionResult.testCases.length > 0 && (
                  <div className={styles.testCasesList}>
                    {selectedQuestionResult.testCases.map((tc, tcIndex) => (
                      <div 
                        key={tcIndex} 
                        className={`${styles.testCase} ${tc.passed ? styles.passed : styles.failed}`}
                      >
                        <div 
                          className={styles.testCaseHeader}
                          onClick={() => toggleTestCase(selectedQuestion, tcIndex)}
                        >
                          <div className={styles.testCaseTitle}>
                            <span>Test Case {tcIndex + 1}</span>
                            <span className={styles.testCaseDescription}>
                              {tc.description || 'Click to view details'}
                            </span>
                          </div>
                          <div className={styles.testCaseMeta}>
                            <span className={`${styles.status} ${tc.passed ? styles.success : styles.error}`}>
                              {tc.passed ? '✓ Passed' : '✗ Failed'}
                            </span>
                            {tc.executionTime && (
                              <span className={styles.time}>{tc.executionTime}ms</span>
                            )}
                            <span className={styles.points}>{tc.points || 0} pts</span>
                          </div>
                        </div>
                        
                        {/* Always show test case details for better visibility */}
                        <div className={`${styles.testCaseDetails} ${expandedTestCase === `${selectedQuestion}-${tcIndex}` ? styles.expanded : styles.collapsed}`}>
                          <div className={styles.testCaseInput}>
                            <strong>Input:</strong>
                            <pre>{tc.input}</pre>
                          </div>
                          <div className={styles.testCaseExpected}>
                            <strong>Expected Output:</strong>
                            <pre>{tc.expectedOutput}</pre>
                          </div>
                          {tc.actualOutput !== undefined && (
                            <div className={styles.testCaseActual}>
                              <strong>Your Output:</strong>
                              <pre className={tc.passed ? styles.correctOutput : styles.incorrectOutput}>
                                {tc.actualOutput}
                              </pre>
                            </div>
                          )}
                          {tc.error && (
                            <div className={styles.testCaseError}>
                              <strong>Error:</strong>
                              <pre className={styles.errorText}>{tc.error}</pre>
                            </div>
                          )}
                          {!tc.passed && (
                            <div className={styles.testCaseFeedback}>
                              <strong>💡 Hint:</strong>
                              <p>Your output doesn't match the expected result. Check your logic and edge cases.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Execution Summary */}
              {selectedQuestionResult.executionTime && (
                <div className={styles.executionSummary}>
                  <h4>Execution Summary</h4>
                  <div className={styles.executionDetails}>
                    <div>Total Execution Time: {selectedQuestionResult.executionTime}ms</div>
                    <div>Memory Usage: {selectedQuestionResult.memoryUsage || 'Not available'}</div>
                    <div>Compilation Status: {selectedQuestionResult.compilationStatus || 'Success'}</div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className={styles.noQuestionSelected}>
              <h3>Select a question to view your solution and results</h3>
            </div>
          )}
        </div>
        </>
        )}
      </div>
    </div>
  );
};

export default StudentCodeReview;
