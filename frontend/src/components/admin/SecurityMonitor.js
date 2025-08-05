import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import LoadingSpinner from '../LoadingSpinner';
import './SecurityMonitor.module.css';

const SecurityMonitor = () => {
  const [violations, setViolations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    testId: '',
    studentId: '',
    violationType: '',
    timeRange: '24h'
  });
  const [stats, setStats] = useState({
    total: 0,
    recent: 0,
    critical: 0,
    byType: {}
  });

  useEffect(() => {
    fetchViolations();
  }, [filters]);

  const fetchViolations = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      if (filters.testId) params.append('testId', filters.testId);
      if (filters.studentId) params.append('studentId', filters.studentId);
      if (filters.violationType) params.append('violationType', filters.violationType);
      
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/api/security-violations?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      if (response.data.success) {
        setViolations(response.data.violations);
        calculateStats(response.data.violations);
      }
    } catch (error) {
      console.error('Error fetching security violations:', error);
      toast.error('Failed to fetch security violations');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (violationsList) => {
    const now = new Date();
    const timeRanges = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000
    };

    const cutoffTime = now - timeRanges[filters.timeRange];
    const recentViolations = violationsList.filter(v => 
      new Date(v.timestamp) > cutoffTime
    );

    const byType = {};
    violationsList.forEach(v => {
      byType[v.violationType] = (byType[v.violationType] || 0) + 1;
    });

    const criticalTypes = ['devtools_detected', 'right_click_blocked', 'copy_attempt'];
    const critical = violationsList.filter(v => 
      criticalTypes.includes(v.violationType)
    ).length;

    setStats({
      total: violationsList.length,
      recent: recentViolations.length,
      critical,
      byType
    });
  };

  const clearOldViolations = async () => {
    try {
      const days = prompt('Clear violations older than how many days?', '30');
      if (!days) return;

      const response = await axios.delete(
        `${process.env.REACT_APP_API_URL}/api/security-violations/clear?olderThan=${days}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      if (response.data.success) {
        toast.success(response.data.message);
        fetchViolations();
      }
    } catch (error) {
      console.error('Error clearing violations:', error);
      toast.error('Failed to clear violations');
    }
  };

  const getViolationSeverity = (type) => {
    const critical = ['devtools_detected', 'right_click_blocked', 'copy_attempt'];
    const high = ['keyboard_shortcut_blocked', 'text_selection_blocked'];
    const medium = ['drag_drop_blocked', 'print_blocked'];
    
    if (critical.includes(type)) return 'critical';
    if (high.includes(type)) return 'high';
    if (medium.includes(type)) return 'medium';
    return 'low';
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const exportViolations = () => {
    const csvData = violations.map(v => ({
      'Student ID': v.studentId,
      'Test ID': v.testId,
      'Violation Type': v.violationType,
      'Timestamp': formatTimestamp(v.timestamp),
      'User Agent': v.userAgent,
      'Screen Resolution': v.screenResolution,
      'IP Address': v.ipAddress,
      'Details': JSON.stringify(v.violationDetails)
    }));

    const csv = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `security-violations-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="security-monitor">
      <div className="security-monitor__header">
        <h2>🛡️ Security Violation Monitor</h2>
        <div className="security-monitor__actions">
          <button onClick={exportViolations} className="btn btn--export">
            📊 Export CSV
          </button>
          <button onClick={clearOldViolations} className="btn btn--danger">
            🗑️ Clear Old Violations
          </button>
        </div>
      </div>

      {/* Statistics */}
      <div className="security-stats">
        <div className="stat-card">
          <h3>Total Violations</h3>
          <div className="stat-value">{stats.total}</div>
        </div>
        <div className="stat-card">
          <h3>Recent ({filters.timeRange})</h3>
          <div className="stat-value">{stats.recent}</div>
        </div>
        <div className="stat-card critical">
          <h3>Critical Violations</h3>
          <div className="stat-value">{stats.critical}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="security-filters">
        <input
          type="text"
          placeholder="Test ID"
          value={filters.testId}
          onChange={(e) => setFilters({...filters, testId: e.target.value})}
        />
        <input
          type="text"
          placeholder="Student ID"
          value={filters.studentId}
          onChange={(e) => setFilters({...filters, studentId: e.target.value})}
        />
        <select
          value={filters.violationType}
          onChange={(e) => setFilters({...filters, violationType: e.target.value})}
        >
          <option value="">All Violation Types</option>
          {Object.keys(stats.byType).map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
        <select
          value={filters.timeRange}
          onChange={(e) => setFilters({...filters, timeRange: e.target.value})}
        >
          <option value="1h">Last Hour</option>
          <option value="24h">Last 24 Hours</option>
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
        </select>
      </div>

      {/* Violation Types Distribution */}
      <div className="violation-types">
        <h3>Violation Types Distribution</h3>
        <div className="type-chart">
          {Object.entries(stats.byType).map(([type, count]) => (
            <div key={type} className="type-bar">
              <span className="type-name">{type}</span>
              <div className="type-progress">
                <div 
                  className={`type-fill ${getViolationSeverity(type)}`}
                  style={{ width: `${(count / stats.total) * 100}%` }}
                ></div>
              </div>
              <span className="type-count">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Violations List */}
      <div className="violations-list">
        <h3>Recent Security Violations</h3>
        {violations.length === 0 ? (
          <div className="no-violations">
            ✅ No security violations found for the selected criteria.
          </div>
        ) : (
          <div className="violations-table">
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Student</th>
                  <th>Test</th>
                  <th>Violation Type</th>
                  <th>Severity</th>
                  <th>Details</th>
                  <th>Device Info</th>
                </tr>
              </thead>
              <tbody>
                {violations.map((violation, index) => (
                  <tr key={index} className={`violation-row ${getViolationSeverity(violation.violationType)}`}>
                    <td>{formatTimestamp(violation.timestamp)}</td>
                    <td className="student-cell">
                      <div className="student-id">{violation.studentId}</div>
                    </td>
                    <td>{violation.testId}</td>
                    <td>
                      <span className={`violation-type ${getViolationSeverity(violation.violationType)}`}>
                        {violation.violationType}
                      </span>
                    </td>
                    <td>
                      <span className={`severity-badge ${getViolationSeverity(violation.violationType)}`}>
                        {getViolationSeverity(violation.violationType).toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <details>
                        <summary>View Details</summary>
                        <pre>{JSON.stringify(violation.violationDetails, null, 2)}</pre>
                      </details>
                    </td>
                    <td className="device-info">
                      <div>IP: {violation.ipAddress}</div>
                      <div>Resolution: {violation.screenResolution}</div>
                      <div title={violation.userAgent}>
                        UA: {violation.userAgent?.substring(0, 30)}...
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default SecurityMonitor;
