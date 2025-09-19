import React, { useEffect, useState } from 'react';
import { useAuth, useTheme } from '../../App';  // ✅ Import useTheme
import axios from 'axios';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import Header from '../Header';
import PushNotificationSettings from '../PushNotificationSettings';  // ✅ Import Push Notification Settings
import StudentNotifications from './StudentNotifications';  // ✅ Import Student Notifications
import StudentAnalytics from './StudentAnalytics';  // ✅ Import Student Analytics
import styles from './StudentDashboard.module.css';

const StudentDashboard = () => {
  const { user } = useAuth();
  const { darkMode } = useTheme();  // ✅ Get theme state
  const [tests, setTests] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [checkingGoogleStatus, setCheckingGoogleStatus] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);  // ✅ Analytics modal state
  const navigate = useNavigate();

  // ✅ Smooth scroll function
  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start',
        inline: 'nearest'
      });
    }
  };

  useEffect(() => {
    fetchStudentData();
    checkGoogleDriveStatus();
  }, []);

  // ✅ Optimized data loading based on user role and lazy loading
  const fetchStudentData = async (priority = 'high') => {
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      if (priority === 'high') {
        // Load essential data first (recent tests and critical results)
        const [testsResponse, recentResultsResponse] = await Promise.all([
          axios.get('/api/student/tests?limit=10&sort=recent', { headers }),
          axios.get('/api/student/results?limit=5&sort=recent', { headers })
        ]);

        const testsData = testsResponse?.data?.tests || [];
        const recentResultsData = recentResultsResponse?.data?.results || [];
        
        setTests(Array.isArray(testsData) ? testsData : []);
        setResults(Array.isArray(recentResultsData) ? recentResultsData : []);

        // Load remaining data in background after initial render
        setTimeout(() => {
          fetchAdditionalData(headers);
        }, 1000);
      } else {
        // Load all data for comprehensive view
        const [testsResponse, resultsResponse] = await Promise.all([
          axios.get('/api/student/tests', { headers }),
          axios.get('/api/student/results', { headers })
        ]);

        const testsData = testsResponse?.data?.tests || [];
        const resultsData = resultsResponse?.data?.results || [];
        
        setTests(Array.isArray(testsData) ? testsData : []);
        setResults(Array.isArray(resultsData) ? resultsData : []);
      }
      
    } catch (error) {
      console.error('Error fetching student data:', error);
      setError('Failed to load dashboard data');
      toast.error('Failed to load dashboard data');
      setTests([]);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Load additional data in background
  const fetchAdditionalData = async (headers) => {
    try {
      // Load complete results history if not already loaded
      if (results.length <= 5) {
        const allResultsResponse = await axios.get('/api/student/results', { headers });
        const allResultsData = allResultsResponse?.data?.results || [];
        if (allResultsData.length > results.length) {
          setResults(Array.isArray(allResultsData) ? allResultsData : []);
        }
      }
    } catch (error) {
      console.error('Error fetching additional data:', error);
    }
  };

  const checkGoogleDriveStatus = async () => {
    console.log('🔍 Checking Admin Google Drive status...');
    setCheckingGoogleStatus(true);
    try {
      // Check for admin Google Drive tokens in database
      const response = await axios.get('/auth/google/admin-status');
      
      const isConnected = response.data.connected && response.data.driveAccess;
      setGoogleConnected(isConnected);
      
      console.log('📊 Admin Google Drive Status:', {
        connected: response.data.connected,
        driveAccess: response.data.driveAccess,
        userEmail: response.data.userInfo?.emailAddress,
        finalStatus: isConnected
      });
      
      if (isConnected) {
        console.log('✅ Google Drive Connected:', response.data.userInfo?.emailAddress);
      } else {
        console.log('❌ Google Drive Not Connected:', response.data.error);
      }
    } catch (error) {
      console.error('❌ Error checking Google Drive status:', error.message);
      setGoogleConnected(false);
    } finally {
      setCheckingGoogleStatus(false);
    }
  };

  const connectGoogleDrive = () => {
  console.log('🔗 Opening Google OAuth popup...');
  
  const token = localStorage.getItem('token');
  if (!token) {
    toast.error('❌ Not authenticated. Please login again.');
    return;
  }
  
  // Prefer configured API URL, fall back to localhost for development
  const DEFAULT_LOCAL_API = 'http://localhost:5000';
  const DEFAULT_PROD_API = 'https://auctutor.app';
  const backendUrl = process.env.REACT_APP_API_URL || (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? DEFAULT_PROD_API : DEFAULT_LOCAL_API);
  const oauthUrl = `${backendUrl}/auth/google?token=${encodeURIComponent(token)}`;
  
  console.log('🔗 Opening OAuth URL:', oauthUrl);
  
  const oauthWindow = window.open(
    oauthUrl, 
    'googleOAuth', 
    'width=500,height=600,scrollbars=yes,resizable=yes,left=' + 
    ((window.screen.width / 2) - 250) + ',top=' + 
    ((window.screen.height / 2) - 300)
  );
  
  if (!oauthWindow) {
    toast.error('❌ Popup blocked! Please allow popups for this site.');
    return;
  }
  
  // Listen for OAuth completion message
  const handleOAuthMessage = (event) => {
    console.log('📨 Received message:', event.data);
    
    if (event.data && event.data.type === 'OAUTH_SUCCESS') {
      console.log('✅ OAuth success message received');
      window.removeEventListener('message', handleOAuthMessage);
      
      if (!oauthWindow.closed) {
        oauthWindow.close();
      }
      
      // Re-check Google Drive status
      setTimeout(async () => {
        await checkGoogleDriveStatus();
        toast.success('✅ Google Drive connected successfully!');
      }, 1000);
      
    } else if (event.data && event.data.type === 'OAUTH_ERROR') {
      console.error('❌ OAuth error:', event.data.error);
      window.removeEventListener('message', handleOAuthMessage);
      
      if (!oauthWindow.closed) {
        oauthWindow.close();
      }
      
      toast.error(`❌ Google Drive connection failed: ${event.data.error}`);
    }
  };
  
  window.addEventListener('message', handleOAuthMessage);
  
  // Timeout handling
  setTimeout(() => {
    if (!oauthWindow.closed) {
      console.log('⏰ OAuth timeout');
      window.removeEventListener('message', handleOAuthMessage);
      oauthWindow.close();
      toast.error('❌ OAuth timeout. Please try again.');
    }
  }, 5 * 60 * 1000);
};


  const categorizeTests = () => {
    if (!Array.isArray(tests) || tests.length === 0) {
      return { upcoming: [], completed: [], available: [] };
    }

    const now = new Date();
    
    const upcoming = tests.filter(test => {
      if (!test?.startDate || !test?.endDate) return false;
      const startDate = new Date(test.startDate);
      return now < startDate;
    });

    const available = tests.filter(test => {
      if (!test?.startDate || !test?.endDate) return false;
      const startDate = new Date(test.startDate);
      const endDate = new Date(test.endDate);
      return now >= startDate && now <= endDate;
    });

    const completed = tests.filter(test => {
      if (!test?.endDate) return false;
      const endDate = new Date(test.endDate);
      return now > endDate;
    });

    return { upcoming, completed, available };
  };

  const { upcoming = [], completed = [], available = [] } = categorizeTests();

  const getAnalytics = () => {
    const completedTests = results.filter(r => 
      r?.status && ['pending', 'published', 'reviewed'].includes(r.status)
    ).length;
    
    const resultsReady = results.filter(r => 
      ['published' , 'reviewed'].includes(r?.status) && 
      (r?.marksObtained !== undefined || r?.codingResults)
    ).length;

    // Separate analytics for traditional and coding tests
    const traditionalTests = results.filter(r => r.testId?.type !== 'coding');
    const codingTests = results.filter(r => r.testId?.type === 'coding');
    
    const avgTraditionalScore = traditionalTests.length > 0 ? 
      traditionalTests
        .filter(r => r.marksObtained !== undefined && r.totalMarks > 0)
        .reduce((sum, r) => sum + (r.marksObtained / r.totalMarks * 100), 0) / traditionalTests.length : 0;
    
    const avgCodingScore = codingTests.length > 0 ?
      codingTests
        .filter(r => r.codingResults && r.codingResults.totalTestCases > 0)
        .reduce((sum, r) => sum + (r.codingResults.passedTestCases / r.codingResults.totalTestCases * 100), 0) / codingTests.length : 0;

    return { 
      completedTests, 
      resultsReady, 
      traditionalTests: traditionalTests.length,
      codingTests: codingTests.length,
      avgTraditionalScore: avgTraditionalScore.toFixed(1),
      avgCodingScore: avgCodingScore.toFixed(1)
    };
  };

  const { 
    completedTests, 
    resultsReady, 
    traditionalTests,
    codingTests,
    avgTraditionalScore,
    avgCodingScore
  } = getAnalytics();

  // Safe date formatter used across the dashboard
  const formatDate = (value) => {
    if (!value) return ' - ';
    const d = new Date(value);
    if (isNaN(d.getTime())) return ' - ';
    try {
      return d.toLocaleString('en-IN');
    } catch (e) {
      return d.toString();
    }
  };

  const handleStartTest = (testId, isResume = false, testType = 'traditional') => {
    if (testId) {
      // Route to appropriate interface based on test type
      if (testType === 'coding') {
        // For coding tests, route to coding interface
        if (isResume) {
          navigate(`/student/coding-test/${testId}?resume=true`);
        } else {
          navigate(`/student/coding-test/${testId}`);
        }
      } else {
        // For traditional tests, route to regular test interface
        if (isResume) {
          navigate(`/student/test/${testId}?resume=true`);
        } else {
          navigate(`/student/test/${testId}`);
        }
      }
    }
  };

  if (loading) {
    return (
      <div className={`${styles.dashboardContainer} ${darkMode ? styles.dark : styles.light}`}>
        <Header />
        <div className={styles.loadingContainer}>
          <div className={styles.spinner}></div>
          <p>Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${styles.dashboardContainer} ${darkMode ? styles.dark : styles.light}`}>
        <Header />
        <div className={styles.errorContainer}>
          <h2>⚠️ Error Loading Dashboard</h2>
          <p>{error}</p>
          <button className={styles.retryBtn} onClick={fetchStudentData}>
            Retry
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className={`${styles.dashboardContainer} ${darkMode ? styles.dark : styles.light}`}>
      {/* ✅ Header */}
      
      <div className={styles.studentDashboard}>
        <div className={styles.dashboardHeader}>
          <div className={styles.headerContent}>
            <div className={styles.welcomeSection}>
              <h1>Welcome back, {user?.name || 'Student'}! 👋</h1>
              <div className={styles.studentInfo}>
                <p><strong>Class:</strong> {user?.class || 'N/A'} | <strong>Board:</strong> {user?.board || 'N/A'}</p>
                <p><strong>Roll No:</strong> {user?.rollNo || 'Not assigned'}</p>
                <p><strong>School:</strong> {user?.school || 'N/A'}</p>
              </div>
            </div>
            <div className={styles.headerActions}>
              <button 
                className={styles.analyticsHeaderBtn}
                onClick={() => setShowAnalytics(true)}
                title="View Performance Analytics"
              >
                📊 Analytics
              </button>
              <button 
                className={styles.codingPracticeBtn}
                onClick={() => navigate('/student/coding-practice')}
                title="Practice coding problems"
              >
                💻 Coding Practice
              </button>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className={styles.statsGrid}>
          <div 
            className={`${styles.statsCard} ${styles.availableCard} ${available.length > 0 ? styles.clickable : ''}`}
            onClick={() => available.length > 0 && scrollToSection('availableTestsSection')}
            title={available.length > 0 ? 'Click to scroll to available tests' : 'No available tests'}
          >
            <h3>{available.length}</h3>
            <p>🔴 Available Tests</p>
            <small>{available.length > 0 ? 'Take Now!' : 'None Available'}</small>
          </div>
          <div className={`${styles.statsCard} ${styles.upcomingCard}`}>
            <h3>{upcoming.length}</h3>
            <p>📅 Upcoming Tests</p>
            <small>Scheduled</small>
          </div>
          <div 
            className={`${styles.statsCard} ${styles.completedCard} ${results.length > 0 ? styles.clickable : ''}`}
            onClick={() => results.length > 0 && scrollToSection('resultsSection')}
            title={results.length > 0 ? 'Click to scroll to your results' : 'No completed tests'}
          >
            <h3>{completedTests}</h3>
            <p>✅ Completed Tests</p>
            <small>Finished</small>
          </div>
          <div 
            className={`${styles.statsCard} ${styles.resultsCard} ${results.length > 0 ? styles.clickable : ''}`}
            onClick={() => results.length > 0 && scrollToSection('resultsSection')}
            title={results.length > 0 ? 'Click to scroll to your results' : 'No results ready'}
          >
            <h3>{resultsReady}</h3>
            <p>📊 Results Ready</p>
            <small>View Scores</small>
          </div>
        </div>

        {/* ✅ Enhanced Analytics Quick Access */}
        <div className={styles.analyticsSection}>
          {/* Test Type Summary */}
          {(traditionalTests > 0 || codingTests > 0) && (
            <div className={styles.testTypeSummary}>
              <div className={styles.testTypeCard}>
                <div className={styles.testTypeIcon}>📄</div>
                <div className={styles.testTypeInfo}>
                  <h4>Traditional Tests</h4>
                  <span className={styles.testTypeCount}>{traditionalTests}</span>
                  <p>Avg: {avgTraditionalScore}%</p>
                </div>
              </div>
              <div className={styles.testTypeCard}>
                <div className={styles.testTypeIcon}>💻</div>
                <div className={styles.testTypeInfo}>
                  <h4>Coding Tests</h4>
                  <span className={styles.testTypeCount}>{codingTests}</span>
                  <p>Avg: {avgCodingScore}%</p>
                </div>
              </div>
            </div>
          )}
          
          <div className={styles.analyticsCard}>
            <div className={styles.analyticsContent}>
              <div className={styles.analyticsIcon}>📊</div>
              <div className={styles.analyticsInfo}>
                <h3>Performance Analytics</h3>
                <p>View detailed insights about your academic performance, trends, and progress over time</p>
                <div className={styles.analyticsStats}>
                  <span>📈 Trends</span>
                  <span>📚 Subject Analysis</span>
                  <span>🏆 Grade Distribution</span>
                  <span>💻 Code Performance</span>
                  <span>📄 PDF Reports</span>
                </div>
              </div>
            </div>
            <button 
              className={styles.analyticsBtn}
              onClick={() => setShowAnalytics(true)}
              title="View detailed performance analytics and insights"
            >
              � View Analytics
            </button>
          </div>
        </div>

        {/* ✅ Quick Access Portals */}
        <div className={styles.portalsSection}>
          <h3>🌐 Quick Access Portals</h3>
          <div className={styles.portalsGrid}>
            <div className={styles.portalCard}>
              <div className={styles.portalIcon}>🤖</div>
              <div className={styles.portalContent}>
                <h4>AucTutor Chatbot</h4>
                <p>Get instant help and answers to your questions</p>
                <button 
                  className={styles.portalButton}
                  onClick={() => window.open('https://computechai.netlify.app/', '_blank')}
                >
                  Open Chatbot Portal
                </button>
              </div>
            </div>
            <div className={styles.portalCard}>
              <div className={styles.portalIcon}>💳</div>
              <div className={styles.portalContent}>
                <h4>Fees Payment Portal</h4>
                <p>Pay your fees securely and track payment history</p>
                <button 
                  className={styles.portalButton}
                  onClick={() => window.open('https://auctutor.app/', '_blank')}
                >
                  Open Payment Portal
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ✅ Student Notifications */}
        <StudentNotifications />

        {/* Google Drive Connection Status */}
        <div className={`${styles.googleDriveSection} ${googleConnected ? styles.connected : styles.disconnected}`}>
          <div className={styles.googleDriveHeader}>
            <div className={styles.googleDriveInfo}>
              <h3>
                {googleConnected ? (
                  <>
                    <span className={styles.statusIcon}>✅</span>
                    Google Drive Connected
                  </>
                ) : (
                  <>
                    <span className={styles.statusIcon}>⚠️</span>
                    Google Drive Not Connected
                  </>
                )}
              </h3>
              <p>
                {googleConnected ? (
                  "Your answer sheets will be uploaded to your Google Drive"
                ) : (
                  "Connect Google Drive to upload your answer sheets seamlessly"
                )}
              </p>
            </div>
            {!googleConnected && (
              <button 
                className={styles.connectGoogleBtn}
                onClick={connectGoogleDrive}
                disabled={checkingGoogleStatus}
              >
                {checkingGoogleStatus ? (
                  <>
                    <span className={styles.btnSpinner}></span>
                    Checking...
                  </>
                ) : (
                  <>
                    <span className={styles.googleIcon}>📁</span>
                    Connect Google Drive
                  </>
                )}
              </button>
            )}
          </div>
          {googleConnected && (
            <div className={styles.googleDriveDetails}>
              <small>✨ Answer sheet uploads are now automatic and secure!</small>
            </div>
          )}
        </div>

        {/* Available Tests Section */}
        {available.length > 0 && (
          <div id="availableTestsSection" className={`${styles.testSection} ${styles.availableSection}`}>
            <h2>🔴 Tests Available Now - Take Immediately!</h2>
            <div className={styles.testGrid}>
              {available.map(test => (
                <div key={test._id || test.id} className={`${styles.testCard} ${styles.available}`}>
                  <div className={styles.testHeader}>
                    <h3>{test.title || 'Untitled Test'}</h3>
                    <span className={`${styles.testStatus} ${styles.availableStatus}`}>
                      {test.canResume ? 'RESUME' : 'LIVE'}
                    </span>
                  </div>
                  <div className={styles.testDetails}>
                    <p><strong>� Type:</strong> 
                      <span className={`${styles.testTypeBadge} ${styles[test.type || 'traditional']}`}>
                        {test.type === 'coding' ? '💻 Coding Test' : '📄 Traditional Test'}
                      </span>
                    </p>
                    <p><strong>�📚 Subject:</strong> {test.subject || 'N/A'}</p>
                    <p><strong>⏱️ Duration:</strong> {test.duration || 'N/A'} minutes</p>
                    <p><strong>💯 Total Marks:</strong> {test.totalMarks || 'N/A'}</p>
                    <p><strong>🎯 Passing Marks:</strong> {test.passingMarks || 'N/A'}</p>
                    <p><strong>📝 Class:</strong> {test.class || 'N/A'} | <strong>🏫 Board:</strong> {test.board || 'N/A'}</p>
                    {test.type === 'coding' && (
                      <p><strong>🔧 Language:</strong> 
                        <span className={styles.languageBadge}>
                          {test.board === 'CBSE' ? 'Python' : 
                           test.board === 'ICSE' || test.board === 'ISC' ? 'Java' : 'C'}
                        </span>
                      </p>
                    )}
                    <p><strong>⚠️ Ends:</strong> {test.endDate ? new Date(test.endDate).toLocaleString() : 'N/A'}</p>
                    {test.canResume && (
                      <p className={styles.resumeMessage}>
                        <strong>🔄 Resume Available:</strong> Continue from where you left off
                      </p>
                    )}
                  </div>
                  <button 
                    className={`${test.canResume ? styles.btnResumeTest : styles.btnStartTest} ${test.type === 'coding' ? styles.codingTestBtn : ''}`}
                    onClick={() => handleStartTest(test._id || test.id, test.canResume, test.type)}
                  >
                    {test.canResume ? '🔄 Resume Test' : 
                     test.type === 'coding' ? '💻 Start Coding Challenge' : '🚀 Start Test Now'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming Tests Section */}
        {upcoming.length > 0 && (
          <div className={`${styles.testSection} ${styles.upcomingSection}`}>
            <h2>📅 Upcoming Tests</h2>
            <div className={styles.testGrid}>
              {upcoming.map(test => (
                <div key={test._id || test.id} className={`${styles.testCard} ${styles.upcoming}`}>
                  <div className={styles.testHeader}>
                    <h3>{test.title || 'Untitled Test'}</h3>
                    <span className={`${styles.testStatus} ${styles.upcomingStatus}`}>UPCOMING</span>
                  </div>
                  <div className={styles.testDetails}>
                    <p><strong>� Type:</strong> 
                      <span className={`${styles.testTypeBadge} ${styles[test.type || 'traditional']}`}>
                        {test.type === 'coding' ? '💻 Coding Test' : '📄 Traditional Test'}
                      </span>
                    </p>
                    <p><strong>�📚 Subject:</strong> {test.subject || 'N/A'}</p>
                    <p><strong>⏱️ Duration:</strong> {test.duration || 'N/A'} minutes</p>
                    <p><strong>💯 Total Marks:</strong> {test.totalMarks || 'N/A'}</p>
                    <p><strong>🎯 Passing Marks:</strong> {test.passingMarks || 'N/A'}</p>
                    {test.type === 'coding' && (
                      <p><strong>🔧 Language:</strong> 
                        <span className={styles.languageBadge}>
                          {test.board === 'CBSE' ? 'Python' : 
                           test.board === 'ICSE' || test.board === 'ISC' ? 'Java' : 'C'}
                        </span>
                      </p>
                    )}
                    <p><strong>🚀 Starts:</strong> {test.startDate ? new Date(test.startDate).toLocaleString() : 'N/A'}</p>
                    <p><strong>⚠️ Ends:</strong> {test.endDate ? new Date(test.endDate).toLocaleString() : 'N/A'}</p>
                  </div>
                  <button className={styles.btnUpcoming} disabled>
                    ⏳ Starts Soon
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Test Results Section */}
        {results.length > 0 && (
          <div id="resultsSection" className={styles.resultsSection}>
            <h2>📊 Your Test Results</h2>
            <div className={styles.tableContainer}>
              <table className={styles.resultsTable}>
                <thead>
                  <tr>
                    <th>Test Name</th>
                    <th>Type</th>
                    <th>Score</th>
                    <th>Percentage</th>
                    <th>Status</th>
                    <th>Date Taken</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map(r => {
                    const pct = r.totalMarks && r.totalMarks > 0
                      ? ((r.marksObtained / r.totalMarks) * 100).toFixed(2)
                      : '0.00';
                    const isPublished = r.status === 'published';
                    const isReviewed = r.status === 'reviewed';
                    const isCompleted = r.status === 'completed';
                    const isDone = r.status === 'done';
                    // Status-based test type classification:
                    // - pending, underreview, reviewed → Traditional test
                    // - done, completed → Coding test
                    const isCodingTest = ['done', 'completed'].includes(r.status);
                    const isTraditionalTest = ['pending', 'underreview', 'reviewed'].includes(r.status);
                    
                    return (
                      <tr key={r._id}>
                        <td>{r.testTitle || r.testId?.title || 'Unknown'}</td>
                        <td>
                          <span className={`${styles.testTypeBadge} ${isCodingTest ? styles.coding : styles.traditional}`}>
                            {isCodingTest ? '💻 Coding' : '📄 Traditional'}
                          </span>
                        </td>
                        <td>
                          {isCodingTest ? (
                            // For coding tests, show test cases passed
                            r.codingResults ? 
                              `${r.codingResults.passedTestCases || 0}/${r.codingResults.totalTestCases || 0} Tests` :
                              'Pending'
                          ) : (
                            // For traditional tests, show marks
                            r.marksObtained !== undefined && r.totalMarks > 0
                              ? `${r.marksObtained}/${r.totalMarks}`
                              : 'Pending'
                          )}
                        </td>
                        <td>
                          {isCodingTest ? (
                            // For coding tests, show percentage based on test cases
                            r.codingResults && r.codingResults.totalTestCases > 0 ?
                              `${((r.codingResults.passedTestCases / r.codingResults.totalTestCases) * 100).toFixed(2)}%` :
                              'Pending'
                          ) : (
                            // For traditional tests, show marks percentage
                            r.marksObtained !== undefined && r.totalMarks > 0
                              ? `${pct}%`
                              : 'Pending'
                          )}
                        </td>
                        <td>
                          <span className={`${styles.statusBadge} ${
                            isPublished ? styles.statusFinal :
                            isCompleted ? styles.statusCompleted :
                            isReviewed ? styles.statusReviewed :
                            isDone ? styles.statusDone :
                            styles.statusPending
                          }`}>
                            {isPublished ? '✅ Final' :
                             isCompleted ? '✅ Completed' :
                             isReviewed ? 'Reviewed' :
                             isDone ? '📝 Under Review' :
                             '⏳ Pending'}
                          </span>
                        </td>
                        <td>
                          {formatDate(r.submittedAt || r.createdAt || r.updatedAt)}
                        </td>
                        <td>
                          <div className={styles.actionButtons}>
                            {(isPublished || isReviewed || isCompleted) && (
                              <>
                                <button
                                  className={styles.btnAction}
                                  onClick={() => navigate(`/student/result/${r._id}`)}
                                >
                                  View Details
                                </button>
                                {isCodingTest && !r.hideViewCodingResults && r.showViewCodingResults && (
                                  <button
                                    className={`${styles.btnAction} ${styles.codingResultBtn}`}
                                    onClick={() => navigate(`/student/result/${r._id}/code-review`)}
                                  >
                                    View Code Results
                                  </button>
                                )}
                                {!isCodingTest && (isCompleted || isReviewed || isPublished) && (
                                  <button
                                    className={styles.btnAction}
                                    onClick={() => navigate(`/student/result/${r._id}/breakdown`)}
                                  >
                                    Question Wise
                                  </button>
                                )}
                              </>
                            )}
                            {isDone && isCodingTest && (
                              <span className={styles.reviewPendingNote}>
                                📝 Awaiting Review
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty State */}
        {tests.length === 0 && (
          <div className={styles.emptyState}>
            <div className={styles.emptyContent}>
              <h2>📚 No Tests Available</h2>
              <p>There are currently no tests available for your class and board.</p>
              <p>Please check back later or contact your administrator.</p>
              <div className={styles.emptyActions}>
                <button className={styles.refreshBtn} onClick={fetchStudentData}>
                  🔄 Refresh Dashboard
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className={styles.dashboardSection}>
        <PushNotificationSettings />
      </div>

      {/* ✅ Analytics Modal */}
      <StudentAnalytics 
        results={results}
        tests={tests}
        isVisible={showAnalytics}
        onClose={() => setShowAnalytics(false)}
      />
    </div>
  );
};

export default StudentDashboard;
