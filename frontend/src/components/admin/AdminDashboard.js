import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../App';
import axios from 'axios';
import { toast } from 'react-toastify';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const AdminDashboard = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [selectedResult, setSelectedResult] = useState(null);
  const [isUploaded, setIsUploaded] = useState(false);
  const fileInputRef = useRef(null);
  const { testId } = useParams();
  // Dashboard Data
  const [dashboardStats, setDashboardStats] = useState({
    totalStudents: 0,
    activeTests: 0,
    pendingResults: 0,
    totalTests: 0,
    todaySubmissions: 0,
    averageScore: 0,
    passRate: 0,
    totalViolations: 0
  });

  const [chartData, setChartData] = useState({
    testSubmissions: { labels: [], data: [] },
    studentGrades: { labels: [], data: [] },
    subjectPerformance: { labels: [], data: [] }
  });

  // Data Management
  const [tests, setTests] = useState([]);
  const [students, setStudents] = useState([]);
  const [results, setResults] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterBoard, setFilterBoard] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [currentTestId, setCurrentTestId] = useState(null);
  const [formFields, setFormFields] = useState({
    title: '',
    description: '',
    subject: '',
    class: '',
    board: '',
    duration: '',
    totalMarks: '',
    passingMarks: '',
    questionsCount: '',
    startDate: '',
    endDate: '',
    answerKeyVisible: false,
    resumeEnabled: true,
    proctoringSettings: {
      strictMode: true,
      allowTabSwitch: 0,
      requireFullscreen: true,
      blockRightClick: true,
      blockKeyboardShortcuts: true
    }
  });
  const initialFormState = {
    title: '', subject: '', class: '', board: '',
    duration: 60, totalMarks: 100, passingMarks: 40,
    questionsCount: 10, startDate: '', endDate: '',
    answerKeyVisible: false, resumeEnabled: true,
    proctoringSettings: { strictMode: true, allowTabSwitch: 0, requireFullscreen: true, blockRightClick: true, blockKeyboardShortcuts: true }
  };
  // Form States
  const [form, setForm] = useState({
    title: '', description: '', subject: '', class: '', board: '',
    duration: 60, totalMarks: 100, passingMarks: 40,
    questionsCount: 10, startDate: '', endDate: '',
    answerKeyVisible: false, resumeEnabled: true,
    proctoringSettings: { strictMode: true, allowTabSwitch: 0, requireFullscreen: true, blockRightClick: true, blockKeyboardShortcuts: true }
  });
  const [testForm, setTestForm] = useState({
    title: '', subject: '', class: '', board: '',
    duration: 60, totalMarks: 100, passingMarks: 40,
    questionsCount: 10, startDate: '', endDate: '',
    answerKeyVisible: false, resumeEnabled: true,
    proctoringSettings: {
      strictMode: true, allowTabSwitch: 0,
      requireFullscreen: true,
      blockRightClick: true,
      blockKeyboardShortcuts: true
    }
  });
  const [files, setFiles] = useState({ questionPaper: null, answerSheet: null, answerKey: null });
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [uploading, setUploading] = useState(false);
  // In AdminDashboard component
  const [fileUrls, setFileUrls] = useState({
    questionPaper: { key: '', previewUrl: '' },
    answerSheet: { key: '', previewUrl: '' },
    answerKey: { key: '', previewUrl: '' }
  });

  const [bulkActionMode, setBulkActionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);
  useEffect(() => {
    axios.get('/api/admin/tests')
      .then(({ data }) => setTests(data.tests || []))
      .catch(err => console.error('Fetch tests error:', err));
  }, []);

  const handleChange = e => {
    const { name, value, type, checked } = e.target;

    // Handle nested proctoringSettings keys
    if (
      name === 'strictMode' ||
      name === 'allowTabSwitch' ||
      name === 'requireFullscreen' ||
      name === 'blockRightClick' ||
      name === 'blockKeyboardShortcuts'
    ) {
      setTestForm(prev => ({
        ...prev,
        proctoringSettings: {
          ...prev.proctoringSettings,
          [name]:
            type === 'checkbox'
              ? checked
              : type === 'number'
                ? Number(value)
                : value
        }
      }));
      return;
    }

    // Top-level fields
    setTestForm(prev => ({
      ...prev,
      [name]:
        type === 'checkbox'
          ? checked
          : type === 'number'
            ? Number(value)
            : value
    }));
  };
  const handleFileSelect = e => {
    const { name, files: sel } = e.target;
    setFiles(f => ({ ...f, [name]: sel[0] || null }));
  };
  // Valid combinations for class and board
  const validClassBoardCombinations = {
    'CBSE': ['9', '10', '11', '12'],
    'ICSE': ['9', '10'],
    'ISC': ['11', '12'],
    'WBCHSE': ['11', '12'],
    'State Board': ['9', '10', '11', '12']
  };
  // inside AdminDashboard component, alongside other handlers

  const handleEditTest = test => {
    navigate(`/admin/tests/edit/${testId}`);
  };


  const handleViewResults = test => {
    // switch to the Results tab and filter by this test
    setActiveTab('results');
    setSearchTerm(test.title);
  };

  const handleDuplicateTest = async test => {
    try {
      const payload = { ...test, title: test.title + ' (Copy)' };
      delete payload._id;             // remove id so MongoDB creates a new document
      const { data } = await axios.post('/api/admin/tests', payload);
      toast.success('Test duplicated!');
      fetchDashboardData();           // refresh list
    } catch (err) {
      toast.error('Failed to duplicate test');
    }
  };

  // in component scope
  const handleDeleteTest = async testId => {

    if (!window.confirm('Delete this test permanently?')) return;
    try {
      await axios.delete(`/api/admin/tests/${testId}`);
      console.log('Deleting testId:', testId);
      toast.success('Test deleted');
      fetchDashboardData();
    } catch (err) {
      toast.error('Failed to delete test');
    }
  };


  // Initialize dashboard
  useEffect(() => {
    fetchDashboardData();
    fetchChartData();

    // Load theme preference
    const savedTheme = localStorage.getItem('admin-theme');
    if (savedTheme === 'dark') {
      setDarkMode(true);
      document.body.classList.add('dark-theme');
    }
  }, []);

  // Theme toggle effect
  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark-theme');
      localStorage.setItem('admin-theme', 'dark');
    } else {
      document.body.classList.remove('dark-theme');
      localStorage.setItem('admin-theme', 'light');
    }
  }, [darkMode]);

  // Fetch dashboard statistics
  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [statsRes, testsRes, studentsRes, resultsRes] = await Promise.all([
        axios.get('/api/admin/dashboard/stats'),
        axios.get('/api/admin/tests'),
        axios.get('/api/admin/students'),
        axios.get('/api/admin/results')
      ]);

      setDashboardStats(statsRes.data.stats || {});
      setTests(testsRes.data.tests || []);
      setStudents(studentsRes.data.students || []);
      setResults(resultsRes.data.results || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  };

  // Fetch chart data
  const fetchChartData = async () => {
    try {
      const response = await axios.get('/api/admin/dashboard/charts');
      setChartData(response.data.charts || {});
    } catch (error) {
      console.error('Error fetching chart data:', error);
    }
  };

  // File upload handler

  // 2) Main create‐test handler

  // Bulk actions
  const handleBulkAction = async (action) => {
    if (selectedItems.length === 0) {
      toast.error('Please select items first');
      return;
    }

    const confirmAction = window.confirm(`Are you sure you want to ${action} ${selectedItems.length} items?`);
    if (!confirmAction) return;

    try {
      await axios.post(`/api/admin/bulk-action`, {
        action,
        items: selectedItems,
        type: activeTab
      });

      toast.success(`Successfully ${action}ed ${selectedItems.length} items`);
      setSelectedItems([]);
      setBulkActionMode(false);
      fetchDashboardData();
    } catch (error) {
      toast.error(`Failed to ${action} items`);
    }
  };


  /**
   * Step 2: Create the test record in MongoDB
   * – disabled until questionPaperURL exists in fileUrls
   * – reuses your `loading` boolean to block double-submits
   * – navigates to /admin/tests after 2s on success
   */
  const handleCreateTest = useCallback(async e => {
    e.preventDefault();
    if (loading) return;

    if (!fileUrls.questionPaper) {
      return toast.error('🚫 You must upload the question paper first');
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const payload = {
        ...testForm,
        questionPaperURL: fileUrls.questionPaper,
        answerSheetURL: fileUrls.answerSheet,
        answerKeyURL: fileUrls.answerKey
      };

      await axios.post(
        '/api/admin/tests',
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setTestForm(initialFormState);
      setFiles({ questionPaper: null, answerSheet: null, answerKey: null });
      setFileUrls({ questionPaper: '', answerSheet: '', answerKey: '' });
      setIsUploaded(false);
      toast.success('🚀 Test created! Redirecting…');
      navigate(-1);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Creation failed');
    } finally {
      setLoading(false);
    }
  }, [
    loading,
    fileUrls.questionPaper,
    fileUrls.answerSheet,
    fileUrls.answerKey,
    testForm,
    navigate
  ]);

  const handleUploadFiles = useCallback(async () => {
    if (uploading) return;
    if (!files.questionPaper) {
      return toast.error('📄 Select the question paper PDF first');
    }

    setUploading(true);
    try {
      const token = localStorage.getItem('token');
      const fd = new FormData();
      fd.append('questionPaper', files.questionPaper);
      if (files.answerSheet) fd.append('answerSheet', files.answerSheet);
      if (files.answerKey) fd.append('answerKey', files.answerKey);

      // Call updated upload-temp API that returns MEGA URLs
      const { data } = await axios.post('/api/admin/tests/upload-temp', fd, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Store direct MEGA URLs in state
      setFileUrls({
        questionPaper: data.data.questionPaper?.url || '',
        answerSheet: data.data.answerSheet?.url || '',
        answerKey: data.data.answerKey?.url || ''
      });
      setIsUploaded(true);
      toast.success('✅ Files uploaded to Google Drive successfully!');
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Google Drive upload failed');
    } finally {
      setUploading(false);
    }
  }, [
    uploading,
    files.questionPaper,
    files.answerSheet,
    files.answerKey
  ]);




  // Filter and search data
  const filterData = (data, type) => {
    let filtered = [...data];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(item => {
        const searchFields = type === 'students'
          ? [item.name, item.email, item.rollNo]
          : type === 'tests'
            ? [item.title, item.subject]
            : [item.testTitle, item.studentId?.name];

        return searchFields.some(field =>
          field?.toLowerCase().includes(searchTerm.toLowerCase())
        );
      });
    }

    // Class filter
    if (filterClass) {
      filtered = filtered.filter(item => item.class === filterClass);
    }

    // Board filter
    if (filterBoard) {
      filtered = filtered.filter(item => item.board === filterBoard);
    }

    // Sort
    filtered.sort((a, b) => {
      const aValue = a[sortBy];
      const bValue = b[sortBy];

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  };

  // Pagination
  const paginateData = (data) => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return data.slice(startIndex, startIndex + itemsPerPage);
  };

  // Chart configurations
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Analytics Overview'
      }
    },
    scales: {
      y: {
        beginAtZero: true
      }
    }
  };

  // Render Dashboard Overview
  const renderDashboard = () => (
    <div className="dashboard-overview">
      <div className="dashboard-header">
        <h1>📊 Admin Dashboard</h1>
        <div className="dashboard-actions">
          <button className="btn btn-primary" onClick={() => setActiveTab('create-test')}>
            ➕ Create Test
          </button>
          <button className="btn btn-outline" onClick={fetchDashboardData}>
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="stats-grid">
        <div className="stat-card primary">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <h3>{dashboardStats.totalStudents}</h3>
            <p>Total Students</p>
          </div>
          <div className="stat-trend">+12% this month</div>
        </div>

        <div className="stat-card success">
          <div className="stat-icon">📝</div>
          <div className="stat-content">
            <h3>{dashboardStats.activeTests}</h3>
            <p>Active Tests</p>
          </div>
          <div className="stat-trend">+5 new this week</div>
        </div>

        <div className="stat-card warning">
          <div className="stat-icon">⏳</div>
          <div className="stat-content">
            <h3>{dashboardStats.pendingResults}</h3>
            <p>Pending Results</p>
          </div>
          <div className="stat-trend">Review required</div>
        </div>

        <div className="stat-card info">
          <div className="stat-icon">📈</div>
          <div className="stat-content">
            <h3>{dashboardStats.averageScore}%</h3>
            <p>Average Score</p>
          </div>
          <div className="stat-trend">+3% improvement</div>
        </div>

        <div className="stat-card secondary">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <h3>{dashboardStats.totalTests}</h3>
            <p>Total Tests</p>
          </div>
          <div className="stat-trend">All time</div>
        </div>

        <div className="stat-card danger">
          <div className="stat-icon">⚠️</div>
          <div className="stat-content">
            <h3>{dashboardStats.totalViolations}</h3>
            <p>Total Violations</p>
          </div>
          <div className="stat-trend">Security alerts</div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="charts-section">
        <div className="chart-container">
          <h3>📈 Test Submissions Over Time</h3>
          <div className="chart-wrapper">
            <Line
              data={{
                labels: chartData.testSubmissions.labels,
                datasets: [{
                  label: 'Submissions',
                  data: chartData.testSubmissions.data,
                  borderColor: 'rgb(99, 102, 241)',
                  backgroundColor: 'rgba(99, 102, 241, 0.1)',
                  fill: true,
                  tension: 0.4
                }]
              }}
              options={chartOptions}
            />
          </div>
        </div>

        <div className="chart-container">
          <h3>📊 Grade Distribution</h3>
          <div className="chart-wrapper">
            <Doughnut
              data={{
                labels: ['A+', 'A', 'B+', 'B', 'C', 'F'],
                datasets: [{
                  data: chartData.studentGrades.data,
                  backgroundColor: [
                    '#10b981', '#059669', '#0891b2', '#0284c7', '#ea580c', '#dc2626'
                  ],
                  borderWidth: 2
                }]
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'bottom'
                  }
                }
              }}
            />
          </div>
        </div>

        <div className="chart-container full-width">
          <h3>📚 Subject Performance</h3>
          <div className="chart-wrapper">
            <Bar
              data={{
                labels: chartData.subjectPerformance.labels,
                datasets: [{
                  label: 'Average Score',
                  data: chartData.subjectPerformance.data,
                  backgroundColor: 'rgba(139, 92, 246, 0.6)',
                  borderColor: 'rgb(139, 92, 246)',
                  borderWidth: 2
                }]
              }}
              options={chartOptions}
            />
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="recent-activity">
        <h3>🕒 Recent Activity</h3>
        <div className="activity-list">
          <div className="activity-item">
            <div className="activity-icon success">✅</div>
            <div className="activity-content">
              <p><strong>Mathematics Test</strong> completed by 25 students</p>
              <small>2 hours ago</small>
            </div>
          </div>
          <div className="activity-item">
            <div className="activity-icon info">📝</div>
            <div className="activity-content">
              <p><strong>Physics Test</strong> created and activated</p>
              <small>4 hours ago</small>
            </div>
          </div>
          <div className="activity-item">
            <div className="activity-icon warning">⚠️</div>
            <div className="activity-content">
              <p><strong>3 violations</strong> detected in Chemistry Test</p>
              <small>6 hours ago</small>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <h3>⚡ Quick Actions</h3>
        <div className="action-grid">
          <button className="action-btn" onClick={() => setActiveTab('create-test')}>
            <span className="action-icon">➕</span>
            <span>Create Test</span>
          </button>
          <button className="action-btn" onClick={() => setActiveTab('results')}>
            <span className="action-icon">📊</span>
            <span>Review Results</span>
          </button>
          <button className="action-btn" onClick={() => setActiveTab('students')}>
            <span className="action-icon">👥</span>
            <span>Manage Students</span>
          </button>
          <button className="action-btn" onClick={() => setActiveTab('analytics')}>
            <span className="action-icon">📈</span>
            <span>View Analytics</span>
          </button>
        </div>
      </div>
    </div>
  );

  // Render Test Creation Form
  const renderCreateTest = () => (
    <div className="create-test-modern">
      <div className="form-header">
        <h2>➕ Create New Test</h2>
        <p>Create comprehensive tests with question papers, answer sheets, and advanced proctoring</p>
      </div>

      <form onSubmit={handleCreateTest} className="modern-form">
        {/* Basic Information */}
        <div className="form-section">
          <h3>📝 Basic Information</h3>

          <div className="form-grid">
            <div className="form-group">
              <label>Test Title *</label>
              <input
                name="title"
                type="text"
                value={testForm.title}
                onChange={handleChange}
                placeholder="Enter test title"
                required
              />
            </div>

            <div className="form-group">
              <label>Subject *</label>
              <input
                type="text"
                value={testForm.subject}
                onChange={(e) => setTestForm({ ...testForm, subject: e.target.value })}
                placeholder="e.g., Mathematics"
                required
              />
            </div>

            <div className="form-group">
              <label>Class *</label>
              <select
                value={testForm.class}
                onChange={(e) => setTestForm({ ...testForm, class: e.target.value })}
                required
              >
                <option value="">Select Class</option>
                <option value="9">Class 9</option>
                <option value="10">Class 10</option>
                <option value="11">Class 11</option>
                <option value="12">Class 12</option>
              </select>
            </div>

            <div className="form-group">
              <label>Board *</label>
              <select
                value={testForm.board}
                onChange={(e) => setTestForm({ ...testForm, board: e.target.value })}
                required
              >
                <option value="">Select Board</option>
                <option value="CBSE">CBSE</option>
                <option value="ICSE">ICSE</option>
                <option value="ISC">ISC</option>
                <option value="WBCHSE">WBCHSE</option>
                <option value="State Board">State Board</option>
              </select>
            </div>
          </div>

          <div className="form-group full-width">
            <label>Description *</label>
            <textarea
              value={testForm.description}
              onChange={(e) => setTestForm({ ...testForm, description: e.target.value })}
              placeholder="Enter detailed test description"
              rows="3"
              required
            />
          </div>
        </div>

        {/* Test Configuration */}
        <div className="form-section">
          <h3>⚙️ Test Configuration</h3>

          <div className="form-grid">
            <div className="form-group">
              <label>Duration (minutes) *</label>
              <input
                type="number"
                value={testForm.duration}
                onChange={(e) => setTestForm({ ...testForm, duration: parseInt(e.target.value) })}
                min="5"
                max="300"
                required
              />
            </div>

            <div className="form-group">
              <label>Total Questions *</label>
              <input
                type="number"
                value={testForm.questionsCount}
                onChange={(e) => setTestForm({ ...testForm, questionsCount: parseInt(e.target.value) })}
                min="1"
                max="200"
                required
              />
            </div>

            <div className="form-group">
              <label>Total Marks *</label>
              <input
                type="number"
                value={testForm.totalMarks}
                onChange={(e) => setTestForm({ ...testForm, totalMarks: parseInt(e.target.value) })}
                min="1"
                required
              />
            </div>

            <div className="form-group">
              <label>Passing Marks *</label>
              <input
                type="number"
                value={testForm.passingMarks}
                onChange={(e) => setTestForm({ ...testForm, passingMarks: parseInt(e.target.value) })}
                min="1"
                max={testForm.totalMarks}
                required
              />
            </div>

            <div className="form-group">
              <label>Start Date & Time *</label>
              <input
                type="datetime-local"
                value={testForm.startDate}
                onChange={(e) => setTestForm({ ...testForm, startDate: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label>End Date & Time *</label>
              <input
                type="datetime-local"
                value={testForm.endDate}
                onChange={(e) => setTestForm({ ...testForm, endDate: e.target.value })}
                required
              />
            </div>
          </div>
        </div>

        {/* File Uploads */}
        <div className="form-section">
          <h3>📁 File Uploads</h3>

          <div className="upload-grid">
            {/* Question Paper */}
            <div className="upload-group required">
              <label className="upload-label">
                📄 Question Paper (PDF) *
                <span className="required-badge">COMPULSORY</span>
              </label>
              <div
                className="upload-area"
                onClick={() => fileInputRef.current?.click()}
              >
                {files.questionPaper ? (
                  <div className="file-selected">
                    <span className="file-icon">📄</span>
                    <div className="file-info">
                      <p>{files.questionPaper.name}</p>
                      <small>{(files.questionPaper.size / 1024 / 1024).toFixed(2)} MB</small>
                    </div>
                    <button type="button" className="remove-file" onClick={(e) => {
                      e.stopPropagation();
                      setFiles({ ...files, questionPaper: null });
                    }}>✕</button>
                  </div>
                ) : (
                  <div className="upload-placeholder">
                    <span className="upload-icon">⬆️</span>
                    <p>Click to upload question paper</p>
                    <small>PDF only, max 10MB</small>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                name="questionPaper"
                type="file"
                accept=".pdf"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
              {uploadProgress.questionPaper > 0 && (
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${uploadProgress.questionPaper}%` }}></div>
                  <span>{uploadProgress.questionPaper}%</span>
                </div>
              )}
            </div>

            {/* Answer Sheet */}
            <div className="upload-group optional">
              <label className="upload-label">
                📋 Sample Answer Sheet (PDF) *
                <span className="optional-badge">OPTIONAL</span>
              </label>
              <div className="upload-area">
                {files.answerSheet ? (
                  <div className="file-selected">
                    <span className="file-icon">📋</span>
                    <div className="file-info">
                      <p>{files.answerSheet.name}</p>
                      <small>{(files.answerSheet.size / 1024 / 1024).toFixed(2)} MB</small>
                    </div>
                    <button type="button" className="remove-file" onClick={() =>
                      setFiles({ ...files, answerSheet: null })
                    }>✕</button>
                  </div>
                ) : (
                  <div className="upload-placeholder">
                    <span className="upload-icon">⬆️</span>
                    <p>Upload sample answer sheet</p>
                    <small>PDF only, max 10MB</small>
                  </div>
                )}
              </div>
              <input
                name="answerSheet"
                type="file"
                accept=".pdf"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
            </div>

            {/* Answer Key */}
            <div className="upload-group optional">
              <label className="upload-label">
                🔑 Answer Key (PDF)
                <span className="optional-badge">OPTIONAL</span>
              </label>
              <div className="upload-area">
                {files.answerKey ? (
                  <div className="file-selected">
                    <span className="file-icon">🔑</span>
                    <div className="file-info">
                      <p>{files.answerKey.name}</p>
                      <small>{(files.answerKey.size / 1024 / 1024).toFixed(2)} MB</small>
                    </div>
                    <button type="button" className="remove-file" onClick={() =>
                      setFiles({ ...files, answerKey: null })
                    }>✕</button>
                  </div>
                ) : (
                  <div className="upload-placeholder">
                    <span className="upload-icon">⬆️</span>
                    <p>Upload answer key (optional)</p>
                    <small>PDF only, max 10MB</small>
                  </div>
                )}
              </div>
              <input
                name="answerKey"
                type="file"
                accept=".pdf"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />

              <div className="checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={testForm.answerKeyVisible}
                    onChange={(e) => setTestForm({ ...testForm, answerKeyVisible: e.target.checked })}
                  />
                  Show answer key to students after test completion
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Proctoring Settings */}
        <div className="form-section">
          <h3>🔒 Advanced Proctoring Settings</h3>

          <div className="proctoring-grid">
            <div className="proctoring-option">
              <label>
                <input
                  type="checkbox"
                  checked={testForm.proctoringSettings.strictMode}
                  onChange={(e) => setTestForm({
                    ...testForm,
                    proctoringSettings: { ...testForm.proctoringSettings, strictMode: e.target.checked }
                  })}
                />
                <span className="option-content">
                  <strong>Strict Proctoring Mode</strong>
                  <small>Enhanced monitoring with zero tolerance</small>
                </span>
              </label>
            </div>

            <div className="proctoring-option">
              <label>
                <input
                  type="checkbox"
                  checked={testForm.proctoringSettings.requireFullscreen}
                  onChange={(e) => setTestForm({
                    ...testForm,
                    proctoringSettings: { ...testForm.proctoringSettings, requireFullscreen: e.target.checked }
                  })}
                />
                <span className="option-content">
                  <strong>Require Fullscreen</strong>
                  <small>Force fullscreen mode throughout test</small>
                </span>
              </label>
            </div>

            <div className="proctoring-option">
              <label>
                <input
                  type="checkbox"
                  checked={testForm.proctoringSettings.blockRightClick}
                  onChange={(e) => setTestForm({
                    ...testForm,
                    proctoringSettings: { ...testForm.proctoringSettings, blockRightClick: e.target.checked }
                  })}
                />
                <span className="option-content">
                  <strong>Block Right Click</strong>
                  <small>Disable context menu and right-click</small>
                </span>
              </label>
            </div>

            <div className="proctoring-option">
              <label>
                <input
                  type="checkbox"
                  checked={testForm.proctoringSettings.blockKeyboardShortcuts}
                  onChange={(e) => setTestForm({
                    ...testForm,
                    proctoringSettings: { ...testForm.proctoringSettings, blockKeyboardShortcuts: e.target.checked }
                  })}
                />
                <span className="option-content">
                  <strong>Block Keyboard Shortcuts</strong>
                  <small>Disable Ctrl+C, Ctrl+V, F12, etc.</small>
                </span>
              </label>
            </div>

            <div className="proctoring-option">
              <label>
                <input
                  type="checkbox"
                  checked={testForm.resumeEnabled}
                  onChange={(e) => setTestForm({ ...testForm, resumeEnabled: e.target.checked })}
                />
                <span className="option-content">
                  <strong>Enable Test Resume</strong>
                  <small>Allow students to resume if interrupted</small>
                </span>
              </label>
            </div>

            <div className="form-group">
              <label>Allowed Tab Switches</label>
              <select
                value={testForm.proctoringSettings.allowTabSwitch}
                onChange={(e) => setTestForm({
                  ...testForm,
                  proctoringSettings: { ...testForm.proctoringSettings, allowTabSwitch: parseInt(e.target.value) }
                })}
              >
                <option value={0}>No tab switches allowed</option>
                <option value={1}>1 tab switch allowed</option>
                <option value={2}>2 tab switches allowed</option>
                <option value={3}>3 tab switches allowed</option>
              </select>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="form-actions">
          <button
            onClick={handleUploadFiles}
            disabled={uploading || isUploaded || (!files.questionPaper && !files.answerSheet && !files.answerKey)}
          >
            {uploading ? 'Uploading...' : '📁 Upload Files'}
          </button>

          <button
            type="submit"
            onClick={handleCreateTest}
            disabled={!isUploaded || loading}
          >
            {loading ? 'Creating...' : '🚀 Create Test'}
          </button>
        </div>

      </form>
    </div>
  );

  // Render Tests Management
  const renderTests = () => {
    const filteredTests = filterData(tests, 'tests');
    const paginatedTests = paginateData(filteredTests);

    return (
      <div className="tests-management">
        <div className="section-header">
          <h2>📝 Test Management</h2>
          <div className="header-actions">
            {/* 1) Button to create the Test record */}
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleCreateTest}
              disabled={uploading}
            >
              🚀 Create Test
            </button>

            {/* 2) Button to upload all selected PDFs */}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleUploadFiles}
              disabled={uploading || !files.questionPaper && !files.answerSheet && !files.answerKey}
              style={{ marginLeft: '1rem' }}
            >
              {uploading
                ? `Uploading… ${uploadProgress.total || 0}%`
                : '📁 Upload All Files'}
            </button>

            <button
              className={`btn ${bulkActionMode ? 'btn-danger' : 'btn-outline'}`}
              onClick={() => setBulkActionMode(!bulkActionMode)}
            >
              {bulkActionMode ? '✕ Cancel' : '☑️ Bulk Actions'}
            </button>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="filters-section">
          <div className="search-box">
            <input
              type="text"
              placeholder="🔍 Search tests..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <select
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
            >
              <option value="">All Classes</option>
              <option value="9">Class 9</option>
              <option value="10">Class 10</option>
              <option value="11">Class 11</option>
              <option value="12">Class 12</option>
            </select>

            <select
              value={filterBoard}
              onChange={(e) => setFilterBoard(e.target.value)}
            >
              <option value="">All Boards</option>
              <option value="CBSE">CBSE</option>
              <option value="ICSE">ICSE</option>
              <option value="ISC">ISC</option>
              <option value="WBCHSE">WBCHSE</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="createdAt">Sort by Date</option>
              <option value="title">Sort by Title</option>
              <option value="subject">Sort by Subject</option>
            </select>

            <button
              className="btn btn-outline"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            >
              {sortOrder === 'asc' ? '⬆️' : '⬇️'}
            </button>
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {bulkActionMode && (
          <div className="bulk-actions-bar">
            <span>{selectedItems.length} items selected</span>
            <div className="bulk-buttons">
              <button
                className="btn btn-sm btn-success"
                onClick={() => handleBulkAction('activate')}
                disabled={selectedItems.length === 0}
              >
                ✅ Activate
              </button>
              <button
                className="btn btn-sm btn-warning"
                onClick={() => handleBulkAction('deactivate')}
                disabled={selectedItems.length === 0}
              >
                ⏸️ Deactivate
              </button>
              <button
                className="btn btn-sm btn-danger"
                onClick={() => handleBulkAction('delete')}
                disabled={selectedItems.length === 0}
              >
                🗑️ Delete
              </button>
            </div>
          </div>
        )}

        {/* Tests Table */}
        <div className="data-table">
          <table>
            <thead>
              <tr>
                {bulkActionMode && (
                  <th>
                    <input
                      type="checkbox"
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedItems(paginatedTests.map(test => test._id));
                        } else {
                          setSelectedItems([]);
                        }
                      }}
                      checked={selectedItems.length === paginatedTests.length && paginatedTests.length > 0}
                    />
                  </th>
                )}
                <th>Test Details</th>
                <th>Configuration</th>
                <th>Schedule</th>
                <th>Status</th>
                <th>Files</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedTests.map(test => (
                <tr key={test._id}>
                  {bulkActionMode && (
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedItems.includes(test._id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedItems([...selectedItems, test._id]);
                          } else {
                            setSelectedItems(selectedItems.filter(id => id !== test._id));
                          }
                        }}
                      />
                    </td>
                  )}
                  <td>
                    <div className="test-details">
                      <h4>{test.title}</h4>
                      <p>{test.subject}</p>
                      <small>Class {test.class} - {test.board}</small>
                    </div>
                  </td>
                  <td>
                    <div className="test-config">
                      <span className="config-item">⏱️ {test.duration}m</span>
                      <span className="config-item">📊 {test.totalMarks} marks</span>
                      <span className="config-item">❓ {test.questionsCount} questions</span>
                    </div>
                  </td>
                  <td>
                    <div className="test-schedule">
                      <small>Start: {test.startDate ? new Date(test.startDate).toLocaleString('en-IN') : 'N/A'}</small>
                      <small>End: {test.endDate ? new Date(test.endDate).toLocaleString('en-IN') : 'N/A'}</small>
                    </div>
                  </td>
                  <td>
                    <span className={`status-badge ${test.active ? 'active' : 'inactive'}`}>
                      {test.active ? '🟢 Active' : '🔴 Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="file-status">
                      <span className={`file-indicator ${test.questionPaperURL ? 'uploaded' : 'missing'}`}>
                        📄 {test.questionPaperURL ? '✅' : '❌'}
                      </span>
                      <span className={`file-indicator ${test.answerSheetURL ? 'uploaded' : 'missing'}`}>
                        📋 {test.answerSheetURL ? '✅' : '❌'}
                      </span>
                      {test.answerKeyURL && (
                        <span className="file-indicator uploaded">🔑 ✅</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button className="btn btn-sm btn-outline" title="Edit" onClick={() => navigate(`/admin/tests/edit/${test._id}`)}>
                        ✏️
                      </button>
                      <button className="btn btn-sm btn-info" title="View Results" onClick={() => handleViewResults(test)}>
                        📊
                      </button>
                      <button className="btn btn-sm btn-warning" title="Duplicate" onClick={() => handleDuplicateTest(test)}>
                        📋
                      </button>
                      <button className="btn btn-sm btn-danger" title="Delete" onClick={() => handleDeleteTest(test._id)}>
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="pagination">
          <button
            className="btn btn-outline"
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
          >
            ⬅️ Previous
          </button>

          <span className="page-info">
            Page {currentPage} of {Math.ceil(filteredTests.length / itemsPerPage)}
          </span>

          <button
            className="btn btn-outline"
            onClick={() => setCurrentPage(Math.min(Math.ceil(filteredTests.length / itemsPerPage), currentPage + 1))}
            disabled={currentPage >= Math.ceil(filteredTests.length / itemsPerPage)}
          >
            Next ➡️
          </button>
        </div>
      </div>
    );
  };

  // Render Students Management (similar structure to tests)
  const renderStudents = () => {
    const filteredStudents = filterData(students, 'students');
    const paginatedStudents = paginateData(filteredStudents);

    return (
      <div className="students-management">
        <div className="section-header">
          <h2>👥 Student Management</h2>
          <div className="header-actions">
            <button className="btn btn-primary">
              📤 Export Students
            </button>
            <button
              className={`btn ${bulkActionMode ? 'btn-danger' : 'btn-outline'}`}
              onClick={() => setBulkActionMode(!bulkActionMode)}
            >
              {bulkActionMode ? '✕ Cancel' : '☑️ Bulk Actions'}
            </button>
          </div>
        </div>

        {/* Similar filters and table structure as tests */}
        <div className="filters-section">
          <div className="search-box">
            <input
              type="text"
              placeholder="🔍 Search students..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <select
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
            >
              <option value="">All Classes</option>
              <option value="9">Class 9</option>
              <option value="10">Class 10</option>
              <option value="11">Class 11</option>
              <option value="12">Class 12</option>
            </select>

            <select
              value={filterBoard}
              onChange={(e) => setFilterBoard(e.target.value)}
            >
              <option value="">All Boards</option>
              <option value="CBSE">CBSE</option>
              <option value="ICSE">ICSE</option>
              <option value="ISC">ISC</option>
              <option value="WBCHSE">WBCHSE</option>
            </select>
          </div>
        </div>

        {/* Students Table */}
        <div className="data-table">
          <table>
            <thead>
              <tr>
                {bulkActionMode && <th>☑️</th>}
                <th>Student Info</th>
                <th>Academic Details</th>
                <th>Registration</th>
                <th>Status</th>
                <th>Performance</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedStudents.map(student => (
                <tr key={student._id}>
                  {bulkActionMode && (
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedItems.includes(student._id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedItems([...selectedItems, student._id]);
                          } else {
                            setSelectedItems(selectedItems.filter(id => id !== student._id));
                          }
                        }}
                      />
                    </td>
                  )}
                  <td>
                    <div className="student-info">
                      <div className="student-avatar">
                        {student.name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div className="student-details">
                        <h4>{student.name}</h4>
                        <p>{student.email}</p>
                        <small>Roll: {student.rollNo || 'Not assigned'}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="academic-details">
                      <span className="class-badge">{student.class}</span>
                      <span className="board-badge">{student.board}</span>
                    </div>
                  </td>
                  <td>
                    <small>{new Date(student.createdAt).toLocaleDateString()}</small>
                  </td>
                  <td>
                    <span className={`status-badge ${student.approved ? 'approved' : 'pending'}`}>
                      {student.approved ? '✅ Approved' : '⏳ Pending'}
                    </span>
                  </td>
                  <td>
                    <div className="performance-summary">
                      <span className="test-count">📝 {student.testsTaken || 0}</span>
                      <span className="avg-score">📊 {student.averageScore || 0}%</span>
                    </div>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className={`btn btn-sm ${student.approved ? 'btn-warning' : 'btn-success'}`}
                        onClick={() => handleApproveStudent(student._id, !student.approved)}
                      >
                        {student.approved ? '🚫 Block' : '✅ Approve'}
                      </button>
                      <button className="btn btn-sm btn-info" title="View Details" onClick={() => navigate(`/admin/students/${student._id}`)}>
                        👁️
                      </button>
                      <button className="btn btn-sm btn-outline" title="Edit" onClick={() => navigate(`/admin/students/edit/${student._id}`)}>
                        ✏️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Render Results Management with Answer Sheet Review
  const renderResultsTable = () => (
    <table className="data-table">
      <thead>
        <tr>
          <th>Student</th>
          <th>Test</th>
          <th>Score</th>
          <th>Violations</th>
          <th>Answer Sheet</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {results.map(r => (
          <tr key={r._id}>
            <td>{r.studentId?.name}</td>
            <td>{r.testTitle}</td>
            <td>
              {r.marksObtained != null
                ? `${r.marksObtained}/${r.totalMarks}`
                : 'Pending'}
            </td>
            <td>
              {r.violations?.length > 0
                ? r.violations.length
                : 'None'}
            </td>
            <td>
              {r.answerSheetUrl ? (
                <button
                  className="btn btn-sm btn-outline"
                  onClick={() =>
                    window.open(r.answerSheetUrl, '_blank')
                  }
                >
                  📄 View Sheet
                </button>
              ) : (
                '—'
              )}
            </td>
            <td>
              <button
                className="btn btn-sm btn-success"
                onClick={() =>
                  navigate('/admin/answer-review', { state: { fromResult: r } })
                }
              >
                📝 Mark
              </button>
              <button
                className="btn btn-sm btn-info"
                onClick={() => navigate(`/result/${r._id}`)}
              >
                👁️ Details
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  // Render Analytics Dashboard
  const renderAnalytics = () => (
    <div className="analytics-dashboard">
      <div className="section-header">
        <h2>📈 Advanced Analytics</h2>
        <div className="date-range-selector">
          <select>
            <option>Last 7 days</option>
            <option>Last 30 days</option>
            <option>Last 3 months</option>
            <option>Custom range</option>
          </select>
        </div>
      </div>

      {/* Analytics content would go here */}
      <div className="analytics-content">
        <div className="chart-grid">
          <div className="chart-card">
            <h3>Test Performance Trends</h3>
            {/* Chart component */}
          </div>
          <div className="chart-card">
            <h3>Student Engagement</h3>
            {/* Chart component */}
          </div>
        </div>
      </div>
    </div>
  );

  // Handle approval
  const handleApproveStudent = async (studentId, approved) => {
    try {
      await axios.patch(`/api/admin/students/${studentId}/approval`, { approved });
      toast.success(`Student ${approved ? 'approved' : 'blocked'} successfully`);
      fetchDashboardData();
    } catch (error) {
      toast.error('Failed to update student status');
    }
  };

  return (
    <div className={`admin-dashboard ${darkMode ? 'dark' : 'light'} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="sidebar-header">
          <div className="logo">
            <span className="logo-icon">🎓</span>
            <span className="logo-text">ExamPortal</span>
          </div>
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            {sidebarCollapsed ? '→' : '←'}
          </button>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section">
            <span className="nav-section-title">Main</span>
            <button
              className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              <span className="nav-icon">📊</span>
              <span className="nav-text">Dashboard</span>
            </button>
            <button
              className={`nav-item ${activeTab === 'analytics' ? 'active' : ''}`}
              onClick={() => navigate('/admin/analytics')}
            >
              <span className="nav-icon">📈</span>
              <span className="nav-text">Analytics</span>
            </button>
          </div>

          <div className="nav-section">
            <span className="nav-section-title">Management</span>
            <button
              className={`nav-item ${activeTab === 'create-test' ? 'active' : ''}`}
              onClick={() => setActiveTab('create-test')}
            >
              <span className="nav-icon">➕</span>
              <span className="nav-text">Create Test</span>
            </button>
            <button
              className={`nav-item ${activeTab === 'tests' ? 'active' : ''}`}
              onClick={() => setActiveTab('tests')}
            >
              <span className="nav-icon">📝</span>
              <span className="nav-text">Tests</span>
            </button>
            <button
              className={`nav-item ${activeTab === 'students' ? 'active' : ''}`}
              onClick={() => setActiveTab('students')}
            >
              <span className="nav-icon">👥</span>
              <span className="nav-text">Students</span>
            </button>
            <button
              className={`nav-item ${activeTab === 'results' ? 'active' : ''}`}
              onClick={() => setActiveTab('results')}
            >
              <span className="nav-icon">📊</span>
              <span className="nav-text">Results</span>
            </button>
          </div>

          <div className="nav-section">
            <span className="nav-section-title">System</span>
            <button className="nav-item">
              <span className="nav-icon">⚙️</span>
              <span className="nav-text">Settings</span>
            </button>
            <button className="nav-item">
              <span className="nav-icon">📧</span>
              <span className="nav-text">Notifications</span>
            </button>
          </div>
        </nav>

        <div className="sidebar-footer">
          <div className="user-profile">
            <div className="user-avatar">
              {user?.name?.charAt(0)?.toUpperCase() || 'A'}
            </div>
            <div className="user-info">
              <span className="user-name">{user?.name || 'Admin'}</span>
              <span className="user-role">Administrator</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="admin-main">
        {/* Top Bar */}
        <header className="admin-header">
          <div className="header-left">
            <button
              className="mobile-menu-toggle"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            >
              ☰
            </button>
            <h1 className="page-title">
              {activeTab === 'dashboard' && '📊 Dashboard'}
              {activeTab === 'create-test' && '➕ Create Test'}
              {activeTab === 'tests' && '📝 Test Management'}
              {activeTab === 'students' && '👥 Student Management'}
              {activeTab === 'results' && '📊 Results Management'}
              {activeTab === 'analytics' && '📈 Analytics'}
            </h1>
          </div>

          <div className="header-right">
            <button className="header-btn notification-btn">
              🔔
              <span className="notification-badge">3</span>
            </button>

            <button
              className="header-btn theme-toggle"
              onClick={() => setDarkMode(!darkMode)}
              title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {darkMode ? '☀️' : '🌙'}
            </button>

            <div className="user-menu">
              <button className="user-menu-trigger">
                <div className="user-avatar-small">
                  {user?.name?.charAt(0)?.toUpperCase() || 'A'}
                </div>
                <span className="user-name-small">{user?.name || 'Admin'}</span>
                <span className="dropdown-arrow">▼</span>
              </button>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="admin-content">
          {loading && (
            <div className="loading-overlay">
              <div className="loading-spinner"></div>
              <p>Loading...</p>
            </div>
          )}

          {activeTab === 'dashboard' && renderDashboard()}
          {activeTab === 'create-test' && renderCreateTest()}
          {activeTab === 'tests' && renderTests()}
          {activeTab === 'students' && renderStudents()}
          {activeTab === 'results' && renderResultsTable()}
          {activeTab === 'analytics' && renderAnalytics()}
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
