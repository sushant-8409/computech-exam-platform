import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import './MonitoringDashboard.module.css';

const MonitoringDashboard = () => {
  const [monitoringData, setMonitoringData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    testId: '',
    studentId: '',
    suspicious: '',
    page: 1,
    limit: 20
  });
  const [selectedImage, setSelectedImage] = useState(null);
  const [statistics, setStatistics] = useState({
    total: 0,
    suspicious: 0,
    flagged: 0,
    uniqueStudents: 0
  });

  // Fetch monitoring data
  const fetchMonitoringData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const params = new URLSearchParams();
      Object.keys(filters).forEach(key => {
        if (filters[key]) {
          params.append(key, filters[key]);
        }
      });

      const response = await axios.get(`/api/student/monitoring/admin/all?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setMonitoringData(response.data.data);
        
        // Calculate statistics
        const total = response.data.pagination.total;
        const suspicious = response.data.data.filter(item => item.suspicious).length;
        const flagged = response.data.data.filter(item => item.flaggedAt).length;
        const uniqueStudents = new Set(response.data.data.map(item => item.studentId)).size;
        
        setStatistics({ total, suspicious, flagged, uniqueStudents });
      }
    } catch (error) {
      console.error('Error fetching monitoring data:', error);
      toast.error('Failed to fetch monitoring data');
    } finally {
      setLoading(false);
    }
  };

  // Flag/unflag monitoring record
  const toggleFlag = async (monitoringId, currentStatus, reason = '') => {
    try {
      const token = localStorage.getItem('token');
      
      const response = await axios.post('/api/student/monitoring/flag', {
        monitoringId,
        suspicious: !currentStatus,
        reason,
        analysisResults: {
          flaggedBy: 'admin',
          flaggedAt: new Date().toISOString(),
          reason
        }
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        toast.success(currentStatus ? 'Record unflagged' : 'Record flagged');
        fetchMonitoringData(); // Refresh data
      }
    } catch (error) {
      console.error('Error flagging record:', error);
      toast.error('Failed to update flag status');
    }
  };

  // Format timestamp
  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Handle filter changes
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: 1 // Reset to first page when filters change
    }));
  };

  // Handle pagination
  const handlePageChange = (newPage) => {
    setFilters(prev => ({ ...prev, page: newPage }));
  };

  useEffect(() => {
    fetchMonitoringData();
  }, [filters]);

  if (loading && monitoringData.length === 0) {
    return (
      <div className="monitoring-dashboard">
        <div className="loading-container">
          <div className="loading-spinner large"></div>
          <p>Loading monitoring data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="monitoring-dashboard">
      <div className="dashboard-header">
        <h2>🔍 Exam Monitoring Dashboard</h2>
        <div className="statistics-bar">
          <div className="stat-item">
            <span className="stat-value">{statistics.total}</span>
            <span className="stat-label">Total Images</span>
          </div>
          <div className="stat-item suspicious">
            <span className="stat-value">{statistics.suspicious}</span>
            <span className="stat-label">Suspicious</span>
          </div>
          <div className="stat-item flagged">
            <span className="stat-value">{statistics.flagged}</span>
            <span className="stat-label">Flagged</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{statistics.uniqueStudents}</span>
            <span className="stat-label">Students</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <div className="filters-row">
          <div className="filter-group">
            <label>Test ID:</label>
            <input
              type="text"
              value={filters.testId}
              onChange={(e) => handleFilterChange('testId', e.target.value)}
              placeholder="Enter test ID"
            />
          </div>
          
          <div className="filter-group">
            <label>Student ID:</label>
            <input
              type="text"
              value={filters.studentId}
              onChange={(e) => handleFilterChange('studentId', e.target.value)}
              placeholder="Enter student ID"
            />
          </div>
          
          <div className="filter-group">
            <label>Status:</label>
            <select
              value={filters.suspicious}
              onChange={(e) => handleFilterChange('suspicious', e.target.value)}
            >
              <option value="">All</option>
              <option value="true">Suspicious Only</option>
              <option value="false">Normal Only</option>
            </select>
          </div>
          
          <button 
            className="btn btn-secondary"
            onClick={() => setFilters({ testId: '', studentId: '', suspicious: '', page: 1, limit: 20 })}
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Monitoring Data Grid */}
      <div className="monitoring-grid">
        {monitoringData.length === 0 ? (
          <div className="no-data">
            <p>No monitoring data found</p>
          </div>
        ) : (
          monitoringData.map((item) => (
            <div 
              key={item.id} 
              className={`monitoring-card ${item.suspicious ? 'suspicious' : ''} ${item.flaggedAt ? 'flagged' : ''}`}
            >
              <div className="card-header">
                <div className="student-info">
                  <strong>{item.studentId}</strong>
                  <span className="test-id">Test: {item.testId}</span>
                </div>
                <div className="card-actions">
                  <button
                    className={`btn btn-flag ${item.suspicious ? 'flagged' : ''}`}
                    onClick={() => {
                      const reason = item.suspicious ? '' : prompt('Reason for flagging:');
                      if (!item.suspicious && !reason) return;
                      toggleFlag(item.id, item.suspicious, reason);
                    }}
                    title={item.suspicious ? 'Remove flag' : 'Flag as suspicious'}
                  >
                    {item.suspicious ? '🚩' : '⚠️'}
                  </button>
                </div>
              </div>
              
              <div className="image-container">
                <img
                  src={item.webContentLink}
                  alt={`Monitoring ${item.timestamp}`}
                  className="monitoring-image"
                  onClick={() => setSelectedImage(item)}
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'block';
                  }}
                />
                <div className="image-error" style={{ display: 'none' }}>
                  📷 Image not available
                </div>
              </div>
              
              <div className="card-details">
                <div className="timestamp">
                  📅 {formatTimestamp(item.timestamp)}
                </div>
                
                {item.suspicious && (
                  <div className="flag-info">
                    <span className="flag-reason">
                      🚨 {item.flagReason || 'Flagged as suspicious'}
                    </span>
                    {item.flaggedAt && (
                      <small>Flagged: {formatTimestamp(item.flaggedAt)}</small>
                    )}
                  </div>
                )}
                
                <div className="technical-details">
                  <small>IP: {item.ipAddress}</small>
                  <small>File: {item.fileName}</small>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      <div className="pagination">
        <button
          className="btn btn-secondary"
          onClick={() => handlePageChange(filters.page - 1)}
          disabled={filters.page <= 1}
        >
          Previous
        </button>
        
        <span className="page-info">
          Page {filters.page}
        </span>
        
        <button
          className="btn btn-secondary"
          onClick={() => handlePageChange(filters.page + 1)}
          disabled={monitoringData.length < filters.limit}
        >
          Next
        </button>
      </div>

      {/* Image Modal */}
      {selectedImage && (
        <div className="image-modal-overlay" onClick={() => setSelectedImage(null)}>
          <div className="image-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Monitoring Image Details</h3>
              <button
                className="modal-close"
                onClick={() => setSelectedImage(null)}
              >
                ✕
              </button>
            </div>
            
            <div className="modal-content">
              <div className="image-details">
                <img
                  src={selectedImage.webContentLink}
                  alt={`Monitoring ${selectedImage.timestamp}`}
                  className="full-size-image"
                />
              </div>
              
              <div className="details-panel">
                <div className="detail-group">
                  <label>Student ID:</label>
                  <span>{selectedImage.studentId}</span>
                </div>
                
                <div className="detail-group">
                  <label>Test ID:</label>
                  <span>{selectedImage.testId}</span>
                </div>
                
                <div className="detail-group">
                  <label>Timestamp:</label>
                  <span>{formatTimestamp(selectedImage.timestamp)}</span>
                </div>
                
                <div className="detail-group">
                  <label>Status:</label>
                  <span className={selectedImage.suspicious ? 'suspicious' : 'normal'}>
                    {selectedImage.suspicious ? '🚨 Suspicious' : '✅ Normal'}
                  </span>
                </div>
                
                {selectedImage.flagReason && (
                  <div className="detail-group">
                    <label>Flag Reason:</label>
                    <span>{selectedImage.flagReason}</span>
                  </div>
                )}
                
                <div className="detail-group">
                  <label>IP Address:</label>
                  <span>{selectedImage.ipAddress}</span>
                </div>
                
                <div className="detail-group">
                  <label>User Agent:</label>
                  <span className="user-agent">{selectedImage.userAgent}</span>
                </div>
                
                <div className="modal-actions">
                  <button
                    className={`btn ${selectedImage.suspicious ? 'btn-success' : 'btn-danger'}`}
                    onClick={() => {
                      const reason = selectedImage.suspicious ? '' : prompt('Reason for flagging:');
                      if (!selectedImage.suspicious && !reason) return;
                      toggleFlag(selectedImage.id, selectedImage.suspicious, reason);
                      setSelectedImage(null);
                    }}
                  >
                    {selectedImage.suspicious ? 'Remove Flag' : 'Flag as Suspicious'}
                  </button>
                  
                  <a
                    href={selectedImage.webViewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary"
                  >
                    View in Drive
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MonitoringDashboard;
