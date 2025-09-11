import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../App';
import './CodingAdminPanel.css';

const CodingAdminPanel = () => {
  const { darkMode } = useTheme();
  const navigate = useNavigate();
  
  const [codingTests, setCodingTests] = useState([]);
  const [filteredTests, setFilteredTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedTest, setSelectedTest] = useState(null);
  const [showMarkModal, setShowMarkModal] = useState(false);
  const [modifiedMarks, setModifiedMarks] = useState({});
  const [adminNotes, setAdminNotes] = useState('');
  const [cheatingFlags, setCheatingFlags] = useState({});

  useEffect(() => {
    fetchCodingTests();
  }, []);

  useEffect(() => {
    filterTests();
  }, [codingTests, searchTerm, statusFilter]);

  const fetchCodingTests = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No auth token found');
      
      const response = await axios.get('/api/admin/coding-tests-comprehensive', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setCodingTests(response.data.tests);
      } else {
        toast.error('Failed to fetch coding tests');
      }
    } catch (error) {
      console.error('Error fetching coding tests:', error);
      toast.error('Failed to load coding tests');
      if (error.response?.status === 401) {
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const filterTests = () => {
    let filtered = codingTests.filter(test => {
      const matchesSearch = 
        test.studentId?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        test.studentId?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        test.testTitle?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || 
        (statusFilter === 'flagged' && test.isFlagged) ||
        (statusFilter === 'reviewed' && test.adminReviewed) ||
        (statusFilter === 'pending' && !test.adminReviewed);
      
      return matchesSearch && matchesStatus;
    });
    
    setFilteredTests(filtered);
  };

  const handleModifyMarks = (test) => {
    setSelectedTest(test);
    setModifiedMarks({
      totalScore: test.totalScore || 0,
      codeQuality: test.codeQuality || 0,
      efficiency: test.efficiency || 0,
      testCases: test.testCases || 0
    });
    setAdminNotes(test.adminNotes || '');
    setCheatingFlags({
      timeViolation: test.flags?.timeViolation || false,
      codePatterns: test.flags?.codePatterns || false,
      behaviorAnomaly: test.flags?.behaviorAnomaly || false
    });
    setShowMarkModal(true);
  };

  const saveMarkModifications = async () => {
    try {
      const token = localStorage.getItem('token');
      const updateData = {
        resultId: selectedTest._id,
        modifiedMarks,
        adminNotes,
        cheatingFlags,
        adminReviewed: true,
        modifiedBy: 'admin',
        modificationTimestamp: new Date().toISOString()
      };

      const response = await axios.put('/api/admin/modify-coding-marks', updateData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        toast.success('Marks updated successfully');
        setShowMarkModal(false);
        fetchCodingTests(); // Refresh the list
      } else {
        toast.error('Failed to update marks');
      }
    } catch (error) {
      console.error('Error updating marks:', error);
      toast.error('Failed to save changes');
    }
  };

  const flagForCheating = async (testId, reason) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/admin/flag-cheating', {
        resultId: testId,
        reason,
        flaggedBy: 'admin',
        timestamp: new Date().toISOString()
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        toast.success('Test flagged for review');
        fetchCodingTests();
      } else {
        toast.error('Failed to flag test');
      }
    } catch (error) {
      console.error('Error flagging test:', error);
      toast.error('Failed to flag test');
    }
  };

  const viewMonitoringData = (test) => {
    navigate(`/admin/monitoring-details/${test._id}`);
  };

  if (loading) {
    return (
      <div className={`coding-admin-panel ${darkMode ? 'dark' : ''}`}>
        <div className="loading-spinner">Loading coding tests...</div>
      </div>
    );
  }

  return (
    <div className={`coding-admin-panel ${darkMode ? 'dark' : ''}`}>
      <div className="panel-header">
        <h2>🔧 Coding Tests - Admin Panel</h2>
        <p>Comprehensive review and management of all coding test submissions</p>
      </div>

      <div className="filters-section">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search by student name, email, or test title..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        <div className="status-filters">
          <button 
            className={`filter-btn ${statusFilter === 'all' ? 'active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            All Tests ({codingTests.length})
          </button>
          <button 
            className={`filter-btn ${statusFilter === 'pending' ? 'active' : ''}`}
            onClick={() => setStatusFilter('pending')}
          >
            🔍 Pending Review ({codingTests.filter(t => !t.adminReviewed).length})
          </button>
          <button 
            className={`filter-btn ${statusFilter === 'flagged' ? 'active' : ''}`}
            onClick={() => setStatusFilter('flagged')}
          >
            🚩 Flagged ({codingTests.filter(t => t.isFlagged).length})
          </button>
          <button 
            className={`filter-btn ${statusFilter === 'reviewed' ? 'active' : ''}`}
            onClick={() => setStatusFilter('reviewed')}
          >
            ✅ Reviewed ({codingTests.filter(t => t.adminReviewed).length})
          </button>
        </div>
      </div>

      <div className="tests-table-container">
        <table className="coding-tests-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Test Title</th>
              <th>Submission Date</th>
              <th>Current Score</th>
              <th>Time Taken</th>
              <th>Status</th>
              <th>Monitoring</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTests.map(test => (
              <tr key={test._id} className={test.isFlagged ? 'flagged-row' : ''}>
                <td>
                  <div className="student-info">
                    <strong>{test.studentId?.name || 'Unknown'}</strong>
                    <div className="student-email">{test.studentId?.email}</div>
                  </div>
                </td>
                <td>
                  <div className="test-title">
                    💻 {test.testTitle}
                    {test.submissionType === 'multi_question_coding' && (
                      <span className="submission-type">Multi-Question</span>
                    )}
                  </div>
                </td>
                <td>{new Date(test.submittedAt).toLocaleString()}</td>
                <td>
                  <div className="score-info">
                    <strong>{test.totalScore || 0}</strong>
                    {test.maxScore && ` / ${test.maxScore}`}
                    {test.adminModified && <span className="modified-badge">Modified</span>}
                  </div>
                </td>
                <td>
                  <div className="time-info">
                    {test.timeTaken ? `${Math.floor(test.timeTaken / 60)}m ${test.timeTaken % 60}s` : 'N/A'}
                    {test.flags?.timeViolation && <span className="time-violation">⚠️</span>}
                  </div>
                </td>
                <td>
                  <div className="status-badges">
                    {test.adminReviewed ? (
                      <span className="status-badge reviewed">✅ Reviewed</span>
                    ) : (
                      <span className="status-badge pending">🔍 Pending</span>
                    )}
                    {test.isFlagged && <span className="status-badge flagged">🚩 Flagged</span>}
                  </div>
                </td>
                <td>
                  <div className="monitoring-indicators">
                    {test.violations?.length > 0 && (
                      <span className="violation-count">{test.violations.length} violations</span>
                    )}
                    {test.monitoringData?.tabSwitches > 5 && (
                      <span className="tab-switches">🔄 High tab switches</span>
                    )}
                  </div>
                </td>
                <td>
                  <div className="action-buttons">
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleModifyMarks(test)}
                      title="Modify marks and review"
                    >
                      ✏️ Review
                    </button>
                    <button
                      className="btn btn-info btn-sm"
                      onClick={() => viewMonitoringData(test)}
                      title="View detailed monitoring data"
                    >
                      📊 Monitor
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => navigate(`/admin/coding-review/${test._id}`)}
                      title="View coding solutions"
                    >
                      💻 Code
                    </button>
                    {!test.isFlagged && (
                      <button
                        className="btn btn-warning btn-sm"
                        onClick={() => flagForCheating(test._id, 'Manual review required')}
                        title="Flag for cheating review"
                      >
                        🚩 Flag
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {filteredTests.length === 0 && (
          <div className="no-results">
            No coding tests found matching your criteria.
          </div>
        )}
      </div>

      {/* Mark Modification Modal */}
      {showMarkModal && selectedTest && (
        <div className="modal-overlay">
          <div className="mark-modal">
            <div className="modal-header">
              <h3>🔧 Review & Modify Marks</h3>
              <div className="student-details">
                <strong>{selectedTest.studentId?.name}</strong> - {selectedTest.testTitle}
              </div>
            </div>
            
            <div className="modal-content">
              <div className="marks-section">
                <h4>📊 Score Modification</h4>
                <div className="score-inputs">
                  <div className="input-group">
                    <label>Total Score:</label>
                    <input
                      type="number"
                      value={modifiedMarks.totalScore}
                      onChange={(e) => setModifiedMarks({...modifiedMarks, totalScore: parseFloat(e.target.value)})}
                      min="0"
                      max="100"
                    />
                  </div>
                  <div className="input-group">
                    <label>Code Quality:</label>
                    <input
                      type="number"
                      value={modifiedMarks.codeQuality}
                      onChange={(e) => setModifiedMarks({...modifiedMarks, codeQuality: parseFloat(e.target.value)})}
                      min="0"
                      max="25"
                    />
                  </div>
                  <div className="input-group">
                    <label>Efficiency:</label>
                    <input
                      type="number"
                      value={modifiedMarks.efficiency}
                      onChange={(e) => setModifiedMarks({...modifiedMarks, efficiency: parseFloat(e.target.value)})}
                      min="0"
                      max="25"
                    />
                  </div>
                  <div className="input-group">
                    <label>Test Cases:</label>
                    <input
                      type="number"
                      value={modifiedMarks.testCases}
                      onChange={(e) => setModifiedMarks({...modifiedMarks, testCases: parseFloat(e.target.value)})}
                      min="0"
                      max="50"
                    />
                  </div>
                </div>
              </div>

              <div className="flags-section">
                <h4>🚩 Cheating Flags</h4>
                <div className="flag-checkboxes">
                  <label>
                    <input
                      type="checkbox"
                      checked={cheatingFlags.timeViolation}
                      onChange={(e) => setCheatingFlags({...cheatingFlags, timeViolation: e.target.checked})}
                    />
                    Time Violation
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={cheatingFlags.codePatterns}
                      onChange={(e) => setCheatingFlags({...cheatingFlags, codePatterns: e.target.checked})}
                    />
                    Suspicious Code Patterns
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={cheatingFlags.behaviorAnomaly}
                      onChange={(e) => setCheatingFlags({...cheatingFlags, behaviorAnomaly: e.target.checked})}
                    />
                    Behavior Anomaly
                  </label>
                </div>
              </div>

              <div className="notes-section">
                <h4>📝 Admin Notes</h4>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add any additional notes about this submission..."
                  rows="4"
                />
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowMarkModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={saveMarkModifications}>
                💾 Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CodingAdminPanel;
