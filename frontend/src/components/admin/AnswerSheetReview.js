import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2'; // Import SweetAlert2 for user-friendly pop-ups
import styles from './AnswerSheetReview.module.css';
import { toast } from 'react-toastify';
// Make sure you have a way to navigate, e.g., from react-router-dom
import { useNavigate, useLocation } from 'react-router-dom';
import { enhanceEmbedUrl } from '../../utils/googleDriveUtils';
import { useTheme } from '../../App'; // Import theme context

export default function AnswerSheetReview() {
  // Theme context
  const { darkMode } = useTheme();
  
  // Navigation and location
  const navigate = useNavigate();
  const location = useLocation();
  
  const [list, setList] = useState([]);
  const [active, setActive] = useState(null);
  const [saving, setSaving] = useState(false);

  // State for view toggle
  const [viewMode, setViewMode] = useState('answerSheet');

  // State for the grading grid
  const [qNums, setQNums] = useState([]);
  const [qMax, setQMax] = useState([]);
  const [marks, setMarks] = useState([]);
  const [remarks, setRemarks] = useState([]);
  const [adminComments, setAdminComments] = useState('');

  // State for coding test data
  const [codingQuestions, setCodingQuestions] = useState([]);
  const [codingResults, setCodingResults] = useState(null);
  const [testType, setTestType] = useState('traditional');

  // State for tracking changes
  const [origQMax, setOrigQMax] = useState([]);
  const [origMarks, setOrigMarks] = useState([]);
  const [origRemarks, setOrigRemarks] = useState([]);
  const [origAdminComments, setOrigAdminComments] = useState('');

  const loadList = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error("No auth token found.");
      const { data } = await axios.get('/api/admin/results-for-review', { headers: { Authorization: `Bearer ${token}` } });
      if (data.success) setList(data.results);
    } catch (err) {
      toast.error("Failed to load review list.");
      if (err.response?.status === 401) navigate('/login'); // Redirect if initial load fails auth
    }
  };
  useEffect(() => { loadList(); }, []);

  // Handle navigation state (e.g., coming from results page)
  useEffect(() => {
    const fromResult = location.state?.fromResult;
    const defaultTab = location.state?.defaultTab;
    
    if (fromResult && list.length > 0) {
      // Find the result in the list and auto-select it
      const foundResult = list.find(r => r._id === fromResult._id);
      if (foundResult) {
        open(foundResult);
        
        // Set the default tab if specified
        if (defaultTab === 'coding') {
          // Small delay to ensure the component is ready
          setTimeout(() => setViewMode('coding'), 100);
        }
      }
    }
  }, [list, location.state]);

  // Function to load monitoring images from Google Drive
  const loadMonitoringImages = async (testId, studentId) => {
    try {
      const response = await axios.get(
        `/api/monitoring/images/${testId}/${studentId}`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      
      if (response.data.success) {
        console.log(`📷 Loaded ${response.data.count} monitoring images from Google Drive`);
        return response.data.images;
      }
      return [];
    } catch (error) {
      console.warn('Failed to load monitoring images:', error);
      return [];
    }
  };

  // Function to get the current iframe URL based on viewMode
  const getCurrentUrl = () => {
    if (!active) return null;
    
    switch (viewMode) {
      case 'questionPaper':
        return active.questionPaperURL || active.questionPaperUrl;
      case 'answerKey':
        return active.answerKeyURL || active.answerKeyUrl;
      case 'answerSheet':
      default:
        return active.answerSheetURL || active.answerSheetUrl;
    }
  };

  // Function to get the current iframe title based on viewMode
  const getCurrentTitle = () => {
    switch (viewMode) {
      case 'questionPaper':
        return 'Question Paper';
      case 'answerKey':
        return 'Answer Key';
      case 'answerSheet':
      default:
        return 'Answer Sheet';
    }
  };

  const open = async (resObj) => {
    setActive(resObj);
    
    // Set default view mode based on status and test type
    // Status-based classification:
    // - pending, underreview → Traditional test
    // - done → Coding test
    const isTraditionalTest = ['pending', 'underreview'].includes(resObj.status);
    const isCodingTest = resObj.status === 'done';
    
    // Set view mode based on test type
    if (isCodingTest) {
      setViewMode('coding');
      setTestType('coding');
    } else {
      setViewMode('answerSheet'); // Traditional tests use answer sheet view
      setTestType('traditional');
    }
    
    const url = resObj.reviewMode
      ? `/api/admin/review-results/${resObj._id}/questions`
      : `/api/admin/results/${resObj._id}/questions`;

    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error("No auth token found.");
      const { data } = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!data.success) throw new Error(data.message);

      setQNums(data.questions);
      setQMax(data.maxMarks);
      setOrigQMax(data.maxMarks);
      
      // Set coding test data
      setTestType(data.testType || 'traditional');
      setCodingQuestions(data.codingQuestions || []);
      setCodingResults(data.codingResults || resObj.codingResults);

      // Update active object with test URLs from backend (handle both naming conventions)
      setActive(prev => ({
        ...prev,
        questionPaperURL: data.questionPaperURL || data.questionPaperUrl,
        answerKeyURL: data.answerKeyURL || data.answerKeyUrl,
        // Also preserve original field names for backwards compatibility
        questionPaperUrl: data.questionPaperUrl,
        answerKeyUrl: data.answerKeyUrl,
        // Add test type and coding data
        testType: data.testType,
        codingQuestions: data.codingQuestions,
        codingResults: data.codingResults || resObj.codingResults,
        isCodingTest: data.testType === 'coding' || resObj.isCodingTest,
        // Include monitoring and violation data
        violations: resObj.violations || [],
        monitoringImages: resObj.monitoringImages || [],
        suspiciousActivities: resObj.suspiciousActivities || []
      }));

      // Load monitoring images from Google Drive after setting active
      try {
        const monitoringImages = await loadMonitoringImages(data._id, resObj.studentId._id || resObj.studentId);
        if (monitoringImages.length > 0) {
          setActive(prev => ({
            ...prev,
            monitoringImages: monitoringImages
          }));
          console.log(`📷 Loaded ${monitoringImages.length} monitoring images from Google Drive`);
        }
      } catch (error) {
        console.warn('Failed to load monitoring images:', error);
      }

      // Debug monitoring data
      console.log('📊 Admin Review - Monitoring Data Debug:', {
        violationsCount: resObj.violations?.length || 0,
        monitoringImagesCount: resObj.monitoringImages?.length || 0,
        sampleViolation: resObj.violations?.[0] || 'No violations',
        sampleMonitoringImage: resObj.monitoringImages?.[0] ? {
          hasUrl: !!resObj.monitoringImages[0].url,
          hasData: !!resObj.monitoringImages[0].data,
          hasImageData: !!resObj.monitoringImages[0].imageData,
          timestamp: resObj.monitoringImages[0].timestamp,
          type: resObj.monitoringImages[0].type
        } : 'No monitoring images'
      });

      const gridMarks = [], gridRemarks = [];
      data.questions.forEach(qNum => {
        const row = (resObj.questionWiseMarks || []).find(x => x.questionNo === qNum);
        gridMarks.push(row?.obtainedMarks ?? 0);
        gridRemarks.push(row?.remarks ?? '');
      });
      setMarks(gridMarks);
      setOrigMarks(gridMarks);
      setRemarks(gridRemarks);
      setOrigRemarks(gridRemarks);
      setAdminComments(resObj.adminComments || '');
      setOrigAdminComments(resObj.adminComments || '');
      
      // Override default tab behavior for specific cases
      if (location.state?.defaultTab === 'answerSheet') {
        setViewMode('answerSheet');
      } else if (location.state?.defaultTab === 'coding') {
        setViewMode('coding');
      }
      // If no override, keep the status-based default set above
      
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not load question details.");
    }
  };

  const tweak = (idx, val) => setMarks(m => m.map((orig, i) => i === idx ? Math.max(0, Math.min(qMax[i] || 0, +val || 0)) : orig));
  const tweakMax = (idx, val) => setQMax(m => m.map((orig, i) => i === idx ? Math.max(0, +val || 0) : orig));
  const tweakRemarks = (idx, val) => setRemarks(r => r.map((orig, i) => i === idx ? val : orig));

  const totalMax = qMax.reduce((s, n) => s + (Number(n) || 0), 0);
  const totalGot = marks.reduce((s, n) => s + (Number(n) || 0), 0);

  const changed = JSON.stringify(marks) !== JSON.stringify(origMarks) ||
    JSON.stringify(qMax) !== JSON.stringify(origQMax) ||
    JSON.stringify(remarks) !== JSON.stringify(origRemarks) ||
    adminComments !== origAdminComments;

  // ✅ UPDATED SAVE FUNCTION WITH BETTER ERROR HANDLING
  const save = async () => {
    if (!changed) return;
    setSaving(true);

    const url = active.reviewMode
      ? `/api/admin/review-results/${active._id}/marks`
      : `/api/admin/results/${active._id}/marks`;

    const payload = {
      questionWiseMarks: qNums.map((num, i) => ({
        questionNo: num, obtainedMarks: marks[i],
        maxMarks: qMax[i], remarks: remarks[i] || ''
      })),
      adminComments: adminComments
    };

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        // This case handles if the user is already logged out in another tab
        throw new Error("Authentication Error: No token found.");
      }

      await axios.patch(url, payload, { headers: { Authorization: `Bearer ${token}` } });

      toast.success('Grades saved successfully!');
      await loadList();
      setActive(null);

    } catch (err) {
      console.error("Save error:", err);

      // ✅ This block specifically handles the 401 Unauthorized error
      if (err.response?.status === 401) {
        Swal.fire({
          title: 'Session Expired',
          text: 'Your session has timed out. Please log in again to save your work.',
          icon: 'warning',
          confirmButtonText: 'Go to Login',
          confirmButtonColor: '#3085d6'
        }).then(() => {
          // Here you would typically call a global logout function from your AuthContext
          // For now, we'll navigate directly to the login page.
          navigate('/login');
        });
      } else {
        toast.error(err.response?.data?.message || 'Failed to save changes.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`${styles.page} ${darkMode ? styles.dark : styles.light}`}>
      <aside className={styles.left}>
        <h2>Pending / Under-review</h2>
        {(list || []).length === 0 ? (
          <div className={styles.noPapers}>
            <div className={styles.noPapersIcon}>📋</div>
            <h3>No Papers to Review</h3>
            <p>All submitted papers have been reviewed and graded.</p>
          </div>
        ) : (
          <ul className={styles.rows}>
            {(list || []).map(r => (
              <li key={r._id} onClick={() => open(r)} className={active?._id === r._id ? styles.sel : ''}>
                <span>{r.studentName} – {r.testTitle}</span>
                <div className={styles.listMeta}>
                  <span className={`${styles.testType} ${r.status === 'done' ? styles.coding : styles.traditional}`}>
                    {r.status === 'done' ? '💻 Coding' : '📄 Traditional'}
                  </span>
                  <span className={`${styles.tag} ${r.status === 'pending' ? styles.pending : styles.under}`}>{r.status}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </aside>
      {active && (
        <section className={styles.right}>
          <header className={styles.header}>
            <h3>{active.studentName} | {active.testTitle}</h3>
            <small>Status: {active.status}</small>
            <div style={{marginLeft: '12px', display: 'flex', gap: '8px'}}>
              {/* Test Resume Button - for students who mistakenly exited */}
              {(active.status === 'pending' || active.status === 'exited') && (
                <button
                  className={styles.resumeButton}
                  onClick={async () => {
                    const token = localStorage.getItem('token');
                    if (!token) return toast.error('Authentication required.');

                    const { value } = await Swal.fire({
                      title: 'Allow Test Resume? 🔄',
                      html: `
                        <p>This will allow <strong>${active.studentName}</strong> to resume their test:</p>
                        <p><strong>${active.testTitle}</strong></p>
                        <br>
                        <p style="color: #f59e0b;">⚠️ Use this only if the student mistakenly exited the test and needs to continue.</p>
                      `,
                      icon: 'question',
                      showCancelButton: true,
                      confirmButtonText: '✅ Allow Resume',
                      cancelButtonText: '❌ Cancel',
                      confirmButtonColor: '#10b981',
                      cancelButtonColor: '#6b7280'
                    });

                    if (!value) return;

                    try {
                      await axios.patch(`/api/admin/results/${active._id}/allow-resume`, {}, { 
                        headers: { Authorization: `Bearer ${token}` } 
                      });
                      
                      toast.success('✅ Test resume enabled for student');
                      await loadList();
                    } catch (err) {
                      console.error('Resume enable failed:', err);
                      if (err.response?.status === 401) {
                        Swal.fire({ 
                          title: 'Session expired', 
                          text: 'Please login again', 
                          icon: 'warning' 
                        }).then(() => navigate('/login'));
                      } else {
                        toast.error(err.response?.data?.message || 'Failed to enable test resume');
                      }
                    }
                  }}
                  title='Allow student to resume test'
                >
                  🔄 Allow Resume
                </button>
              )}
              
              <button
                className={styles.deleteButton}
                onClick={async () => {
                  const token = localStorage.getItem('token');
                  if (!token) return toast.error('Authentication required.');

                  const { value } = await Swal.fire({
                    title: 'Delete result? 🎯',
                    text: 'This action will permanently delete the result. This cannot be undone.',
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'Yes, delete it',
                    confirmButtonColor: '#d33'
                  });

                  if (!value) return; // cancelled

                  try {
                    await axios.delete(`/api/admin/results/${active._id}`, { headers: { Authorization: `Bearer ${token}` } });
                    toast.success('Result deleted');
                    await loadList();
                    setActive(null);
                  } catch (err) {
                    console.error('Delete failed:', err);
                    if (err.response?.status === 401) {
                      Swal.fire({ title: 'Session expired', text: 'Please login again', icon: 'warning' }).then(() => navigate('/login'));
                    } else {
                      toast.error(err.response?.data?.message || 'Failed to delete result');
                    }
                  }
                }}
                title='Delete result'
              >
                Delete
              </button>
            </div>
          </header>
          {active.status === 'under review' && active.studentComments && (
            <div className={styles.studentComment}>
              <h5>Student's comment</h5>
              <p>{active.studentComments}</p>
            </div>
          )}
          
          {/* Toggle buttons for different document views */}
          <div className={styles.toggleButtons}>
            <button 
              className={`${styles.toggleButton} ${viewMode === 'answerSheet' ? styles.active : ''}`}
              onClick={() => setViewMode('answerSheet')}
            >
              Answer Sheet
            </button>
            <button 
              className={`${styles.toggleButton} ${viewMode === 'questionPaper' ? styles.active : ''}`}
              onClick={() => setViewMode('questionPaper')}
              disabled={!active.questionPaperUrl}
            >
              Question Paper
            </button>
            <button 
              className={`${styles.toggleButton} ${viewMode === 'answerKey' ? styles.active : ''}`}
              onClick={() => setViewMode('answerKey')}
              disabled={!(active.answerKeyURL || active.answerKeyUrl)}
            >
              Answer Key
            </button>
            {/* Coding tab - show for coding tests (status === 'done') */}
            {active.status === 'done' && (
              <button 
                className={`${styles.toggleButton} ${viewMode === 'coding' ? styles.active : ''}`}
                onClick={() => setViewMode('coding')}
              >
                💻 Coding
              </button>
            )}
            <button 
              className={`${styles.toggleButton} ${viewMode === 'monitoring' ? styles.active : ''}`}
              onClick={() => setViewMode('monitoring')}
            >
              🔍 Monitoring Data
            </button>
          </div>

          <div className={styles.contentGrid}>
            {viewMode === 'coding' ? (
              <div className={styles.codingData}>
                <div className={styles.codingSection}>
                  <h4>💻 Coding Test Review</h4>
                  
                  {/* Overall Coding Results */}
                  <div className={styles.codingOverview}>
                    <h5>📊 Overall Results</h5>
                    <div className={styles.codingStats}>
                      {codingResults || active.codingResults ? (
                        <>
                          <div className={styles.statItem}>
                            <label>Problems Attempted:</label>
                            <span>{codingResults?.questionsAttempted || active.codingResults?.questionsAttempted || codingResults?.questionResults?.length || 0}</span>
                          </div>
                          <div className={styles.statItem}>
                            <label>Problems Completed:</label>
                            <span>{codingResults?.questionsCompleted || active.codingResults?.questionsCompleted || 0}</span>
                          </div>
                          <div className={styles.statItem}>
                            <label>Test Cases Passed:</label>
                            <span className={styles.testCasesScore}>
                              {codingResults?.passedTestCases || active.codingResults?.passedTestCases || 0} / {codingResults?.totalTestCases || active.codingResults?.totalTestCases || 0}
                            </span>
                          </div>
                          <div className={styles.statItem}>
                            <label>Overall Score:</label>
                            <span className={styles.overallScore}>
                              {totalMax > 0 ? `${((totalGot / totalMax) * 100).toFixed(1)}%` : '0%'} ({totalGot}/{totalMax})
                              {active.percentage !== undefined && Math.abs(active.percentage - ((totalGot / totalMax) * 100)) > 0.1 && (
                                <small className={styles.originalScore}>
                                  (Original: {active.percentage.toFixed(1)}%)
                                </small>
                              )}
                            </span>
                          </div>
                          <div className={styles.statItem}>
                            <label>Total Execution Time:</label>
                            <span>{codingResults?.questionResults?.reduce((total, q) => total + (q.executionTime || 0), 0) || 'N/A'}ms</span>
                          </div>
                        </>
                      ) : (
                        <p className={styles.noData}>No coding results available</p>
                      )}
                    </div>
                  </div>

                  {/* Problem-wise Solutions */}
                  <div className={styles.problemSolutions}>
                    <h5>🧑‍💻 Submitted Solutions</h5>
                    {codingResults?.questionResults ? (
                      <div className={styles.solutionsList}>
                        {codingResults.questionResults.map((solution, index) => {
                          // Find corresponding question from test data
                          const questionInfo = codingQuestions.find(q => q.id === solution.questionId) || {};
                          
                          return (
                            <div key={index} className={styles.solutionItem}>
                              <div className={styles.solutionHeader}>
                                <h6>Problem {index + 1}: {questionInfo.title || solution.questionTitle || `Question ${index + 1}`}</h6>
                                <div className={styles.solutionStatus}>
                                  <span className={`${styles.statusBadge} ${solution.percentage >= 70 ? styles.passed : styles.failed}`}>
                                    {solution.percentage >= 70 ? '✅ Passed' : '❌ Failed'} ({solution.percentage.toFixed(1)}%)
                                  </span>
                                  <span className={styles.testCasesInfo}>
                                    {solution.passedTestCases}/{solution.totalTestCases} tests
                                  </span>
                                </div>
                              </div>
                              
                              {/* Problem Statement */}
                              <div className={styles.problemStatement}>
                                <h7>📋 Problem Statement:</h7>
                                <div className={styles.problemDescription}>
                                  {questionInfo.description || 'Problem statement not available'}
                                </div>
                                
                                {/* Input/Output Format */}
                                {questionInfo.inputFormat && (
                                  <div className={styles.formatSection}>
                                    <strong>Input Format:</strong>
                                    <pre>{questionInfo.inputFormat}</pre>
                                  </div>
                                )}
                                {questionInfo.outputFormat && (
                                  <div className={styles.formatSection}>
                                    <strong>Output Format:</strong>
                                    <pre>{questionInfo.outputFormat}</pre>
                                  </div>
                                )}
                                
                                {/* Examples */}
                                {questionInfo.examples && questionInfo.examples.length > 0 && (
                                  <div className={styles.examplesSection}>
                                    <strong>Examples:</strong>
                                    {questionInfo.examples.map((example, exIndex) => (
                                      <div key={exIndex} className={styles.example}>
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
                                {questionInfo.constraints && (
                                  <div className={styles.constraintsSection}>
                                    <strong>Constraints:</strong>
                                    <pre>{questionInfo.constraints}</pre>
                                  </div>
                                )}
                              </div>

                              {/* Student's Code */}
                              <div className={styles.codeSection}>
                                <h7>💻 Student's Solution:</h7>
                                <pre className={styles.codeBlock}>
                                  <code>{solution.code || 'No code submitted'}</code>
                                </pre>
                                <div className={styles.codeMetrics}>
                                  <span>Language: {solution.language || 'N/A'}</span>
                                  <span>Execution Time: {solution.executionTime || 'N/A'}ms</span>
                                  <span>Score: {solution.score}/{solution.maxScore}</span>
                                </div>
                              </div>

                              {/* Test Cases */}
                              {solution.testCases && solution.testCases.length > 0 && (
                                <div className={styles.testCasesSection}>
                                  <h7>🧪 Test Cases Results:</h7>
                                  
                                  {/* Test Cases Summary */}
                                  <div className={styles.testCasesSummary}>
                                    <div className={styles.summaryStats}>
                                      <span className={styles.passedCount}>
                                        ✓ Passed: {solution.passedTestCases || 0}
                                      </span>
                                      <span className={styles.failedCount}>
                                        ✗ Failed: {(solution.totalTestCases || 0) - (solution.passedTestCases || 0)}
                                      </span>
                                      <span className={styles.totalCount}>
                                        Total: {solution.totalTestCases || 0}
                                      </span>
                                      <span className={styles.successRate}>
                                        Success Rate: {solution.percentage?.toFixed(1) || 0}%
                                      </span>
                                    </div>
                                  </div>
                                  
                                  <div className={styles.testCasesList}>
                                    {solution.testCases.map((testCase, tcIndex) => (
                                      <div key={tcIndex} className={`${styles.testCase} ${testCase.passed ? styles.tcPassed : styles.tcFailed}`}>
                                        <div className={styles.testCaseHeader}>
                                          <div className={styles.testCaseTitle}>
                                            <span>Test Case {tcIndex + 1}</span>
                                            <span className={styles.testCaseDescription}>
                                              {testCase.description || 'Detailed test case results'}
                                            </span>
                                          </div>
                                          <div className={styles.tcMeta}>
                                            <span className={`${styles.tcStatus} ${testCase.passed ? styles.tcSuccess : styles.tcError}`}>
                                              {testCase.passed ? '✅ Passed' : '❌ Failed'}
                                            </span>
                                            {testCase.executionTime && (
                                              <span className={styles.tcTime}>{testCase.executionTime}ms</span>
                                            )}
                                            <span className={styles.tcPoints}>{testCase.points || 0} pts</span>
                                          </div>
                                        </div>
                                        <div className={styles.testCaseDetails}>
                                          <div className={styles.tcInput}>
                                            <strong>Input:</strong>
                                            <pre>{testCase.input}</pre>
                                          </div>
                                          <div className={styles.tcExpected}>
                                            <strong>Expected Output:</strong>
                                            <pre>{testCase.expectedOutput}</pre>
                                          </div>
                                          {testCase.actualOutput !== undefined && (
                                            <div className={`${styles.tcActual} ${testCase.passed ? styles.tcCorrect : styles.tcIncorrect}`}>
                                              <strong>Student's Output:</strong>
                                              <pre>{testCase.actualOutput}</pre>
                                            </div>
                                          )}
                                          {testCase.error && (
                                            <div className={styles.tcError}>
                                              <strong>Error:</strong>
                                              <pre className={styles.errorText}>{testCase.error}</pre>
                                            </div>
                                          )}
                                          {!testCase.passed && (
                                            <div className={styles.tcFeedback}>
                                              <strong>💡 Analysis:</strong>
                                              <p>This test case failed. The student's output doesn't match the expected result.</p>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className={styles.noData}>No coding solutions found</p>
                    )}
                  </div>

                  {/* Enhanced Monitoring & Violations in Coding Context */}
                  <div className={styles.codingMonitoring}>
                    <h5>🔍 Proctoring & Monitoring Summary</h5>
                    
                    {/* Session Statistics */}
                    <div className={styles.sessionStats}>
                      <div className={styles.statGrid}>
                        <div className={styles.statItem}>
                          <span className={styles.statLabel}>Status:</span>
                          <span className={`${styles.statValue} ${styles.status} ${styles[active.status]}`}>
                            {active.status === 'done' ? '✅ Completed' : 
                             active.status === 'pending' ? '⏳ Pending Review' :
                             active.status === 'under review' ? '👁️ Under Review' : 
                             active.status}
                          </span>
                        </div>
                        <div className={styles.statItem}>
                          <span className={styles.statLabel}>Violations:</span>
                          <span className={styles.statValue}>
                            {active.violations ? active.violations.length : 0}
                          </span>
                        </div>
                        <div className={styles.statItem}>
                          <span className={styles.statLabel}>Duration:</span>
                          <span className={styles.statValue}>
                            {active.timeTaken ? `${Math.floor(active.timeTaken / 60)}m ${active.timeTaken % 60}s` : 'N/A'}
                          </span>
                        </div>
                        <div className={styles.statItem}>
                          <span className={styles.statLabel}>Focus Lost:</span>
                          <span className={styles.statValue}>{active.focusLostCount || 0} times</span>
                        </div>
                        <div className={styles.statItem}>
                          <span className={styles.statLabel}>Camera:</span>
                          <span className={styles.statValue}>
                            {active.cameraMonitoring ? '✅ Enabled' : '❌ Disabled'}
                          </span>
                        </div>
                        <div className={styles.statItem}>
                          <span className={styles.statLabel}>Images:</span>
                          <span className={styles.statValue}>
                            {active.monitoringImages ? active.monitoringImages.length : 0} captured
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Violations Details */}
                    {active.violations && active.violations.length > 0 && (
                      <div className={styles.violationsDetails}>
                        <h6>⚠️ Violation Details ({active.violations.length})</h6>
                        <div className={styles.violationsList}>
                          {active.violations.map((violation, index) => (
                            <div key={index} className={`${styles.violationItem} ${styles.compactViolation}`}>
                              <div className={styles.violationHeader}>
                                <span className={styles.violationType}>{violation.type}</span>
                                <span className={styles.violationTime}>
                                  {new Date(violation.timestamp).toLocaleString()}
                                </span>
                              </div>
                              <p className={styles.violationDetails}>{violation.details}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Quick Monitoring Images Preview */}
                    {active.monitoringImages && active.monitoringImages.length > 0 && (
                      <div className={styles.quickImagePreview}>
                        <h6>📸 Monitoring Images Preview</h6>
                        <div className={styles.miniImageGrid}>
                          {active.monitoringImages.slice(0, 6).map((image, index) => (
                            <div key={index} className={styles.miniImageItem}>
                              <img 
                                src={image.url || image.data || image.imageData} 
                                alt={`Monitor ${index + 1}`}
                                className={styles.miniMonitoringImage}
                                onClick={() => setViewMode('monitoring')}
                                title="Click to view all monitoring data"
                                onError={(e) => {
                                  console.warn('🖼️ Failed to load monitoring image:', {
                                    hasUrl: !!image.url,
                                    hasData: !!image.data,
                                    hasImageData: !!image.imageData,
                                    timestamp: image.timestamp
                                  });
                                  e.target.style.display = 'none';
                                }}
                              />
                              {image.flagged && <div className={styles.miniFlagged}>🚩</div>}
                            </div>
                          ))}
                          {active.monitoringImages.length > 6 && (
                            <div 
                              className={styles.viewMore} 
                              onClick={() => setViewMode('monitoring')}
                              title="Click to view all monitoring data"
                            >
                              +{active.monitoringImages.length - 6} more
                            </div>
                          )}
                        </div>
                        <button 
                          className={styles.viewAllMonitoring}
                          onClick={() => setViewMode('monitoring')}
                        >
                          View Full Monitoring Data
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : viewMode === 'monitoring' ? (
              <div className={styles.monitoringData}>
                <div className={styles.monitoringSection}>
                  <h4>🔍 Proctoring & Monitoring Data</h4>
                  
                  {/* Violations Section */}
                  <div className={styles.violationsSection}>
                    <h5>⚠️ Violations ({active.violations ? active.violations.length : 0})</h5>
                    {active.violations && active.violations.length > 0 ? (
                      <div className={styles.violationsList}>
                        {active.violations.map((violation, index) => (
                          <div key={index} className={styles.violationItem}>
                            <div className={styles.violationHeader}>
                              <span className={styles.violationType}>{violation.type}</span>
                              <span className={styles.violationTime}>
                                {new Date(violation.timestamp).toLocaleString()}
                              </span>
                            </div>
                            <p className={styles.violationDetails}>{violation.details}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className={styles.noData}>No violations recorded</p>
                    )}
                  </div>

                  {/* Monitoring Images Section */}
                  <div className={styles.monitoringImagesSection}>
                    <h5>📸 Monitoring Images ({active.monitoringImages ? active.monitoringImages.length : 0})</h5>
                    {active.monitoringImages && active.monitoringImages.length > 0 ? (
                      <div className={styles.imageGrid}>
                        {active.monitoringImages.map((image, index) => (
                          <div key={index} className={styles.imageItem}>
                            {/* Use iframe for Google Drive images, fallback to img for local images */}
                            {image.iframeUrl || image.driveFileId ? (
                              <iframe 
                                src={image.iframeUrl || `https://drive.google.com/file/d/${image.driveFileId}/preview`}
                                title={`Monitoring ${index + 1}`}
                                className={styles.monitoringIframe}
                                onError={(e) => {
                                  console.warn('🖼️ Failed to load monitoring iframe:', {
                                    iframeUrl: image.iframeUrl,
                                    driveFileId: image.driveFileId,
                                    timestamp: image.timestamp
                                  });
                                }}
                              />
                            ) : (
                              <img 
                                src={image.url || image.data || image.imageData || image.thumbnailUrl} 
                                alt={`Monitoring ${index + 1}`}
                                className={styles.monitoringImage}
                                onError={(e) => {
                                  console.warn('🖼️ Failed to load monitoring image:', {
                                    hasUrl: !!image.url,
                                    hasData: !!image.data,
                                    hasImageData: !!image.imageData,
                                    hasThumbnailUrl: !!image.thumbnailUrl,
                                    timestamp: image.timestamp
                                  });
                                  e.target.style.display = 'none';
                                }}
                              />
                            )}
                            <div className={styles.imageInfo}>
                              <span className={styles.imageTime}>
                                {new Date(image.timestamp).toLocaleString()}
                              </span>
                              {image.flagged && (
                                <span className={styles.flagged}>🚩 Flagged</span>
                              )}
                              {image.suspicious && (
                                <span className={styles.suspicious}>⚠️ Suspicious</span>
                              )}
                              {image.driveFileId && (
                                <span className={styles.driveFile}>☁️ Google Drive</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className={styles.noData}>No monitoring images captured</p>
                    )}
                  </div>

                  {/* Test Session Info */}
                  <div className={styles.sessionInfo}>
                    <h5>📊 Session Information</h5>
                    <div className={styles.infoGrid}>
                      <div className={styles.infoItem}>
                        <label>Start Time:</label>
                        <span>{active.startTime ? new Date(active.startTime).toLocaleString() : 'N/A'}</span>
                      </div>
                      <div className={styles.infoItem}>
                        <label>End Time:</label>
                        <span>{active.endTime ? new Date(active.endTime).toLocaleString() : 'N/A'}</span>
                      </div>
                      <div className={styles.infoItem}>
                        <label>Duration:</label>
                        <span>{active.timeTaken ? `${Math.floor(active.timeTaken / 60)}m ${active.timeTaken % 60}s` : 'N/A'}</span>
                      </div>
                      <div className={styles.infoItem}>
                        <label>Focus Lost Count:</label>
                        <span>{active.focusLostCount || 0}</span>
                      </div>
                      <div className={styles.infoItem}>
                        <label>Camera Monitoring:</label>
                        <span>{active.cameraMonitoring ? '✅ Enabled' : '❌ Disabled'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className={styles.iframeBox}>
                  {getCurrentUrl() ? (
                    <iframe 
                      title={getCurrentTitle()} 
                      src={enhanceEmbedUrl(getCurrentUrl())}
                      sandbox="allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox"
                      scrolling="yes"
                      referrerPolicy="no-referrer-when-downgrade"
                      allow="fullscreen"
                      onError={() => {
                        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                        if (isMobile) {
                          console.warn('Mobile device detected - iframe may be blocked');
                        }
                      }}
                    />
                  ) : (
                    <div className={styles.nosheet}>No {getCurrentTitle()} URL Available</div>
                  )}
                </div>
              </>
            )}
            <div className={styles.gradingBox}>
              <table className={styles.grid}>
                <thead><tr><th>Q #</th><th>Max</th><th>Obtained</th><th>Remarks</th></tr></thead>
                <tbody>
                  {qNums.map((q, i) => (
                    <tr key={q}>
                      <td data-label="Question">{q}</td>
                      <td data-label="Max Marks"><input type="number" value={qMax[i] ?? ''} onChange={e => tweakMax(i, e.target.value)} min="0" className={`${styles.inputField} ${darkMode ? styles.darkContrast : styles.lightContrast}`} /></td>
                      <td data-label="Obtained Marks"><input type="number" value={marks[i] ?? ''} onChange={e => tweak(i, e.target.value)} min="0" max={qMax[i]} className={`${styles.inputField} ${darkMode ? styles.darkContrast : styles.lightContrast}`} /></td>
                      <td data-label="Remarks"><input type="text" value={remarks[i] ?? ''} onChange={e => tweakRemarks(i, e.target.value)} placeholder="Remarks..." className={styles.remarksInput} /></td>
                    </tr>
                  ))}
                  <tr className={styles.total}>
                    <td data-label="Question">Total</td>
                    <td data-label="Max Marks">{totalMax}</td>
                    <td data-label="Obtained Marks">{totalGot}</td>
                    <td data-label="Remarks">-</td>
                  </tr>
                </tbody>
              </table>
              <div className={styles.commentsSection}>
                <label htmlFor='admin-comments'>Overall Admin Comments</label>
                <textarea id='admin-comments' value={adminComments} onChange={e => setAdminComments(e.target.value)} placeholder='Add overall feedback here...' rows='4'></textarea>
              </div>
              <button onClick={save} disabled={!changed || saving} className={styles.saveButton}>
                {saving ? 'Saving…' : 'Save & Approve Marks'}
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
