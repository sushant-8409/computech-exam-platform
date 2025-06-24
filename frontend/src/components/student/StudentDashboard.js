import React, { useEffect, useState } from 'react';
import { useAuth, useTheme } from '../../App';  // ✅ Import useTheme
import axios from 'axios';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import Header from '../Header';
import styles from './StudentDashboard.module.css';

const StudentDashboard = () => {
  const { user } = useAuth();
  const { darkMode } = useTheme();  // ✅ Get theme state
  const [tests, setTests] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchStudentData();
  }, []);

  const fetchStudentData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const testsResponse = await axios.get('/api/student/tests', { headers });
      const resultsResponse = await axios.get('/api/student/results', { headers });

      const testsData = testsResponse?.data?.tests || [];
      const resultsData = resultsResponse?.data?.results || [];
      
      setTests(Array.isArray(testsData) ? testsData : []);
      setResults(Array.isArray(resultsData) ? resultsData : []);
      
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
      ['published' , 'reviewed'].includes(r?.status) && r?.marksObtained !== undefined
    ).length;

    return { completedTests, resultsReady };
  };

  const { completedTests, resultsReady } = getAnalytics();

  const handleStartTest = (testId) => {
    if (testId) {
      navigate(`/student/test/${testId}`);
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
          <h1>Welcome back, {user?.name || 'Student'}! 👋</h1>
          <div className={styles.studentInfo}>
            <p><strong>Class:</strong> {user?.class || 'N/A'} | <strong>Board:</strong> {user?.board || 'N/A'}</p>
            <p><strong>Roll No:</strong> {user?.rollNo || 'Not assigned'}</p>
            <p><strong>School:</strong> {user?.school || 'N/A'}</p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className={styles.statsGrid}>
          <div className={`${styles.statsCard} ${styles.availableCard}`}>
            <h3>{available.length}</h3>
            <p>🔴 Available Tests</p>
            <small>Take Now!</small>
          </div>
          <div className={`${styles.statsCard} ${styles.upcomingCard}`}>
            <h3>{upcoming.length}</h3>
            <p>📅 Upcoming Tests</p>
            <small>Scheduled</small>
          </div>
          <div className={`${styles.statsCard} ${styles.completedCard}`}>
            <h3>{completedTests}</h3>
            <p>✅ Completed Tests</p>
            <small>Finished</small>
          </div>
          <div className={`${styles.statsCard} ${styles.resultsCard}`}>
            <h3>{resultsReady}</h3>
            <p>📊 Results Ready</p>
            <small>View Scores</small>
          </div>
        </div>

        {/* Available Tests Section */}
        {available.length > 0 && (
          <div className={`${styles.testSection} ${styles.availableSection}`}>
            <h2>🔴 Tests Available Now - Take Immediately!</h2>
            <div className={styles.testGrid}>
              {available.map(test => (
                <div key={test._id || test.id} className={`${styles.testCard} ${styles.available}`}>
                  <div className={styles.testHeader}>
                    <h3>{test.title || 'Untitled Test'}</h3>
                    <span className={`${styles.testStatus} ${styles.availableStatus}`}>LIVE</span>
                  </div>
                  <div className={styles.testDetails}>
                    <p><strong>📚 Subject:</strong> {test.subject || 'N/A'}</p>
                    <p><strong>⏱️ Duration:</strong> {test.duration || 'N/A'} minutes</p>
                    <p><strong>💯 Total Marks:</strong> {test.totalMarks || 'N/A'}</p>
                    <p><strong>🎯 Passing Marks:</strong> {test.passingMarks || 'N/A'}</p>
                    <p><strong>📝 Class:</strong> {test.class || 'N/A'} | <strong>🏫 Board:</strong> {test.board || 'N/A'}</p>
                    <p><strong>⚠️ Ends:</strong> {test.endDate ? new Date(test.endDate).toLocaleString() : 'N/A'}</p>
                  </div>
                  <button 
                    className={styles.btnStartTest}
                    onClick={() => handleStartTest(test._id || test.id)}
                  >
                    🚀 Start Test Now
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
                    <p><strong>📚 Subject:</strong> {test.subject || 'N/A'}</p>
                    <p><strong>⏱️ Duration:</strong> {test.duration || 'N/A'} minutes</p>
                    <p><strong>💯 Total Marks:</strong> {test.totalMarks || 'N/A'}</p>
                    <p><strong>🎯 Passing Marks:</strong> {test.passingMarks || 'N/A'}</p>
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
          <div className={styles.resultsSection}>
            <h2>📊 Your Test Results</h2>
            <div className={styles.tableContainer}>
              <table className={styles.resultsTable}>
                <thead>
                  <tr>
                    <th>Test Name</th>
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
                    
                    return (
                      <tr key={r._id}>
                        <td>{r.testTitle || r.testId?.title || 'Unknown'}</td>
                        <td>
                          {r.marksObtained !== undefined && r.totalMarks > 0
                            ? `${r.marksObtained}/${r.totalMarks}`
                            : 'Pending'}
                        </td>
                        <td>
                          {r.marksObtained !== undefined && r.totalMarks > 0
                            ? `${pct}%`
                            : 'Pending'}
                        </td>
                        <td>
                          <span className={`${styles.statusBadge} ${
                            isPublished ? styles.statusFinal :
                            isReviewed ? styles.statusReviewed :
                            styles.statusPending
                          }`}>
                            {isPublished ? '✅ Final' :
                             isReviewed ? 'Reviewed' :
                             '⏳ Under Review'}
                          </span>
                        </td>
                        <td>
                          {r.submittedAt
                            ? new Date(r.submittedAt).toLocaleDateString()
                            : 'N/A'}
                        </td>
                        <td>
                          <div className={styles.actionButtons}>
                            {(isPublished || isReviewed) && (
                              <>
                                <button
                                  className={styles.btnAction}
                                  onClick={() => navigate(`/student/result/${r._id}`)}
                                >
                                  View Details
                                </button>
                                <button
                                  className={styles.btnAction}
                                  onClick={() => navigate(`/student/result/${r._id}/breakdown`)}
                                >
                                  Question Wise
                                </button>
                              </>
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
    </div>
  );
};

export default StudentDashboard;
