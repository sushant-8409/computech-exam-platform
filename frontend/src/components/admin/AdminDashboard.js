import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../App';
import axios from 'axios';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
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
import NotificationCenter from './NotificationCenter';
import NotificationSettings from './NotificationSettings';
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
// place near the top of AdminDashboard.jsx (above the component)
const SUBJECT_OPTIONS = [
  'Computer Science',
  'Computer Application',
  'Mathematics',
  'Physics',
  'English Literature',
  'English Language',
  'Biology',
  'History',
  'Geography',
  'Economic Applications',
  'Chemistry'
];

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
  const answerKeyInputRef = useRef(null);
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
  // Add these state variables with your existing ones
  const [gradeDistribution, setGradeDistribution] = useState([]);
  const [subjectPerformance, setSubjectPerformance] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [dashboardLoading, setDashboardLoading] = useState(false);
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

  // Add these state variables with your existing ones
  const [analyticsData, setAnalyticsData] = useState({
    overall: {
      totalStudents: 0,
      averageScore: 0,
      passRate: 0
    },
    subjectPerformance: []
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);

  // Add this function to fetch analytics data
  const fetchAnalyticsData = async () => {
    try {
      console.log('📊 Fetching analytics data...');
      const response = await axios.get('/api/admin/analytics');
      setAnalyticsData(response.data);
      console.log('✅ Analytics data loaded:', response.data);
    } catch (error) {
      console.error('❌ Failed to fetch analytics:', error);
      toast.error('Failed to load analytics data');
    }
  };

  // Add student search function
  const handleStudentSearch = async (query) => {
    if (!query.trim()) {
      setSearchResult(null);
      return;
    }

    setSearchLoading(true);
    try {
      const response = await axios.get(`/api/students/search?query=${encodeURIComponent(query)}`);
      setSearchResult(response.data);
    } catch (error) {
      console.error('❌ Student search failed:', error);
      toast.error('Student search failed');
    } finally {
      setSearchLoading(false);
    }
  };

  const [files, setFiles] = useState({ questionPaper: null, answerKey: null });
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [uploading, setUploading] = useState(false);
  // In AdminDashboard component
  const [fileUrls, setFileUrls] = useState({
    questionPaper: { key: '', previewUrl: '' },
    answerKey: { key: '', previewUrl: '' }
  });
  // Fetch grade distribution data
  const fetchGradeDistribution = async () => {
    try {
      const response = await axios.get('/api/admin/analytics/grade-distribution');
      setGradeDistribution(response.data);
    } catch (error) {
      console.error('❌ Failed to fetch grade distribution:', error);
      // Fallback data
      setGradeDistribution([
        { grade: 'A+', count: 0, percentage: 0 },
        { grade: 'A', count: 0, percentage: 0 },
        { grade: 'B+', count: 0, percentage: 0 },
        { grade: 'B', count: 0, percentage: 0 },
        { grade: 'C', count: 0, percentage: 0 },
        { grade: 'F', count: 0, percentage: 0 }
      ]);
    }
  };

  // Fetch subject performance data
  const fetchSubjectPerformance = async () => {
    try {
      const response = await axios.get('/api/admin/analytics/subject-performance');
      console.log('Subject performance response:', response.data); // Debug log

      // Ensure we always set an array
      const data = response.data;
      if (Array.isArray(data)) {
        setSubjectPerformance(data);
      } else if (data && Array.isArray(data.subjects)) {
        // If data is wrapped in an object
        setSubjectPerformance(data.subjects);
      } else {
        console.warn('Subject performance data is not an array:', data);
        setSubjectPerformance([]);
      }
    } catch (error) {
      console.error('❌ Failed to fetch subject performance:', error);
      setSubjectPerformance([]); // Always set to empty array on error
    }
  };


  // Fetch recent activity data
  const fetchRecentActivity = async () => {
    try {
      const response = await axios.get('/api/admin/recent-activity');
      setRecentActivity(response.data);
    } catch (error) {
      console.error('❌ Failed to fetch recent activity:', error);
      setRecentActivity([]);
    }
  };

  // Combined dashboard data fetch

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

    const result = await Swal.fire({
      title: 'Are you sure?',
      text: 'Delete this test permanently?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'Cancel'
    });
    if (!result.isConfirmed) return;
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
    fetchAnalyticsData();
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
    setDashboardLoading(true);

    try {
      const [
        statsRes,
        testsRes,
        studentsRes,
        resultsRes,
        gradeDistRes,
        subjectPerfRes,
        recentActivityRes,
        analyticsRes
      ] = await Promise.all([
        axios.get('/api/admin/dashboard/stats'),
        axios.get('/api/admin/tests'),
        axios.get('/api/admin/students'),
        axios.get('/api/admin/results'),
        axios.get('/api/admin/analytics/grade-distribution').catch(err => {
          console.warn('Grade distribution API not available:', err.message);
          return { data: [] };
        }),
        axios.get('/api/admin/analytics/subject-performance').catch(err => {
          console.warn('Subject performance API not available:', err.message);
          return { data: [] };
        }),
        axios.get('/api/admin/recent-activity').catch(err => {
          console.warn('Recent activity API not available:', err.message);
          return { data: [] };
        }),
        axios.get('/api/admin/analytics').catch(err => {
          console.warn('Analytics API not available:', err.message);
          return {
            data: {
              overall: { totalStudents: 0, averageScore: 0, passRate: 0 },
              subjectPerformance: []
            }
          };
        })
      ]);

      // Set main dashboard data
      setDashboardStats(statsRes.data.stats || {});
      setTests(testsRes.data.tests || []);
      setStudents(studentsRes.data.students || []);
      setResults(resultsRes.data.results || []);

      // Safely set analytics data with array checks
      setGradeDistribution(Array.isArray(gradeDistRes.data) ? gradeDistRes.data : []);
      setSubjectPerformance(Array.isArray(subjectPerfRes.data) ? subjectPerfRes.data : []);
      setRecentActivity(Array.isArray(recentActivityRes.data) ? recentActivityRes.data : []);

      setAnalyticsData(analyticsRes.data || {
        overall: { totalStudents: 0, averageScore: 0, passRate: 0 },
        subjectPerformance: []
      });

      console.log('✅ Dashboard data loaded successfully');

    } catch (error) {
      console.error('❌ Error fetching dashboard data:', error);

      // Set safe fallback data
      setDashboardStats({});
      setTests([]);
      setStudents([]);
      setResults([]);
      setGradeDistribution([]);
      setSubjectPerformance([]); // Ensure this is always an array
      setRecentActivity([]);
      setAnalyticsData({
        overall: { totalStudents: 0, averageScore: 0, passRate: 0 },
        subjectPerformance: []
      });

    } finally {
      setLoading(false);
      setDashboardLoading(false);
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

    const result = await Swal.fire({
      title: 'Are you sure?',
      text: `Are you sure you want to ${action} ${selectedItems.length} items?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#aaa',
      confirmButtonText: `Yes, ${action}`,
      cancelButtonText: 'Cancel'
    });
    if (!result.isConfirmed) return;


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
        answerKeyURL: fileUrls.answerKey
      };

      await axios.post(
        '/api/admin/tests',
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setTestForm(initialFormState);
      setFiles({ questionPaper: null, answerKey: null });
      setFileUrls({ questionPaper: '', answerKey: '' });
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
      if (files.answerKey) fd.append('answerKey', files.answerKey);

      // Call updated upload-temp API that returns MEGA URLs
      const { data } = await axios.post('/api/admin/tests/upload-temp', fd, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Store direct MEGA URLs in state
      setFileUrls({
        questionPaper: data.data.questionPaper?.url || '',
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
  // Grade Distribution Component
  const renderGradeDistribution = () => (
    <div className="dashboard-card">
      <div className="card-header">
        <h3>📊 Grade Distribution</h3>
        <button className="btn btn-sm btn-outline" onClick={fetchGradeDistribution}>
          🔄
        </button>
      </div>
      <div className="chart-container">
        {dashboardLoading ? (
          <div className="loading-spinner">Loading...</div>
        ) : (
          <Bar
            data={{
              labels: gradeDistribution.map(item => item.grade),
              datasets: [{
                label: 'Number of Students',
                data: gradeDistribution.map(item => item.count),
                backgroundColor: [
                  '#10b981', // A+ - Emerald
                  '#3b82f6', // A - Blue
                  '#8b5cf6', // B+ - Violet
                  '#f59e0b', // B - Amber
                  '#ef4444', // C - Red
                  '#6b7280'  // F - Gray
                ],
                borderColor: [
                  '#059669',
                  '#2563eb',
                  '#7c3aed',
                  '#d97706',
                  '#dc2626',
                  '#4b5563'
                ],
                borderWidth: 2
              }]
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  display: false
                },
                title: {
                  display: true,
                  text: 'Student Grade Distribution'
                }
              },
              scales: {
                y: {
                  beginAtZero: true,
                  ticks: {
                    stepSize: 1
                  }
                }
              }
            }}
          />
        )}
      </div>
      <div className="grade-stats">
        {gradeDistribution.map((grade, index) => (
          <div key={index} className="grade-stat-item">
            <span className={`grade-badge grade-${grade.grade.toLowerCase().replace('+', 'plus')}`}>
              {grade.grade}
            </span>
            <span className="grade-count">{grade.count} students</span>
            <span className="grade-percentage">({grade.percentage}%)</span>
          </div>
        ))}
      </div>
    </div>
  );

  // Subject Performance Component
  const renderSubjectPerformance = () => (
    <div className="dashboard-card">
      <div className="card-header">
        <h3>📚 Subject Performance</h3>
        <button className="btn btn-sm btn-outline" onClick={fetchSubjectPerformance}>
          🔄
        </button>
      </div>
      <div className="chart-container">
        {dashboardLoading ? (
          <div className="loading-spinner">Loading...</div>
        ) : (
          <Line
            data={{
              labels: subjectPerformance.map(item => item.subject),
              datasets: [{
                label: 'Average Score (%)',
                data: subjectPerformance.map(item => item.averageScore),
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4
              }]
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  display: false
                },
                title: {
                  display: true,
                  text: 'Average Performance by Subject'
                }
              },
              scales: {
                y: {
                  beginAtZero: true,
                  max: 100,
                  ticks: {
                    callback: function (value) {
                      return value + '%';
                    }
                  }
                }
              }
            }}
          />
        )}
      </div>
      <div className="subject-details">
        {subjectPerformance.map((subject, index) => (
          <div key={index} className="subject-item">
            <div className="subject-info">
              <span className="subject-name">{subject.subject}</span>
              <span className="test-count">{subject.totalTests} tests</span>
            </div>
            <div className="subject-stats">
              <span className={`performance-score ${subject.averageScore >= 80 ? 'excellent' :
                subject.averageScore >= 60 ? 'good' : 'needs-improvement'
                }`}>
                {subject.averageScore}%
              </span>
              <span className="participation-rate">
                {subject.participationRate}% participation
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // Recent Activity Component
  const renderRecentActivity = () => (
    <div className="dashboard-card">
      <div className="card-header">
        <h3>🕒 Recent Activity</h3>
        <button className="btn btn-sm btn-outline" onClick={fetchRecentActivity}>
          🔄
        </button>
      </div>
      <div className="activity-list">
        {dashboardLoading ? (
          <div className="loading-spinner">Loading...</div>
        ) : recentActivity.length > 0 ? (
          recentActivity.map((activity, index) => (
            <div key={index} className="activity-item">
              <div className="activity-icon">
                {activity.type === 'test_submitted' ? '📝' :
                  activity.type === 'student_registered' ? '👤' :
                    activity.type === 'test_created' ? '➕' :
                      activity.type === 'result_published' ? '📊' : '🔔'}
              </div>
              <div className="activity-content">
                <div className="activity-message">
                  {activity.type === 'test_submitted' && (
                    <>
                      <strong>{activity.studentName}</strong> submitted test
                      <strong> {activity.testTitle}</strong>
                    </>
                  )}
                  {activity.type === 'student_registered' && (
                    <>
                      New student <strong>{activity.studentName}</strong> registered
                    </>
                  )}
                  {activity.type === 'test_created' && (
                    <>
                      New test <strong>{activity.testTitle}</strong> created
                    </>
                  )}
                  {activity.type === 'result_published' && (
                    <>
                      Results published for <strong>{activity.testTitle}</strong>
                    </>
                  )}
                </div>
                <div className="activity-time">
                  {new Date(activity.timestamp).toLocaleString()}
                </div>
              </div>
              <div className="activity-status">
                {activity.type === 'test_submitted' && (
                  <span className={`status-badge ${activity.status}`}>
                    {activity.status}
                  </span>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="no-activity">
            <p>No recent activity found</p>
          </div>
        )}
      </div>
    </div>
  );

  // Render Dashboard Overview
  const renderDashboard = () => (
    <div className="dashboard-main">
      <div className="dashboard-header">
        <h1>Admin Dashboard</h1>
        <div className="dashboard-actions">
          <button
            className="btn btn-primary"
            onClick={fetchDashboardData}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Refresh All Data'}
          </button>
          <div className="last-updated">
            Last updated: {new Date().toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="dashboard-loading">
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>Loading dashboard data...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Statistics Cards */}
          <div className="stats-grid">
            <div className="stat-card primary">
              <div className="stat-icon">
                <i className="fas fa-users"></i>
              </div>
              <div className="stat-content">
                <h3>{dashboardStats.totalStudents || students.length || 0}</h3>
                <p>Total Students</p>
              </div>
              <div className="stat-trend positive">
                +{dashboardStats.newStudentsThisMonth || 0} this month
              </div>
            </div>

            <div className="stat-card success">
              <div className="stat-icon">
                <i className="fas fa-clipboard-list"></i>
              </div>
              <div className="stat-content">
                <h3>{dashboardStats.totalTests || tests.length || 0}</h3>
                <p>Total Tests</p>
              </div>
              <div className="stat-trend positive">
                +{dashboardStats.activeTests || 0} active
              </div>
            </div>

            <div className="stat-card warning">
              <div className="stat-icon">
                <i className="fas fa-file-alt"></i>
              </div>
              <div className="stat-content">
                <h3>{dashboardStats.totalSubmissions || results.length || 0}</h3>
                <p>Submissions</p>
              </div>
              <div className="stat-trend positive">
                +{dashboardStats.submissionsToday || 0} today
              </div>
            </div>

            <div className="stat-card info">
              <div className="stat-icon">
                <i className="fas fa-chart-line"></i>
              </div>
              <div className="stat-content">
                <h3>{dashboardStats.averageScore || analyticsData.overall?.averageScore || 0}%</h3>
                <p>Average Score</p>
              </div>
              <div className="stat-trend neutral">
                Overall performance
              </div>
            </div>

            <div className="stat-card danger">
              <div className="stat-icon">
                <i className="fas fa-exclamation-triangle"></i>
              </div>
              <div className="stat-content">
                <h3>{dashboardStats.pendingReviews || results.filter(r => r.status === 'pending').length || 0}</h3>
                <p>Pending Reviews</p>
              </div>
              <div className="stat-trend negative">
                Needs attention
              </div>
            </div>

            <div className="stat-card secondary">
              <div className="stat-icon">
                <i className="fas fa-check-circle"></i>
              </div>
              <div className="stat-content">
                <h3>{dashboardStats.passRate || analyticsData.overall?.passRate || 0}%</h3>
                <p>Pass Rate</p>
              </div>
              <div className="stat-trend positive">
                Students passing
              </div>
            </div>
          </div>

          {/* Dashboard Charts and Data */}
          <div className="dashboard-content-grid">
            <div className="dashboard-left">
              {/* Grade Distribution Chart */}
              <div className="dashboard-card">
                <div className="card-header">
                  <h3>Grade Distribution</h3>
                  <button className="btn btn-sm btn-outline" onClick={fetchGradeDistribution}>
                    <i className="fas fa-sync-alt"></i>
                  </button>
                </div>
                <div className="chart-container">
                  {dashboardLoading ? (
                    <div className="loading-spinner">Loading chart...</div>
                  ) : (
                    <Bar
                      data={{
                        labels: gradeDistribution.map(item => item.grade),
                        datasets: [{
                          label: 'Number of Students',
                          data: gradeDistribution.map(item => item.count),
                          backgroundColor: [
                            '#10b981', // A+ - Emerald
                            '#3b82f6', // A - Blue
                            '#8b5cf6', // B+ - Violet
                            '#f59e0b', // B - Amber
                            '#ef4444', // C - Red
                            '#6b7280'  // F - Gray
                          ],
                          borderColor: [
                            '#059669',
                            '#2563eb',
                            '#7c3aed',
                            '#d97706',
                            '#dc2626',
                            '#4b5563'
                          ],
                          borderWidth: 2
                        }]
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            display: false
                          },
                          title: {
                            display: true,
                            text: 'Student Grade Distribution'
                          }
                        },
                        scales: {
                          y: {
                            beginAtZero: true,
                            ticks: {
                              stepSize: 1
                            }
                          }
                        }
                      }}
                    />
                  )}
                </div>
                <div className="grade-stats">
                  {gradeDistribution.map((grade, index) => (
                    <div key={index} className="grade-stat-item">
                      <span className={`grade-badge grade-${grade.grade.toLowerCase().replace('+', 'plus')}`}>
                        {grade.grade}
                      </span>
                      <span className="grade-count">{grade.count} students</span>
                      <span className="grade-percentage">({grade.percentage}%)</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Subject Performance Chart */}
              <div className="dashboard-card">
                <div className="card-header">
                  <h3>Subject Performance</h3>
                  <button className="btn btn-sm btn-outline" onClick={fetchSubjectPerformance}>
                    <i className="fas fa-sync-alt"></i>
                  </button>
                </div>
                <div className="chart-container">
                  {dashboardLoading ? (
                    <div className="loading-spinner">Loading chart...</div>
                  ) : (
                    <Line
                      data={{
                        labels: subjectPerformance.map(item => item.subject),
                        datasets: [{
                          label: 'Average Score (%)',
                          data: subjectPerformance.map(item => item.averageScore || item.average),
                          borderColor: '#3b82f6',
                          backgroundColor: 'rgba(59, 130, 246, 0.1)',
                          borderWidth: 3,
                          fill: true,
                          tension: 0.4
                        }]
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            display: false
                          },
                          title: {
                            display: true,
                            text: 'Average Performance by Subject'
                          }
                        },
                        scales: {
                          y: {
                            beginAtZero: true,
                            max: 100,
                            ticks: {
                              callback: function (value) {
                                return value + '%';
                              }
                            }
                          }
                        }
                      }}
                    />
                  )}
                </div>
                <div className="subject-details">
                  {subjectPerformance.map((subject, index) => (
                    <div key={index} className="subject-item">
                      <div className="subject-info">
                        <span className="subject-name">{subject.subject}</span>
                        <span className="test-count">{subject.totalTests || 0} tests</span>
                      </div>
                      <div className="subject-stats">
                        <span className={`performance-score ${(subject.averageScore || subject.average) >= 80 ? 'excellent' :
                          (subject.averageScore || subject.average) >= 60 ? 'good' : 'needs-improvement'
                          }`}>
                          {subject.averageScore || subject.average || 0}%
                        </span>
                        <span className="participation-rate">
                          {subject.participationRate || 0}% participation
                        </span>
                      </div>
                    </div>
                  ))}
                  {subjectPerformance.length === 0 && (
                    <div className="no-data">
                      <p>No subject performance data available</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="dashboard-right">
              {/* Recent Activity */}
              <div className="dashboard-card">
                <div className="card-header">
                  <h3>Recent Activity</h3>
                  <button className="btn btn-sm btn-outline" onClick={fetchRecentActivity}>
                    <i className="fas fa-sync-alt"></i>
                  </button>
                </div>
                <div className="activity-list">
                  {dashboardLoading ? (
                    <div className="loading-spinner">Loading activities...</div>
                  ) : recentActivity.length > 0 ? (
                    recentActivity.map((activity, index) => (
                      <div key={index} className="activity-item">
                        <div className="activity-icon">
                          {activity.type === 'test_submitted' ? (
                            <i className="fas fa-file-alt text-blue"></i>
                          ) : activity.type === 'student_registered' ? (
                            <i className="fas fa-user-plus text-green"></i>
                          ) : activity.type === 'test_created' ? (
                            <i className="fas fa-plus-circle text-purple"></i>
                          ) : activity.type === 'result_published' ? (
                            <i className="fas fa-chart-bar text-orange"></i>
                          ) : (
                            <i className="fas fa-bell text-gray"></i>
                          )}
                        </div>
                        <div className="activity-content">
                          <div className="activity-message">
                            {activity.type === 'test_submitted' && (
                              <>
                                <strong>{activity.studentName}</strong> submitted test
                                <strong> {activity.testTitle}</strong>
                              </>
                            )}
                            {activity.type === 'student_registered' && (
                              <>
                                New student <strong>{activity.studentName}</strong> registered
                              </>
                            )}
                            {activity.type === 'test_created' && (
                              <>
                                New test <strong>{activity.testTitle}</strong> created
                              </>
                            )}
                            {activity.type === 'result_published' && (
                              <>
                                Results published for <strong>{activity.testTitle}</strong>
                              </>
                            )}
                          </div>
                          <div className="activity-time">
                            {new Date(activity.timestamp).toLocaleString()}
                          </div>
                        </div>
                        <div className="activity-status">
                          {activity.type === 'test_submitted' && (
                            <span className={`status-badge ${activity.status}`}>
                              {activity.status}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="no-activity">
                      <i className="fas fa-info-circle"></i>
                      <p>No recent activity found</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="dashboard-card">
                <div className="card-header">
                  <h3>Quick Actions</h3>
                </div>
                <div className="quick-actions">
                  <button
                    className="btn btn-primary btn-block"
                    onClick={() => setActiveTab('tests')}
                  >
                    <i className="fas fa-plus"></i>
                    Create New Test
                  </button>
                  <button
                    className="btn btn-success btn-block"
                    onClick={() => setActiveTab('students')}
                  >
                    <i className="fas fa-user-plus"></i>
                    Add Student
                  </button>
                  <button
                    className="btn btn-warning btn-block"
                    onClick={() => setActiveTab('results')}
                  >
                    <i className="fas fa-clipboard-check"></i>
                    Review Results
                  </button>
                  <button
                    className="btn btn-info btn-block"
                    onClick={() => setActiveTab('analytics')}
                  >
                    <i className="fas fa-chart-line"></i>
                    View Analytics
                  </button>
                </div>
              </div>

              {/* System Status */}
              <div className="dashboard-card">
                <div className="card-header">
                  <h3>System Status</h3>
                </div>
                <div className="system-status">
                  <div className="status-item">
                    <span className="status-indicator online"></span>
                    <span>Database Connection</span>
                    <span className="status-text">Online</span>
                  </div>
                  <div className="status-item">
                    <span className="status-indicator online"></span>
                    <span>API Services</span>
                    <span className="status-text">Running</span>
                  </div>
                  <div className="status-item">
                    <span className="status-indicator online"></span>
                    <span>File Storage</span>
                    <span className="status-text">Available</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Performance Overview Charts */}
          <div className="performance-charts">
            <div className="chart-row">
              <div className="chart-container half-width">
                <h3>Monthly Test Submissions</h3>
                <Line
                  data={{
                    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                    datasets: [{
                      label: 'Submissions',
                      data: chartData.monthly || [0, 0, 0, 0, 0, 0],
                      borderColor: '#3b82f6',
                      backgroundColor: 'rgba(59, 130, 246, 0.1)',
                      fill: true
                    }]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false
                  }}
                />
              </div>
              <div className="chart-container half-width">
                <h3>Score Distribution</h3>
                <Doughnut
                  data={{
                    labels: ['90-100%', '80-89%', '70-79%', '60-69%', '<60%'],
                    datasets: [{
                      data: chartData.distribution || [0, 0, 0, 0, 0],
                      backgroundColor: [
                        '#10b981',
                        '#3b82f6',
                        '#f59e0b',
                        '#ef4444',
                        '#6b7280'
                      ]
                    }]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false
                  }}
                />
              </div>
            </div>
          </div>
        </>
      )}
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
              <select
                name="subject"
                value={testForm.subject}
                onChange={handleChange}
                required
              >
                <option value="">Select Subject</option>
                {SUBJECT_OPTIONS.map(sub => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
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

            {/* Answer Key */}
            <div className="upload-group optional">
              <label className="upload-label" htmlFor="answerKeyInput">
                🔑 Answer Key (PDF)
                <span className="optional-badge">OPTIONAL</span>
              </label>

              {/* CLICKING THIS DIV OPENS THE FILE-PICKER */}
              <div
                className="upload-area"
                role="button"
                tabIndex={0}
                onClick={() => answerKeyInputRef.current?.click()}
                onKeyDown={(e) =>
                  (e.key === 'Enter' || e.key === ' ') && answerKeyInputRef.current?.click()
                }
              >
                {files.answerKey ? (
                  <div className="file-selected">
                    <span className="file-icon">🔑</span>
                    <div className="file-info">
                      <p>{files.answerKey.name}</p>
                      <small>
                        {(files.answerKey.size / 1024 / 1024).toFixed(2)} MB
                      </small>
                    </div>

                    {/* stopPropagation so the click doesn’t reopen the picker */}
                    <button
                      type="button"
                      className="remove-file"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFiles({ ...files, answerKey: null });
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className="upload-placeholder">
                    <span className="upload-icon">⬆️</span>
                    <p>Upload answer key</p>
                    <small>PDF only, max 10 MB</small>
                  </div>
                )}
              </div>

              {/* HIDDEN INPUT */}
              <input
                ref={answerKeyInputRef}
                id="answerKeyInput"
                name="answerKey"
                type="file"
                accept="application/pdf"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />

              <div className="checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={testForm.answerKeyVisible}
                    onChange={(e) =>
                      setTestForm({ ...testForm, answerKeyVisible: e.target.checked })
                    }
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
            disabled={uploading || isUploaded || (!files.questionPaper && !files.answerKey)}
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
              disabled={uploading || !files.questionPaper && !files.answerKey}
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
        <div className="header-actions">
          <button className="btn btn-outline" onClick={fetchAnalyticsData}>
            🔄 Refresh Analytics
          </button>
          <div className="date-range-selector">
            <select>
              <option>Last 7 days</option>
              <option>Last 30 days</option>
              <option>Last 3 months</option>
              <option>Custom range</option>
            </select>
          </div>
        </div>
      </div>

      {/* Overall Performance Stats */}
      <div className="analytics-stats-grid">
        <div className="stat-card analytics-primary">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <h3>{analyticsData.overall.totalStudents}</h3>
            <p>Total Students</p>
          </div>
          <div className="stat-trend">Enrolled students</div>
        </div>

        <div className="stat-card analytics-success">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <h3>{analyticsData.overall.averageScore}%</h3>
            <p>Average Score</p>
          </div>
          <div className="stat-trend">Overall performance</div>
        </div>

        <div className="stat-card analytics-info">
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <h3>{analyticsData.overall.passRate}%</h3>
            <p>Pass Rate</p>
          </div>
          <div className="stat-trend">Students passing</div>
        </div>

        <div className="stat-card analytics-warning">
          <div className="stat-icon">📈</div>
          <div className="stat-content">
            <h3>{analyticsData.subjectPerformance.length}</h3>
            <p>Active Subjects</p>
          </div>
          <div className="stat-trend">Subjects analyzed</div>
        </div>
      </div>

      {/* Student Search */}
      <div className="analytics-section">
        <h3>🔍 Student Performance Search</h3>
        <div className="search-container">
          <div className="search-input-group">
            <input
              type="text"
              placeholder="Search by name, email, or roll number..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (e.target.value.length > 2) {
                  handleStudentSearch(e.target.value);
                } else {
                  setSearchResult(null);
                }
              }}
              className="analytics-search-input"
            />
            <button
              className="btn btn-primary search-btn"
              onClick={() => handleStudentSearch(searchQuery)}
              disabled={searchLoading}
            >
              {searchLoading ? '🔄' : '🔍'}
            </button>
          </div>

          {searchResult && (
            <div className="search-result-card">
              <div className="student-info">
                <h4>{searchResult.name}</h4>
                <p>{searchResult.email}</p>
                <small>Roll: {searchResult.rollNo || 'Not assigned'}</small>
              </div>
              <div className="student-stats">
                <span className="test-count">📝 {searchResult.results?.length || 0} tests taken</span>
              </div>

              {searchResult.results && searchResult.results.length > 0 && (
                <div className="recent-results">
                  <h5>Recent Test Results:</h5>
                  <div className="results-list">
                    {searchResult.results.slice(0, 3).map((result, index) => (
                      <div key={index} className="result-item">
                        <span className="test-name">{result.testTitle}</span>
                        <span className="score">
                          {result.marksObtained}/{result.totalMarks}
                        </span>
                        <span className={`status-badge ${result.status}`}>
                          {result.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Subject Performance Chart */}
      <div className="analytics-charts">
        <div className="chart-container full-width">
          <h3>📚 Subject-wise Performance Analysis</h3>
          <div className="chart-wrapper">
            <Bar
              data={{
                labels: analyticsData.subjectPerformance.map(item => item.subject),
                datasets: [{
                  label: 'Average Score (%)',
                  data: analyticsData.subjectPerformance.map(item => item.average),
                  backgroundColor: [
                    'rgba(99, 102, 241, 0.6)',
                    'rgba(16, 185, 129, 0.6)',
                    'rgba(245, 158, 11, 0.6)',
                    'rgba(239, 68, 68, 0.6)',
                    'rgba(139, 92, 246, 0.6)',
                    'rgba(6, 182, 212, 0.6)',
                    'rgba(217, 119, 6, 0.6)'
                  ],
                  borderColor: [
                    'rgb(99, 102, 241)',
                    'rgb(16, 185, 129)',
                    'rgb(245, 158, 11)',
                    'rgb(239, 68, 68)',
                    'rgb(139, 92, 246)',
                    'rgb(6, 182, 212)',
                    'rgb(217, 119, 6)'
                  ],
                  borderWidth: 2
                }]
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    display: false
                  },
                  title: {
                    display: true,
                    text: 'Performance by Subject'
                  }
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                      callback: function (value) {
                        return value + '%';
                      }
                    }
                  }
                }
              }}
            />
          </div>
        </div>

        {/* Performance Distribution */}
        <div className="chart-container">
          <h3>📊 Performance Distribution</h3>
          <div className="chart-wrapper">
            <Doughnut
              data={{
                labels: ['Excellent (90-100%)', 'Good (80-89%)', 'Average (70-79%)', 'Below Average (<70%)'],
                datasets: [{
                  data: [
                    analyticsData.subjectPerformance.filter(s => s.average >= 90).length,
                    analyticsData.subjectPerformance.filter(s => s.average >= 80 && s.average < 90).length,
                    analyticsData.subjectPerformance.filter(s => s.average >= 70 && s.average < 80).length,
                    analyticsData.subjectPerformance.filter(s => s.average < 70).length
                  ],
                  backgroundColor: [
                    '#10b981', // Excellent - Green
                    '#3b82f6', // Good - Blue  
                    '#f59e0b', // Average - Yellow
                    '#ef4444'  // Below Average - Red
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
      </div>

      {/* Detailed Analytics Table */}
      <div className="analytics-section">
        <h3>📋 Subject Performance Details</h3>
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Subject</th>
                <th>Average Score</th>
                <th>Performance Level</th>
                <th>Trend</th>
              </tr>
            </thead>
            <tbody>
              {analyticsData.subjectPerformance.map((subject, index) => (
                <tr key={index}>
                  <td>
                    <strong>{subject.subject}</strong>
                  </td>
                  <td>
                    <span className={`score-badge ${subject.average >= 90 ? 'excellent' :
                      subject.average >= 80 ? 'good' :
                        subject.average >= 70 ? 'average' : 'below-average'
                      }`}>
                      {subject.average}%
                    </span>
                  </td>
                  <td>
                    <span className={`performance-level ${subject.average >= 90 ? 'excellent' :
                      subject.average >= 80 ? 'good' :
                        subject.average >= 70 ? 'average' : 'below-average'
                      }`}>
                      {subject.average >= 90 ? '🌟 Excellent' :
                        subject.average >= 80 ? '👍 Good' :
                          subject.average >= 70 ? '📊 Average' : '⚠️ Needs Attention'}
                    </span>
                  </td>
                  <td>
                    <span className="trend-indicator">
                      {index < analyticsData.subjectPerformance.length / 2 ? '📈 Above Average' : '📉 Below Average'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
            <span className="logo-text">CompuTech</span>
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
            <button
              className={`nav-item ${activeTab === 'notifications' ? 'active' : ''}`}
              onClick={() => setActiveTab('notifications')}
            >
              <span className="nav-icon">📢</span>
              <span className="nav-text">Notifications</span>
            </button>
            <button
              className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveTab('settings')}
            >
              <span className="nav-icon">⚙️</span>
              <span className="nav-text">Settings</span>
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
              {activeTab === 'notifications' && '📢 Notification Center'}
              {activeTab === 'settings' && '⚙️ System Settings'}
            </h1>
          </div>

          <div className="header-right">
            <button
              className={`header-btn notification-btn ${activeTab === 'notifications' ? 'active' : ''}`}
              onClick={() => setActiveTab('notifications')}
              title="View Notifications"
            >
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
          {activeTab === 'notifications' && <NotificationCenter />}
          {activeTab === 'settings' && <NotificationSettings />}
        </div>
      </main>
    </div>
  );

};

export default AdminDashboard;
