import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useTheme, useAuth } from '../../App';
// Inline CSS injection to bypass PostCSS parsing issues with external CSS files
const CPD_CSS = `
/* Override body and root backgrounds only when dashboard is active */
.leetcode-dashboard-page body, .leetcode-dashboard-page html {
  background: #0a0a0a !important;
  background-color: #0a0a0a !important;
}

/* Base - Force Dark Theme with stronger specificity */
.leetcode-dashboard, .leetcode-dashboard.dark-theme, .leetcode-dashboard.light-theme { 
  background: #0a0a0a !important; 
  background-color: #0a0a0a !important;
  color: #ffffff !important; 
  min-height: calc(100vh - 70px); 
  font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,Cantarell,sans-serif; 
  position: relative;
  overflow-y: auto;
  padding-top: 20px;
}

/* Ensure all child elements inherit dark theme */
.leetcode-dashboard *, .leetcode-dashboard *::before, .leetcode-dashboard *::after {
  background-color: inherit;
}

/* Layout helpers */
.lc-container { max-width: 1200px; margin: 0 auto; padding: 0 24px; }

/* Header */
.lc-header { background: #1a1a1a; border-bottom: 1px solid #333; padding: 24px 0; position: sticky; top: 0; z-index: 100; backdrop-filter: blur(10px); }
.lc-header-content { display: flex; justify-content: space-between; align-items: center; gap: 32px; }
.lc-logo-section { display: flex; align-items: center; gap: 16px; }
.lc-title { font-size: 2rem; font-weight: 700; margin: 0; background: linear-gradient(135deg,#ff6b35 0%,#ff8f66 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
.lc-subtitle { color: #a6a6a6; font-size: 16px; font-weight: 500; margin: 0; }
.lc-subtext { color: #8c8c8c; font-size: 14px; margin: 0; }

/* Progress */
.lc-progress-section { display: flex; align-items: center; gap: 24px; }
.lc-progress-circle { width: 120px; height: 120px; display: flex; align-items: center; justify-content: center; background: #262626; border-radius: 50%; border: 8px solid #ff6b35; box-shadow: inset 0 0 30px rgba(0,0,0,.3); }
.lc-circle-inner { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; }
.lc-solved-count { font-size: 1.8rem; font-weight: 800; color: #ff6b35; }
.lc-solved-label { font-size: 12px; color: #a6a6a6; }
.lc-quick-stats { display: flex; gap: 20px; }
.lc-stat-item { display: flex; flex-direction: column; }
.lc-stat-number { font-weight: 800; font-size: 18px; background: linear-gradient(135deg,#ff6b35 0%,#ff8f66 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
.lc-stat-label { font-size: 12px; color: #a6a6a6; }
/* Difficulty breakdown badges */
.lc-diff-breakdown { display: flex; gap: 8px; align-items: center; margin-top: 6px; }
.lc-diff-badge { padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; border: 1px solid transparent; }
.lc-diff-easy { color: #22c55e; background: rgba(34,197,94,0.12); border-color: rgba(34,197,94,0.35); }
.lc-diff-medium { color: #facc15; background: rgba(250,204,21,0.12); border-color: rgba(250,204,21,0.35); }
.lc-diff-hard { color: #ef4444; background: rgba(239,68,68,0.12); border-color: rgba(239,68,68,0.35); }

/* Tabs */
.lc-nav-tabs { background: #1a1a1a; border-bottom: 1px solid #333; }
.lc-tab-list { display: flex; gap: 0; }
.lc-tab { background: none; border: none; padding: 16px 24px; cursor: pointer; color: #a6a6a6; border-bottom: 2px solid transparent; font-weight: 600; font-size: 14px; }
.lc-tab:hover { color: #ffffff; background: rgba(255,107,53,0.10); }
.lc-tab.lc-tab-active { color: #ff6b35; border-bottom-color: #ff6b35; }

/* Filters & search */
.lc-problems-section { padding: 24px 0; }
.lc-filters-bar { display: flex; justify-content: space-between; margin-bottom: 24px; gap: 20px; }
.lc-filters-left { display: flex; gap: 16px; }
.lc-filter-group { display: flex; flex-direction: column; gap: 6px; }
.lc-filter-label { color: #a6a6a6; font-size: 12px; text-transform: uppercase; letter-spacing: .4px; }
.lc-filter-select { background: #262626; color: #fff; border: 1px solid #3d3d3d; border-radius: 6px; padding: 8px 12px; }
.lc-search-box { position: relative; }
.lc-search-input { padding: 10px 36px 10px 12px; border: 1px solid #3d3d3d; border-radius: 6px; background: #262626; color: #fff; min-width: 260px; }
.lc-search-icon { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); width: 18px; height: 18px; color: #a6a6a6; }

/* Problems table */
.lc-problems-table { background: #1a1a1a; border: 1px solid #333; border-radius: 8px; overflow: hidden; }
.lc-table-header { display: grid; grid-template-columns: 60px 1fr 120px 120px 160px; background: #262626; padding: 12px 0; font-weight: 600; font-size: 13px; color: #a6a6a6; }
.lc-table-body { }
.lc-problem-row { display: grid; grid-template-columns: 60px 1fr 120px 120px 160px; padding: 14px 0; border-bottom: 1px solid #333; cursor: pointer; }
.lc-problem-row:hover { background: #1a1a1a; }
.lc-td { padding: 0 16px; display: flex; align-items: center; gap: 8px; }
.lc-problem-title { background: none; border: none; color: #ffffff; cursor: pointer; font-weight: 600; text-align: left; }
.lc-problem-title:hover { color: #ff6b35; }

/* Status and Difficulty badges */
.lc-solved-badge { background: #00b894; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; margin-left: 8px; }
.lc-difficulty { padding: 4px 8px; border-radius: 6px; font-size: 12px; font-weight: 700; }
.lc-difficulty-easy { color: #00b894; background: rgba(0,184,148,0.15); border: 1px solid rgba(0,184,148,0.35); }
.lc-difficulty-medium { color: #fdcb6e; background: rgba(253,203,110,0.15); border: 1px solid rgba(253,203,110,0.35); }
.lc-difficulty-hard { color: #e17055; background: rgba(225,112,85,0.15); border: 1px solid rgba(225,112,85,0.35); }

/* Loading/Empty */
.lc-loading { display: flex; justify-content: center; align-items: center; padding: 60px; color: #a6a6a6; gap: 12px; }
.lc-loading-spinner { width: 24px; height: 24px; border: 3px solid #333; border-top: 3px solid #ff6b35; border-radius: 50%; animation: lc-spin 1s linear infinite; }
@keyframes lc-spin { 0% { transform: rotate(0deg);} 100% { transform: rotate(360deg);} }
.lc-no-problems { text-align: center; padding: 60px; color: #a6a6a6; }

/* Mobile Responsive */
@media (max-width: 768px) {
  .lc-container { padding: 0 16px; }
  .lc-header { padding: 16px 0; }
  .lc-header-content { flex-direction: column; gap: 16px; text-align: center; }
  .lc-progress-section { flex-direction: column; gap: 16px; }
  .lc-progress-circle { width: 100px; height: 100px; }
  .lc-quick-stats { justify-content: center; }
  .lc-filters-bar { flex-direction: column; gap: 16px; }
  .lc-filters-left { flex-direction: column; gap: 12px; }
  .lc-search-input { min-width: 100%; }
  .lc-table-header, .lc-problem-row { grid-template-columns: 40px 1fr 80px 90px; font-size: 14px; }
  .lc-tab { padding: 12px 16px; font-size: 13px; }
  .lc-problems-section { padding: 16px 0; }
  .lc-title { font-size: 1.5rem; }
  .lc-solved-count { font-size: 1.5rem; }
  .lc-stat-number { font-size: 16px; }
}

/* Touch-friendly interactions */
@media (hover: none) and (pointer: coarse) {
  .lc-tab { padding: 14px 18px; }
  .lc-problem-row { padding: 16px 12px; min-height: 60px; }
  .lc-difficulty-badge { padding: 6px 12px; }
  .lc-filter-select, .lc-search-input { padding: 12px 16px; }
}

/* Enhanced Submissions Styles */
.lc-submission-item {
  display: grid;
  grid-template-columns: 150px 1fr 100px 200px;
  align-items: center;
  padding: 16px;
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 8px;
  margin-bottom: 12px;
  transition: all 0.3s ease;
  gap: 16px;
}

.lc-submission-item:hover {
  background: #262626;
  border-color: #ff6b35;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(255, 107, 53, 0.2);
}

.lc-submission-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.lc-view-code-btn, .lc-retry-btn, .lc-discuss-btn {
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.lc-view-code-btn {
  background: linear-gradient(135deg, #6366f1, #4f46e5);
  color: white;
}

.lc-retry-btn {
  background: linear-gradient(135deg, #f59e0b, #d97706);
  color: white;
}

.lc-discuss-btn {
  background: linear-gradient(135deg, #10b981, #059669);
  color: white;
}

.lc-view-code-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 8px rgba(99, 102, 241, 0.3); }
.lc-retry-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 8px rgba(245, 158, 11, 0.3); }
.lc-discuss-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 8px rgba(16, 185, 129, 0.3); }

/* Code Modal Styles */
.code-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
}

.code-modal-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(4px);
}

.code-modal-content {
  background: #1a1a1a;
  border-radius: 12px;
  border: 1px solid #333;
  max-width: 800px;
  max-height: 80vh;
  width: 90%;
  overflow: hidden;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
}

.code-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #333;
  background: #262626;
}

.code-modal-header h3 {
  color: #ff6b35;
  margin: 0;
  font-size: 1.2rem;
}

.code-modal-header button {
  background: none;
  border: none;
  color: #999;
  font-size: 24px;
  cursor: pointer;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.3s ease;
}

.code-modal-header button:hover {
  background: #ff6b35;
  color: white;
}

.code-modal-body {
  padding: 20px;
  max-height: 60vh;
  overflow-y: auto;
}

.code-info {
  display: flex;
  gap: 20px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.code-info span {
  background: #262626;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  color: #ccc;
}

.code-display {
  background: #0d1117;
  border: 1px solid #333;
  border-radius: 8px;
  padding: 16px;
  margin: 0;
  overflow-x: auto;
  max-height: 400px;
  overflow-y: auto;
}

.code-display code {
  color: #e6edf3;
  font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

@media (max-width: 768px) {
  .lc-submission-item {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  
  .lc-submission-actions {
    justify-content: center;
  }
  
  .code-modal-content {
    width: 95%;
    max-height: 85vh;
  }
}
`;

const CodingPracticeDashboard = ({ onProblemSelect }) => {
  const navigate = useNavigate();
  const { darkMode } = useTheme();
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [problems, setProblems] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState('all');
  const [selectedTopic, setSelectedTopic] = useState('all');
  const [topics, setTopics] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSolved, setShowSolved] = useState('all'); // all, solved, unsolved
  const [studentRank, setStudentRank] = useState(null);
  const [activeTab, setActiveTab] = useState('problems');

  // Hoist function definitions to prevent TDZ issues
  const fetchDashboardData = React.useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/coding-practice/student/dashboard', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDashboardData(response.data.dashboard);
      
      // Set groups from dashboard data if available, otherwise fetch separately
      if (response.data.dashboard?.availableGroups) {
        setGroups(response.data.dashboard.availableGroups);
      } else {
        // Call fetchGroups only if not available in dashboard
        const token = localStorage.getItem('token');
        try {
          const groupResponse = await axios.get('/api/coding-practice/student/groups', {
            headers: { Authorization: `Bearer ${token}` }
          });
          setGroups(groupResponse.data.groups);
        } catch (groupError) {
          console.error('Error fetching groups:', groupError);
        }
      }
    } catch (error) {
      console.error('Error fetching dashboard:', error);
      toast.error('Failed to load dashboard data');
      // Try to fetch groups separately if dashboard fails
      const token = localStorage.getItem('token');
      try {
        const groupResponse = await axios.get('/api/coding-practice/student/groups', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setGroups(groupResponse.data.groups);
      } catch (groupError) {
        console.error('Error fetching groups:', groupError);
      }
    }
  }, []);

  // Handle study plan start/resume
  const handleStudyPlanAction = React.useCallback(async (groupId, isStarted) => {
    try {
      const token = localStorage.getItem('token');
      
      if (!isStarted) {
        // Start new study plan
        const response = await axios.post(`/api/coding-practice/student/study-plans/${groupId}/start`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (response.data.success) {
          toast.success(response.data.message);
          // Refresh dashboard data to show updated progress
          fetchDashboardData();
        }
      }
      
      // Switch to problems tab and filter by the selected group
      setSelectedGroup(groupId);
      setActiveTab('problems');
      
    } catch (error) {
      console.error('Error with study plan action:', error);
      toast.error(error.response?.data?.message || 'Failed to start study plan');
    }
  }, [fetchDashboardData]);

  const fetchTopics = React.useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (selectedGroup !== 'all') params.append('groupId', selectedGroup);
      const response = await axios.get(`/api/coding-practice/student/topics?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTopics(response.data.topics || []);
    } catch (error) {
      console.error('Error fetching topics:', error);
      setTopics([]);
    }
  }, [selectedGroup]);

  const fetchStudentRank = React.useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/coding-practice/student/rank', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setStudentRank(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching student rank:', error);
      setStudentRank(null);
    }
  }, []);

  const fetchProblems = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      
  if (selectedGroup !== 'all') params.append('groupId', selectedGroup);
      if (selectedDifficulty !== 'all') params.append('difficulty', selectedDifficulty);
      if (searchTerm) params.append('search', searchTerm);
  if (selectedTopic !== 'all') params.append('topic', selectedTopic);
      
      const response = await axios.get(`/api/coding-practice/student/problems?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      let filteredProblems = response.data.problems;
      
      // Filter by solved status
      if (showSolved === 'solved') {
        filteredProblems = filteredProblems.filter(p => p.progress.status === 'Accepted');
      } else if (showSolved === 'unsolved') {
        filteredProblems = filteredProblems.filter(p => p.progress.status !== 'Accepted');
      }
      
      setProblems(filteredProblems);
    } catch (error) {
      console.error('Error fetching problems:', error);
      toast.error('Failed to load problems');
    } finally {
      setLoading(false);
    }
  }, [selectedGroup, selectedDifficulty, searchTerm, showSolved, selectedTopic]);

  // useEffect hooks that depend on fetchProblems
  useEffect(() => {
    fetchDashboardData(); // This will handle groups fetching
    fetchProblems();
    fetchStudentRank();
    fetchTopics();
  }, [fetchDashboardData, fetchProblems, fetchStudentRank, fetchTopics]);

  useEffect(() => {
    fetchProblems();
    fetchTopics();
  }, [selectedGroup, fetchProblems, fetchTopics]);

  useEffect(() => {
    fetchProblems();
  }, [selectedDifficulty, searchTerm, showSolved, selectedTopic, fetchProblems]);

  // Hoist utility functions to prevent TDZ issues
  const getStatusIcon = React.useCallback((status) => {
    switch (status) {
      case 'Accepted': return '✅';
      case 'Wrong Answer': return '❌';
      case 'Time Limit Exceeded': return '⏱️';
      case 'Runtime Error': return '💥';
      case 'Compilation Error': return '🔨';
      default: return '⭕';
    }
  }, []);

  const getStatusColor = React.useCallback((status) => {
    switch (status) {
      case 'Accepted': return 'success';
      case 'Wrong Answer': return 'error';
      case 'Time Limit Exceeded': return 'warning';
      case 'Runtime Error': return 'error';
      case 'Compilation Error': return 'error';
      default: return 'default';
    }
  }, []);

  const getDifficultyColor = React.useCallback((difficulty) => {
    switch (difficulty) {
      case 'Easy': return 'easy';
      case 'Medium': return 'medium';
      case 'Hard': return 'hard';
      default: return 'default';
    }
  }, []);

  if (!dashboardData) {
    return (
      <div className="coding-dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Loading your coding practice dashboard...</p>
      </div>
    );
  }

  return (
    <div className="leetcode-dashboard-page">
      <div className={`leetcode-dashboard ${darkMode ? 'dark-theme' : 'light-theme'}`}>
        <style dangerouslySetInnerHTML={{ __html: CPD_CSS }} />
      {/* LeetCode-style Header */}
      <div className="lc-header">
        <div className="lc-container">
          <div className="lc-header-content">
            <div className="lc-logo-section">
              <h1 className="lc-title">💻 AucTutor Practice</h1>
              <p className="lc-subtitle">Welcome back, {user?.name || 'Student'}!</p>
              <p className="lc-subtext">Level up your coding skills</p>
            </div>
            
            {/* Progress Circle (LeetCode-style) */}
            <div className="lc-progress-section">
              <div className="lc-progress-circle">
                <div className="lc-circle-inner">
                  <span className="lc-solved-count">{dashboardData?.stats?.solvedProblems || 0}</span>
                  <span className="lc-solved-label">Solved</span>
                </div>
              </div>
              
              {/* Quick Stats */}
              <div className="lc-quick-stats">
                <div className="lc-stat-item">
                  <span className="lc-stat-number">{dashboardData?.stats?.totalSubmissions || 0}</span>
                  <span className="lc-stat-label">Submissions</span>
                </div>
                <div className="lc-stat-item">
                  <span className="lc-stat-number">{dashboardData?.stats?.accuracyRate?.toFixed(1) || 0}%</span>
                  <span className="lc-stat-label">Success Rate</span>
                </div>
                <div className="lc-stat-item">
                  <span className="lc-stat-number">{dashboardData?.stats?.problemsSolved || 0}</span>
                  <span className="lc-stat-label">✅ Solved</span>
                </div>
                <div className="lc-stat-item">
                  <span className="lc-stat-number">{dashboardData?.stats?.totalScore || 0}</span>
                  <span className="lc-stat-label">⭐ Score</span>
                </div>
                {(dashboardData?.stats?.rank || studentRank) && (
                  <div className="lc-stat-item lc-rank-item">
                    <span className="lc-stat-number">#{dashboardData?.stats?.rank || studentRank?.rank}</span>
                    <span className="lc-stat-label">🏆 Rank</span>
                    <div className="lc-diff-breakdown">
                      <span className="lc-diff-badge lc-diff-easy">E {dashboardData?.stats?.easyProblems || studentRank?.easyProblems || 0}</span>
                      <span className="lc-diff-badge lc-diff-medium">M {dashboardData?.stats?.mediumProblems || studentRank?.mediumProblems || 0}</span>
                      <span className="lc-diff-badge lc-diff-hard">H {dashboardData?.stats?.hardProblems || studentRank?.hardProblems || 0}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* LeetCode-style Navigation Tabs */}
      <div className="lc-nav-tabs">
        <div className="lc-container">
          <div className="lc-tab-list">
            <button 
              className={`lc-tab ${activeTab === 'problems' ? 'lc-tab-active' : ''}`}
              onClick={() => setActiveTab('problems')}
            >
              Problems
            </button>
            <button 
              className={`lc-tab ${activeTab === 'explore' ? 'lc-tab-active' : ''}`}
              onClick={() => setActiveTab('explore')}
            >
              Explore
            </button>
            <button 
              className={`lc-tab ${activeTab === 'submissions' ? 'lc-tab-active' : ''}`}
              onClick={() => setActiveTab('submissions')}
            >
              Submissions
            </button>
          </div>
        </div>
      </div>

      <div className="lc-container">
        {/* Problems Tab Content */}
        {activeTab === 'problems' && (
          <div className="lc-problems-section">
            {/* LeetCode-style Filters */}
            <div className="lc-filters-bar">
              <div className="lc-filters-left">
                <div className="lc-filter-group">
                  <label className="lc-filter-label">Lists</label>
                  <select 
                    value={selectedGroup} 
                    onChange={(e) => setSelectedGroup(e.target.value)}
                    className="lc-filter-select"
                  >
                    <option value="all">All Topics</option>
                    {groups.map(group => (
                      <option key={group._id} value={group._id}>{group.name}</option>
                    ))}
                  </select>
                </div>

                <div className="lc-filter-group">
                  <label className="lc-filter-label">Topic</label>
                  <select 
                    value={selectedTopic}
                    onChange={(e) => setSelectedTopic(e.target.value)}
                    className="lc-filter-select"
                  >
                    <option value="all">All</option>
                    {topics.map(t => {
                      const key = t.key || t.label || t.topic;
                      const label = t.label || t.topic || 'Unknown';
                      const count = t.count ?? t.total ?? t.value ?? 0;
                      return (
                        <option key={key} value={label}>{label} ({count})</option>
                      );
                    })}
                  </select>
                </div>
                
                <div className="lc-filter-group">
                  <label className="lc-filter-label">Difficulty</label>
                  <select 
                    value={selectedDifficulty} 
                    onChange={(e) => setSelectedDifficulty(e.target.value)}
                    className="lc-filter-select"
                  >
                    <option value="all">All</option>
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>
                
                <div className="lc-filter-group">
                  <label className="lc-filter-label">Status</label>
                  <select 
                    value={showSolved} 
                    onChange={(e) => setShowSolved(e.target.value)}
                    className="lc-filter-select"
                  >
                    <option value="all">All</option>
                    <option value="solved">Solved</option>
                    <option value="unsolved">Unsolved</option>
                  </select>
                </div>
              </div>
              
              <div className="lc-search-box">
                <input
                  type="text"
                  placeholder="Search questions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="lc-search-input"
                />
                <svg className="lc-search-icon" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M10 2C5.58172 2 2 5.58172 2 10C2 14.4183 5.58172 18 10 18C11.8487 18 13.551 17.3729 14.9056 16.3199L20.2929 21.7071C20.6834 22.0976 21.3166 22.0976 21.7071 21.7071C22.0976 21.3166 22.0976 20.6834 21.7071 20.2929L16.3199 14.9056C17.3729 13.551 18 11.8487 18 10C18 5.58172 14.4183 2 10 2ZM4 10C4 6.68629 6.68629 4 10 4C13.3137 4 16 6.68629 16 10C16 13.3137 13.3137 16 10 16C6.68629 16 4 13.3137 4 10Z"/>
                </svg>
              </div>
            </div>

            {/* LeetCode-style Problems Table */}
            <div className="lc-problems-table">
              <div className="lc-table-header">
                <div className="lc-td">Status</div>
                <div className="lc-td">Title</div>
                <div className="lc-td">Acceptance</div>
                <div className="lc-td">Difficulty</div>
                <div className="lc-td">Group</div>
              </div>
              
              {loading ? (
                <div className="lc-loading">
                  <div className="lc-loading-spinner"></div>
                  <span className="lc-loading-text">Loading problems...</span>
                </div>
              ) : problems.length === 0 ? (
                <div className="lc-no-problems">
                  <div className="lc-no-problems-icon">🔍</div>
                  <h3 className="lc-no-problems-title">No problems found</h3>
                  <p className="lc-no-problems-description">Try adjusting your filters or search terms</p>
                </div>
              ) : (
                <div className="lc-table-body">
                  {problems.map((problem, index) => (
                    <div key={problem._id} className="lc-problem-row">
                      <div className="lc-td">
                        <span className="lc-problem-status">
                          {getStatusIcon(problem.progress?.status || 'Not Attempted')}
                        </span>
                      </div>
                      
                      <div className="lc-td">
                        <button 
                          className="lc-problem-title"
                          onClick={() => onProblemSelect ? onProblemSelect(problem._id) : navigate(`/coding-practice/problem/${problem._id}`)}
                        >
                          {problem.problemNumber ? `${problem.problemNumber}. ` : ''}{problem.title}
                          {problem.progress?.status === 'Accepted' && (
                            <span className="lc-solved-badge">Solved</span>
                          )}
                        </button>
                      </div>
                      
                      <div className="lc-td">
                        <span>{problem.acceptanceRate?.toFixed(1) || 0}%</span>
                      </div>
                      
                      <div className="lc-td">
                        <span className={`lc-difficulty lc-difficulty-${problem.difficulty?.toLowerCase() || 'easy'}`}>
                          {problem.difficulty || 'Easy'}
                        </span>
                      </div>
                      
                      <div className="lc-td">
                        <span className="lc-problem-group">
                          {problem.group?.name || 'General'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Explore Tab Content */}
        {activeTab === 'explore' && (
          <div className="lc-explore-section">
            <div className="lc-section-header">
              <h2>📚 Study Plans</h2>
              <p>Structured learning paths to master coding concepts</p>
            </div>
            <div className="lc-explore-grid">
              {(dashboardData?.availableGroups || groups)?.map(group => {
                const studentProgress = group.studentProgress;
                const isStarted = !!studentProgress;
                const isCompleted = studentProgress?.status === 'completed';
                const solvedCount = studentProgress?.solvedProblems || 0;
                const totalProblems = group.problems?.length || group.totalProblems || 0;
                const progress = studentProgress?.progressPercentage || 0;
                const rank = studentProgress?.rank || 'Not ranked';
                const startedAt = studentProgress?.startedAt;
                const completedAt = studentProgress?.completedAt;
                const currentStreak = studentProgress?.currentStreak || 0;
                const maxStreak = studentProgress?.maxStreak || 0;
                
                const formatDate = (date) => {
                  if (!date) return '';
                  return new Date(date).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric',
                    year: 'numeric'
                  });
                };
                
                return (
                  <div key={group._id} className="lc-study-plan-card">
                    <div className="lc-card-header">
                      <div className="lc-card-title-section">
                        <h3 className="lc-card-title">
                          {group.name}
                          {isCompleted && <span className="lc-completed-badge">✅</span>}
                        </h3>
                        <span className={`lc-card-difficulty lc-difficulty-${group.difficulty?.toLowerCase() || 'medium'}`}>
                          {group.difficulty || 'Medium'}
                        </span>
                      </div>
                      <div className="lc-progress-circle">
                        <svg width="50" height="50" viewBox="0 0 50 50">
                          <circle
                            cx="25" cy="25" r="20"
                            fill="none" stroke="#333" strokeWidth="4"
                          />
                          <circle
                            cx="25" cy="25" r="20"
                            fill="none" 
                            stroke={isCompleted ? "#52c41a" : "#00b4d8"} 
                            strokeWidth="4"
                            strokeDasharray={`${progress * 1.256} 125.6`}
                            strokeDashoffset="31.4"
                            transform="rotate(-90 25 25)"
                            className="lc-progress-bar"
                          />
                        </svg>
                        <span className="lc-progress-text">{progress}%</span>
                      </div>
                    </div>
                    
                    <p className="lc-card-description">{group.description || 'Master coding concepts with structured problems'}</p>
                    
                    <div className="lc-study-plan-stats">
                      <div className="lc-stat-row">
                        <span className="lc-stat-label">
                          <span className="lc-stat-icon">📝</span>
                          Progress
                        </span>
                        <span className="lc-stat-value">
                          {solvedCount}/{totalProblems} problems
                        </span>
                      </div>
                      
                      <div className="lc-stat-row">
                        <span className="lc-stat-label">
                          <span className="lc-stat-icon">🏆</span>
                          Rank
                        </span>
                        <span className="lc-stat-value">{rank}</span>
                      </div>
                      
                      {isStarted && (
                        <>
                          <div className="lc-stat-row">
                            <span className="lc-stat-label">
                              <span className="lc-stat-icon">🔥</span>
                              Streak
                            </span>
                            <span className="lc-stat-value">{currentStreak} days</span>
                          </div>
                          
                          <div className="lc-stat-row">
                            <span className="lc-stat-label">
                              <span className="lc-stat-icon">📅</span>
                              {isCompleted ? 'Completed' : 'Started'}
                            </span>
                            <span className="lc-stat-value">
                              {formatDate(isCompleted ? completedAt : startedAt)}
                            </span>
                          </div>
                        </>
                      )}
                      
                      <div className="lc-stat-row">
                        <span className="lc-stat-label">
                          <span className="lc-stat-icon">🎓</span>
                          Level
                        </span>
                        <span className="lc-stat-value">
                          {group.allowedStudentClasses?.join(', ') || 'All classes'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="lc-card-actions">
                      <button 
                        className={`lc-study-plan-btn ${
                          isCompleted ? 'lc-completed' : 
                          isStarted ? 'lc-continue' : 'lc-start'
                        }`}
                        onClick={() => handleStudyPlanAction(group._id, isStarted)}
                      >
                        {isCompleted ? '✅ Completed' :
                         isStarted ? '📖 Resume Study Plan' : '🚀 Start Study Plan'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            
            {(!dashboardData?.availableGroups || dashboardData.availableGroups.length === 0) && (
              <div className="lc-empty-state">
                <div className="lc-empty-icon">📚</div>
                <h3>No Study Plans Available</h3>
                <p>Study plans for your class will appear here when created by admins.</p>
              </div>
            )}
          </div>
        )}

        {/* Submissions Tab Content */}
        {activeTab === 'submissions' && (
          <div className="lc-submissions-section">
            <div className="lc-submissions-header">
              <h2>Recent Submissions</h2>
            </div>
            
            {dashboardData?.recentSubmissions?.length > 0 ? (
              <div className="lc-submissions-list">
                {dashboardData.recentSubmissions.slice(0, 10).map(submission => (
                  <div key={submission._id} className="lc-submission-item">
                    <div className="lc-submission-status">
                      <span className={`lc-status-badge lc-status-${getStatusColor(submission.status)}`}>
                        {getStatusIcon(submission.status)} {submission.status}
                      </span>
                    </div>
                    
                    <div className="lc-submission-problem">
                      <span className="lc-submission-title">
                        #{submission.problemId?.problemNumber} {submission.problemId?.title}
                      </span>
                      <span className="lc-submission-meta">
                        {submission.language} • {new Date(submission.createdAt).toLocaleDateString()} • 
                        Runtime: {submission.executionTime?.toFixed(2) || 0}ms • 
                        Score: {submission.score}/{submission.maxScore}
                      </span>
                    </div>
                    
                    <div className="lc-submission-difficulty">
                      <span className={`lc-difficulty lc-difficulty-${getDifficultyColor(submission.problemId?.difficulty).toLowerCase()}`}>
                        {submission.problemId?.difficulty}
                      </span>
                    </div>

                    <div className="lc-submission-actions">
                      <button 
                        className="lc-view-code-btn"
                        onClick={() => {
                          // Create a modal or expanded view to show submission code
                          const modal = document.createElement('div');
                          modal.className = 'code-modal';
                          modal.innerHTML = `
                            <div class="code-modal-overlay" onclick="this.parentElement.remove()">
                              <div class="code-modal-content" onclick="event.stopPropagation()">
                                <div class="code-modal-header">
                                  <h3>Your Submission - ${submission.problemId?.title}</h3>
                                  <button onclick="this.closest('.code-modal').remove()">&times;</button>
                                </div>
                                <div class="code-modal-body">
                                  <div class="code-info">
                                    <span>Language: ${submission.language}</span>
                                    <span>Status: ${submission.status}</span>
                                    <span>Score: ${submission.score}/${submission.maxScore}</span>
                                    <span>Runtime: ${submission.executionTime?.toFixed(2) || 0}ms</span>
                                  </div>
                                  <pre class="code-display"><code>${submission.code || 'Code not available'}</code></pre>
                                </div>
                              </div>
                            </div>
                          `;
                          document.body.appendChild(modal);
                        }}
                      >
                        📄 View Code
                      </button>
                      
                      <button 
                        className="lc-retry-btn"
                        onClick={() => onProblemSelect(submission.problemId?._id)}
                      >
                        🔄 Retry
                      </button>

                      {submission.status === 'Accepted' && (
                        <button 
                          className="lc-discuss-btn"
                          onClick={() => onProblemSelect(submission.problemId?._id)}
                        >
                          💬 Discuss
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="lc-no-problems">
                <div className="lc-no-problems-icon">📝</div>
                <h3 className="lc-no-problems-title">No submissions yet</h3>
                <p className="lc-no-problems-description">Start solving problems to see your submissions here</p>
              </div>
            )}
          </div>
        )}
      </div>
      </div>
      </div>
  );
};

export default CodingPracticeDashboard;