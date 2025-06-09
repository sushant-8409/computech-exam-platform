import React, { useEffect, useState } from 'react';
import { useAuth } from '../../App';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
const StudentDashboard = () => {
  const { user } = useAuth();
  const [tests, setTests] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
   const [reviews, setReviews] = useState([]);
  const navigate = useNavigate();
  useEffect(() => {
    fetchStudentData();
  }, []);
   useEffect(() => {
    fetchDashboardData();
  }, []);
  const fetchStudentData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch tests
      const testsResponse = await axios.get('/api/student/tests');
      
      // Fetch results (with fallback if endpoint doesn't exist)
      let resultsResponse;
      try {
        resultsResponse = await axios.get('/api/student/results');
      } catch (resultsError) {
        console.log('Results endpoint not available, using empty array');
        resultsResponse = { data: { results: [] } };
      }

      // Handle different response structures safely
      const testsData = testsResponse?.data?.tests || testsResponse?.data || [];
      const resultsData = resultsResponse?.data?.results || resultsResponse?.data || [];
      
      setTests(Array.isArray(testsData) ? testsData : []);
      setResults(Array.isArray(resultsData) ? resultsData : []);
      
    } catch (error) {
      console.error('Error fetching student data:', error);
      setError('Failed to load dashboard data');
      toast.error('Failed to load dashboard data');
      
      // Set empty arrays as fallback
      setTests([]);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };
  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // 1) Fetch your normal test results
      const res1 = await axios.get('/api/student/results');
      if (!res1.data.success) throw new Error(res1.data.message);

      // 2) Fetch any review‐sessions (ReviewResult) you’ve created
      const res2 = await axios.get('/api/student/review-results');
      if (!res2.data.success) throw new Error(res2.data.message);

      setResults(res1.data.results);
      setReviews(res2.data.reviewResults);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };
  // Safely categorize tests with proper null checks
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

  const handleStartTest = (testId) => {
    if (testId) {
      navigate(`/student/test/${testId}`);
    }
  };

  const handleViewResult = (resultId) => {
    if (resultId) {
      window.location.href = `/result/${resultId}`;
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading your dashboard...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="error-container">
        <h2>⚠️ Error Loading Dashboard</h2>
        <p>{error}</p>
        <button className="btn btn-primary" onClick={fetchStudentData}>
          Retry
        </button>
      </div>
    );
  }
  
  
  return (
    <div className="student-dashboard">
      <div className="dashboard-header">
        <h1>Welcome back, {user?.name || 'Student'}! 👋</h1>
        <div className="student-info">
          <p><strong>Class:</strong> {user?.class || 'N/A'} | <strong>Board:</strong> {user?.board || 'N/A'}</p>
          <p><strong>Roll No:</strong> {user?.rollNo || 'Not assigned'}</p>
          <p><strong>School:</strong> {user?.school || 'N/A'}</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stats-card available-card">
          <h3>{available.length}</h3>
          <p>🔴 Available Tests</p>
          <small>Take Now!</small>
        </div>
        <div className="stats-card upcoming-card">
          <h3>{upcoming.length}</h3>
          <p>📅 Upcoming Tests</p>
          <small>Scheduled</small>
        </div>
        <div className="stats-card completed-card">
          <h3>{completed.length}</h3>
          <p>✅ Completed Tests</p>
          <small>Finished</small>
        </div>
        <div className="stats-card results-card">
          <h3>{results.filter(r => r?.marksApproved).length}</h3>
          <p>📊 Results Ready</p>
          <small>View Scores</small>
        </div>
      </div>

      {/* Available Tests Section */}
      {available.length > 0 && (
        <div className="test-section available-section">
          <h2>🔴 Tests Available Now - Take Immediately!</h2>
          <div className="test-grid">
            {available.map(test => (
              <div key={test._id || test.id} className="test-card available">
                <div className="test-header">
                  <h3>{test.title || 'Untitled Test'}</h3>
                  <span className="test-status available">LIVE</span>
                </div>
                <div className="test-details">
                  <p><strong>📚 Subject:</strong> {test.subject || 'N/A'}</p>
                  <p><strong>⏱️ Duration:</strong> {test.duration || 'N/A'} minutes</p>
                  <p><strong>💯 Total Marks:</strong> {test.totalMarks || 'N/A'}</p>
                  <p><strong>🎯 Passing Marks:</strong> {test.passingMarks || 'N/A'}</p>
                  <p><strong>📝 Class:</strong> {test.class || 'N/A'} | <strong>🏫 Board:</strong> {test.board || 'N/A'}</p>
                  <p><strong>⚠️ Ends:</strong> {test.endDate ? new Date(test.endDate).toLocaleString() : 'N/A'}</p>
                </div>
                <button 
                  className="btn btn-primary btn-start-test"
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
        <div className="test-section upcoming-section">
          <h2>📅 Upcoming Tests</h2>
          <div className="test-grid">
            {upcoming.map(test => (
              <div key={test._id || test.id} className="test-card upcoming">
                <div className="test-header">
                  <h3>{test.title || 'Untitled Test'}</h3>
                  <span className="test-status upcoming">UPCOMING</span>
                </div>
                <div className="test-details">
                  <p><strong>📚 Subject:</strong> {test.subject || 'N/A'}</p>
                  <p><strong>⏱️ Duration:</strong> {test.duration || 'N/A'} minutes</p>
                  <p><strong>💯 Total Marks:</strong> {test.totalMarks || 'N/A'}</p>
                  <p><strong>🎯 Passing Marks:</strong> {test.passingMarks || 'N/A'}</p>
                  <p><strong>🚀 Starts:</strong> {test.startDate ? new Date(test.startDate).toLocaleString() : 'N/A'}</p>
                  <p><strong>⚠️ Ends:</strong> {test.endDate ? new Date(test.endDate).toLocaleString() : 'N/A'}</p>
                </div>
                <button className="btn btn-secondary" disabled>
                  ⏳ Starts Soon
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Test Results Section */}
      {results.length > 0 && (
        <div className="results-section">
  <h2>📊 Your Test Results</h2>
  <table className="table">
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
        const pct = r.totalMarks
          ? ((r.marksObtained / r.totalMarks) * 100).toFixed(2)
          : '0.00';
        const isPublished = r.status === 'published';
        const isReviewed  = r.status === 'reviewed';
        return (
          <tr key={r._id}>
            <td>{r.testTitle || r.testId?.title || 'Unknown'}</td>
            <td>
              {r.marksObtained != null
                ? `${r.marksObtained}/${r.totalMarks}`
                : 'Pending'}
            </td>
            <td>{`${pct}%`}</td>
            <td>
              {isPublished
                ? '✅ Final'
                : isReviewed
                ? 'Reviewed'
                : '⏳ Under Review'}
            </td>
            <td>
              {r.submittedAt
                ? new Date(r.submittedAt).toLocaleDateString()
                : 'N/A'}
            </td>
            <td>
              {isPublished && (
                <>
                  <button
                    className="btn btn-sm"
                    onClick={() => navigate(`/student/result/${r._id}`)}
                  >
                    Review Result
                  </button>{' '}
                  <button
                    className="btn btn-sm"
                    onClick={() =>
                      navigate(`/student/result/${r._id}/breakdown`)
                    }
                  >
                    Question Wise
                  </button>
                   <button
                    className="btn btn-sm"
                    onClick={() => navigate(`/student/result/${r._id}`)}
                  >
                    View Details
                  </button>{' '}
                </>
              )}
              {isReviewed && !isPublished && (
                <>
                  <button
                    className="btn btn-sm"
                    onClick={() => navigate(`/student/result/${r._id}`)}
                  >
                    View Details
                  </button>{' '}
                  <button
                    className="btn btn-sm"
                    onClick={() =>
                      navigate(`/student/result/${r._id}/breakdown`)
                    }
                  >
                    Question Wise
                  </button>
                </>
              )}
              {/* no actions for 'pending' or 'under review' */}
            </td>
          </tr>
        );
      })}
    </tbody>
  </table>
</div>

      )}
      {/* Empty State */}
      {tests.length === 0 && (
        <div className="empty-state">
          <div className="empty-content">
            <h2>📚 No Tests Available</h2>
            <p>There are currently no tests available for your class and board.</p>
            <p>Please check back later or contact your administrator if you think this is an error.</p>
            <div className="empty-actions">
              <button className="btn btn-primary" onClick={fetchStudentData}>
                🔄 Refresh Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentDashboard;
