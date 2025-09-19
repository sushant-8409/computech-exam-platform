import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../App';
import axios from 'axios';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import './AdminDashboard.css';
// Force refresh by adding comment
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
import OAuthSettings from './OAuthSettings';
import MobileUploadManager from './MobileUploadManager';
import CodingTestCreator from './CodingTestCreatorMulti';
import ExampleBox from './ExampleBox';
import PromotionsManager from './PromotionsManager';
import { CLASS_OPTIONS, BOARD_OPTIONS } from '../../constants/classBoardOptions';
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
// ✅ FIXED: Define dashboardReducer function before the component

const AdminDashboard = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    // Initialize dark mode from localStorage or default to false
    const savedDarkMode = localStorage.getItem('admin-dark-mode');
    return savedDarkMode ? JSON.parse(savedDarkMode) : false;
  });
  const [selectedResult, setSelectedResult] = useState(null);
  const [isUploaded, setIsUploaded] = useState(false);
  const fileInputRef = useRef(null);
  const { testId } = useParams();
  const answerKeyInputRef = useRef(null);
  const [gdriveConnected, setGDriveConnected] = useState(false);

  // Authentication check helper
  const checkAuth = () => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    
    console.log('🔍 Authentication check:', {
      hasToken: !!token,
      tokenPreview: token ? `${token.slice(0, 10)}...` : 'none',
      hasUser: !!user,
      hasStoredUser: !!storedUser,
      userRole: user?.role || 'none'
    });

    if (!token || !user) {
      console.log('❌ No authentication found, redirecting to login');
      navigate('/login');
      return false;
    }
    return true;
  };

  // Handle mobile menu and body scroll
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    // Cleanup on unmount
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [mobileMenuOpen]);

  // Save dark mode preference to localStorage
  useEffect(() => {
    localStorage.setItem('admin-dark-mode', JSON.stringify(darkMode));
  }, [darkMode]);

  // Close mobile menu on window resize if screen becomes larger
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768 && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [mobileMenuOpen]);

  const checkGDriveStatus = async () => {
    try {
      console.log('🔍 Checking Admin Google Drive status...');
      
      // Check for admin Google Drive tokens in database
      const res = await axios.get('/auth/google/admin-status');
      
      console.log('📊 Admin Google Drive status response:', {
        connected: res.data.connected,
        driveAccess: res.data.driveAccess,
        userInfo: res.data.userInfo,
        adminEmail: res.data.adminEmail,
        error: res.data.error
      });
      
      setGDriveConnected(res.data.connected && res.data.driveAccess);
      
      if (res.data.connected && res.data.driveAccess) {
        console.log('✅ Admin Google Drive is connected:', res.data.userInfo?.emailAddress);
      } else {
        console.log('❌ Admin Google Drive not connected:', res.data.error);
      }
    } catch (error) {
      console.error('❌ Error checking Admin Google Drive status:', error);
      setGDriveConnected(false);
    }
  };

  useEffect(() => {
    checkGDriveStatus();
  }, []);
 const handleConnectGDrive = () => {
  console.log('🔗 Connect button clicked!');
  
  // Get user token for OAuth state
  const token = localStorage.getItem('token');
  if (!token) {
    toast.error('Please log in first');
    return;
  }

  // Use backend URL from env or infer from current host (avoid SPA fallback)
  const DEFAULT_LOCAL_API = 'http://localhost:5000';
  const DEFAULT_PROD_API = 'https://computech-exam-platform.onrender.com';
  const baseUrl = process.env.REACT_APP_API_URL || (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? DEFAULT_PROD_API : DEFAULT_LOCAL_API);
  const authUrl = `${baseUrl}/auth/google?token=${encodeURIComponent(token)}`;
  console.log('🔗 Opening OAuth popup:', authUrl);
  
  // Open popup window for OAuth
  const popup = window.open(
    authUrl,
    'googleDriveAuth',
    'width=500,height=600,scrollbars=yes,resizable=yes'
  );

  if (!popup) {
    toast.error('Popup blocked! Please allow popups for this site.');
    return;
  }

  // Listen for messages from the popup
  const handleMessage = (event) => {
    // Security check: allow either configured API origin or the window.location origin (for proxy setups)
    const allowedOrigin = new URL(baseUrl).origin;
    if (event.origin !== allowedOrigin && event.origin !== window.location.origin) {
      console.warn('Received message from unexpected origin:', event.origin);
      return;
    }

    console.log('� Received message from popup:', event.data);

    if (event.data.type === 'OAUTH_SUCCESS') {
      console.log('✅ OAuth successful!');
      popup.close();
      toast.success('Google Drive connected successfully!');
      
      // Update the connection status
      setGDriveConnected(true);
      checkGDriveStatus(); // Refresh status
      
      // Remove event listener
      window.removeEventListener('message', handleMessage);
    } else if (event.data.type === 'OAUTH_ERROR') {
      console.error('❌ OAuth error:', event.data.error);
      popup.close();
      toast.error(`OAuth failed: ${event.data.error}`);
      
      // Remove event listener
      window.removeEventListener('message', handleMessage);
    }
  };

  // Add message listener
  window.addEventListener('message', handleMessage);

  // Cleanup if popup is closed manually
  const checkPopup = setInterval(() => {
    if (popup.closed) {
      console.log('🔴 Popup closed manually');
      clearInterval(checkPopup);
      window.removeEventListener('message', handleMessage);
    }
  }, 1000);
};


 useEffect(() => {
  // Check if user just completed OAuth
  const urlParams = new URLSearchParams(window.location.search);
  const tab = urlParams.get('tab');
  const oauth = urlParams.get('oauth');
  const error = urlParams.get('error');
  
  console.log('🔍 Checking URL params:', { tab, oauth, error });
  
  if (tab === 'create-test') {
    console.log('🎯 Setting active tab to create-test');
    setActiveTab('create-test');
    
    if (oauth === 'success') {
      console.log('✅ OAuth success detected');
      toast.success('✅ Google Drive connected successfully!');
      checkGDriveStatus(); // Recheck connection status
    }
  }
  
  if (error) {
    let errorMessage = 'Google Drive connection failed';
    switch (error) {
      case 'oauth_denied':
        errorMessage = 'Google OAuth was denied. Please try again.';
        break;
      case 'oauth_no_code':
        errorMessage = 'No authorization code received from Google.';
        break;
      case 'oauth_token_failed':
        errorMessage = 'Failed to exchange authorization code for tokens.';
        break;
      case 'oauth_init_failed':
        errorMessage = 'Failed to initiate Google OAuth flow.';
        break;
    }
    console.log('❌ OAuth error:', errorMessage);
    toast.error(errorMessage);
  }
  
  // Clear URL parameters after processing
  if (tab || oauth || error) {
    console.log('🧹 Cleaning URL parameters');
    const newUrl = window.location.pathname;
    window.history.replaceState({}, document.title, newUrl);
  }
}, []);




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
    monthly: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // 12 months
    distribution: [0, 0, 0, 0, 0],
    monthlyLabels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    distributionLabels: ['90-100%', '80-89%', '70-79%', '60-69%', '<60%']
  });


  // Data Management
  const [tests, setTests] = useState([]);
  const [students, setStudents] = useState([]);
  const [results, setResults] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterBoard, setFilterBoard] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [currentTestId, setCurrentTestId] = useState(null);
  
  // Coding test specific states
  const [codingTests, setCodingTests] = useState([]);
  const [codingTestsLoading, setCodingTestsLoading] = useState(false);
  const [showCodingMarkModal, setShowCodingMarkModal] = useState(false);
  const [selectedCodingTest, setSelectedCodingTest] = useState(null);
  const [modifiedMarks, setModifiedMarks] = useState({});
  const [adminNotes, setAdminNotes] = useState('');
  const [cheatingFlags, setCheatingFlags] = useState({});
  const [codingSearchTerm, setCodingSearchTerm] = useState('');
  const [codingStatusFilter, setCodingStatusFilter] = useState('all');
  const [showCodingManagement, setShowCodingManagement] = useState(false);
  const [searchEmail, setSearchEmail] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  
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
    title: '', description: '', subject: '', class: '', board: '',
    duration: 60, totalMarks: 100, passingMarks: 40,
    questionsCount: 10, startDate: '', endDate: '',
    answerKeyVisible: false, resumeEnabled: true,
    proctoringSettings: {
      strictMode: true, allowTabSwitch: 0,
      requireFullscreen: true,
      blockRightClick: true,
      blockKeyboardShortcuts: true,
      maxViolations: 10
    },
    // Camera Monitoring Settings
    cameraMonitoring: {
      enabled: false,
      captureInterval: 60,
      saveToGoogleDrive: true,
      requireCameraAccess: false,
      faceDetection: false,
      suspiciousActivityDetection: true
    },
    // Paper submission settings
    paperSubmissionRequired: false,
    paperUploadTimeLimit: 15,
    paperUploadAllowedDuringTest: false
  };
  // Form States
  const [form, setForm] = useState({
    title: '', description: '', subject: '', class: '', board: '',
    duration: 60, totalMarks: 100, passingMarks: 40,
    questionsCount: 10, startDate: '', endDate: '',
    answerKeyVisible: false, resumeEnabled: true,
    proctoringSettings: {
      strictMode: true, allowTabSwitch: 0,
      requireFullscreen: true,
      blockRightClick: true,
      blockKeyboardShortcuts: true,
      maxViolations: 10
    },
    // Camera Monitoring Settings
    cameraMonitoring: {
      enabled: false,
      captureInterval: 60,
      saveToGoogleDrive: true,
      requireCameraAccess: false,
      faceDetection: false,
      suspiciousActivityDetection: true
    },
    // Paper submission settings
    paperSubmissionRequired: false,
    paperUploadTimeLimit: 15,
    paperUploadAllowedDuringTest: false
  });
  const [testForm, setTestForm] = useState({
    title: '', description: '', subject: '', class: '', board: '',
    duration: 60, totalMarks: 100, passingMarks: 40,
    questionsCount: 10, startDate: '', endDate: '',
    answerKeyVisible: false, resumeEnabled: true,
    proctoringSettings: {
      strictMode: true, allowTabSwitch: 0,
      requireFullscreen: true,
      blockRightClick: true,
      blockKeyboardShortcuts: true,
      maxViolations: 10
    },
    // Camera Monitoring Settings
    cameraMonitoring: {
      enabled: false,
      captureInterval: 60,
      saveToGoogleDrive: true,
      requireCameraAccess: false,
      faceDetection: false,
      suspiciousActivityDetection: true
    },
    // Paper submission settings
    paperSubmissionRequired: false,
    paperUploadTimeLimit: 15,
    paperUploadAllowedDuringTest: false
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
  const [searchLoading, setSearchLoading] = useState(false);

  // Add this function to fetch analytics data
  const fetchAnalyticsData = async () => {
    try {
      console.log('📊 Fetching analytics data...');
      const token = localStorage.getItem('token');
      if (!token) {
        console.log('❌ No token found for analytics');
        toast.error('Authentication required');
        return;
      }

      const response = await axios.get('/api/admin/analytics', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAnalyticsData(response.data);
      console.log('✅ Analytics data loaded:', response.data);
    } catch (error) {
      console.error('❌ Failed to fetch analytics:', error);
      if (error.response?.status === 401) {
        console.log('🔒 Unauthorized access to analytics');
        toast.error('Authentication failed. Please login again.');
      } else if (error.response?.status === 403) {
        console.log('🔒 Forbidden access to analytics');
        toast.error('Access denied. Admin privileges required.');
      } else {
        toast.error('Failed to load analytics data');
      }
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
  const [showCodingTestCreator, setShowCodingTestCreator] = useState(false);
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
      const token = localStorage.getItem('token');
      if (!token) {
        console.log('❌ No token found for grade distribution');
        setGradeDistribution([]);
        return;
      }

      const response = await axios.get('/api/admin/analytics/grade-distribution', {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Normalize response to an array of { grade, count, percentage }
      const raw = response.data;
      let normalized = [];

      if (Array.isArray(raw)) {
        normalized = raw.map(item => ({
          grade: item.grade || item._id || item.label || String(item.grade || item._id || ''),
          count: Number(item.count ?? item.value ?? item.total ?? 0),
          percentage: item.percentage != null ? Number(item.percentage) : null
        }));
      } else if (raw && typeof raw === 'object') {
        // If API returned an object like { 'A+': 5, 'A': 3 }
        const entries = Object.entries(raw);
        normalized = entries.map(([k, v]) => {
          if (v != null && typeof v === 'object') {
            return {
              grade: v.grade || v._id || k,
              count: Number(v.count ?? v.value ?? v.total ?? 0),
              percentage: v.percentage != null ? Number(v.percentage) : null
            };
          }
          return { grade: k, count: Number(v ?? 0), percentage: null };
        });
      } else {
        normalized = [];
      }

      // Compute percentages if missing
      const total = normalized.reduce((s, it) => s + (it.count || 0), 0) || 0;
      if (total > 0) {
        normalized = normalized.map(it => ({
          ...it,
          percentage: it.percentage != null ? it.percentage : Math.round((it.count / total) * 100)
        }));
      } else {
        // Ensure percentage is at least 0
        normalized = normalized.map(it => ({ ...it, percentage: it.percentage != null ? it.percentage : 0 }));
      }

      setGradeDistribution(normalized);
    } catch (error) {
      console.error('❌ Failed to fetch grade distribution:', error);
      if (error.response?.status === 401) {
        console.log('🔒 Unauthorized access to grade distribution');
      }
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
      const token = localStorage.getItem('token');
      if (!token) {
        console.log('❌ No token found for subject performance');
        setSubjectPerformance([]);
        return;
      }

      const response = await axios.get('/api/admin/analytics/subject-performance', {
        headers: { Authorization: `Bearer ${token}` }
      });
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
      if (error.response?.status === 401) {
        console.log('🔒 Unauthorized access to subject performance');
      }
      setSubjectPerformance([]); // Always set to empty array on error
    }
  };

  // ✅ Optimized role-based data loading for admin dashboard
  const fetchDashboardData = useCallback(async (priority = 'high') => {
    setDashboardLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.log('❌ No token found for dashboard data');
        toast.error('Authentication required. Please login again.');
        return;
      }

      const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

      if (priority === 'high') {
        // Load critical admin data first (stats and recent activity)
        const [dashboardResponse, recentTestsResponse] = await Promise.all([
          axios.get('/api/admin/dashboard/stats', authHeaders),
          axios.get('/api/admin/tests?limit=10&sort=recent', authHeaders)
        ]);

        setDashboardStats(dashboardResponse.data);
        setTests(recentTestsResponse.data.tests || []);

        // Load remaining data based on active tab
        setTimeout(() => {
          loadDataBasedOnTab(activeTab, authHeaders);
        }, 800);
      } else {
        // Load all data for comprehensive view
        const [dashboardResponse, testsResponse, studentsResponse, resultsResponse] = await Promise.all([
          axios.get('/api/admin/dashboard/stats', authHeaders),
          axios.get('/api/admin/tests', authHeaders),
          axios.get('/api/admin/students', authHeaders),
          axios.get('/api/admin/results', authHeaders)
        ]);

        setDashboardStats(dashboardResponse.data);
        setTests(testsResponse.data.tests || []);
        setStudents(studentsResponse.data.students || []);
        setResults(resultsResponse.data.results || []);

        // Load additional analytics data
        await Promise.all([
          fetchGradeDistribution(),
          fetchSubjectPerformance(),
          fetchRecentActivity()
        ]);
      }

    } catch (error) {
      console.error('❌ Failed to fetch dashboard data:', error);
      if (error.response?.status === 401) {
        console.log('🔒 Unauthorized access to dashboard data');
        toast.error('Session expired. Please login again.');
      } else {
        toast.error('Failed to load dashboard data');
      }
    } finally {
      setDashboardLoading(false);
    }
  }, [activeTab]);

  // ✅ Load data based on currently active tab to optimize performance
  const loadDataBasedOnTab = async (tab, authHeaders) => {
    try {
      switch (tab) {
        case 'dashboard':
          await Promise.all([
            fetchRecentActivity(),
            fetchChartData()
          ]);
          break;
        case 'students':
          if (students.length === 0) {
            const studentsResponse = await axios.get('/api/admin/students', authHeaders);
            setStudents(studentsResponse.data.students || []);
          }
          break;
        case 'results':
          if (results.length === 0) {
            const resultsResponse = await axios.get('/api/admin/results', authHeaders);
            setResults(resultsResponse.data.results || []);
          }
          break;
        case 'analytics':
          await Promise.all([
            fetchGradeDistribution(),
            fetchSubjectPerformance()
          ]);
          break;
        case 'tests':
          if (tests.length <= 10) {
            const allTestsResponse = await axios.get('/api/admin/tests', authHeaders);
            setTests(allTestsResponse.data.tests || []);
          }
          break;
        default:
          break;
      }
    } catch (error) {
      console.error(`Error loading data for ${tab} tab:`, error);
    }
  };

  // Fetch recent activity data
  const fetchRecentActivity = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.log('❌ No token found for recent activity');
        setRecentActivity([]);
        return;
      }

      const response = await axios.get('/api/admin/analytics/recent-activity', {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Normalize response to array
      const raw = response.data;
      let normalized = [];
      if (Array.isArray(raw)) {
        normalized = raw;
      } else if (raw && typeof raw === 'object') {
        // If wrapped in an object like { recentActivity: [...] }
        if (Array.isArray(raw.recentActivity)) normalized = raw.recentActivity;
        else if (Array.isArray(raw.results)) normalized = raw.results;
        else {
          // attempt to coerce object entries into an array
          normalized = Object.values(raw).flat().filter(Boolean);
        }
      } else {
        normalized = [];
      }
      setRecentActivity(normalized);
    } catch (error) {
      console.error('❌ Failed to fetch recent activity:', error);
      if (error.response?.status === 401) {
        console.log('🔒 Unauthorized access to recent activity');
      }
      setRecentActivity([]);
    }
  };

  // Combined dashboard data fetch

  const [bulkActionMode, setBulkActionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      console.log('❌ No token found for admin tests');
      return;
    }

    axios.get('/api/admin/tests', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(({ data }) => setTests(data.tests || []))
      .catch(err => {
        console.error('Fetch tests error:', err);
        if (err.response?.status === 401) {
          console.log('🔒 Unauthorized access to admin tests');
        }
      });
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
    CBSE: ['9', '10', '11', '12'],
    ICSE: ['9', '10'],
    ISC: ['11', '12'],
    WBCHSE: ['11', '12'],
    Other: ['9', '10', '11', '12']
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
    // Check authentication first
    if (!checkAuth()) {
      return;
    }

    fetchDashboardData('high'); // Use high priority loading for initial load
    fetchChartData();
    fetchAnalyticsData();
    fetchCodingTests(); // Fetch coding test data for enhanced results management
    // Load theme preference
    const savedTheme = localStorage.getItem('admin-theme');
    if (savedTheme === 'dark') {
      setDarkMode(true);
      document.body.classList.add('dark-theme');
    }
  }, [user]); // Add user dependency to re-run when user changes

  // ✅ Optimized tab-based data loading
  useEffect(() => {
    if (!user) return;
    
    const token = localStorage.getItem('token');
    if (!token) return;

    const authHeaders = { headers: { Authorization: `Bearer ${token}` } };
    
    // Load data based on active tab to optimize performance
    const timeoutId = setTimeout(() => {
      loadDataBasedOnTab(activeTab, authHeaders);
    }, 300); // Debounce tab switching

    return () => clearTimeout(timeoutId);
  }, [activeTab, user, loadDataBasedOnTab]);

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




  // Fetch chart data
  const fetchChartData = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.log('❌ No token found for chart data');
        // Set fallback data
        setChartData({
          monthly: [0, 0, 0, 0, 0, 0],
          distribution: [0, 0, 0, 0, 0],
          monthlyLabels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
          distributionLabels: ['90-100%', '80-89%', '70-79%', '60-69%', '<60%']
        });
        return;
      }

      console.log('📊 Fetching chart data...');
      const response = await axios.get('/api/admin/dashboard/charts', {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Chart data response:', response.data);
      const { monthly, distribution, labels } = response.data.charts;
      // Replace dispatch calls with setChartData
      setChartData({
        monthly: monthly || [0, 0, 0, 0, 0, 0],
        distribution: distribution || [0, 0, 0, 0, 0],
        monthlyLabels: labels || ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        distributionLabels: response.data.distributionLabels || ['90-100%', '80-89%', '70-79%', '60-69%', '<60%']
      });
    } catch (error) {
      console.error('Error fetching chart data:', error);
      if (error.response?.status === 401) {
        console.log('🔒 Unauthorized access to chart data');
      }
      // Set fallback data
      setChartData({
        monthly: [0, 0, 0, 0, 0, 0],
        distribution: [0, 0, 0, 0, 0],
        monthlyLabels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        distributionLabels: ['90-100%', '80-89%', '70-79%', '60-69%', '<60%']
      });
    }
  }, []);

// touch: rebuild trigger
// touch2: recentActivity normalized



  // File upload handler

  // 2) Main create‐test handler

  // Bulk actions
  const handleBulkAction = async (action) => {
    if (selectedItems.length === 0) {
      toast.error('Please select items first');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('Authentication required. Please login again.');
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
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success(`Successfully ${action}ed ${selectedItems.length} items`);
      setSelectedItems([]);
      setBulkActionMode(false);
      fetchDashboardData();
    } catch (error) {
      console.error('❌ Bulk action failed:', error);
      if (error.response?.status === 401) {
        console.log('🔒 Unauthorized access to bulk action');
        toast.error('Session expired. Please login again.');
      } else {
        toast.error(`Failed to ${action} items`);
      }
    }
  };

  // Coding test management functions
  const fetchCodingTests = useCallback(async () => {
    try {
      setCodingTestsLoading(true);
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
      setCodingTestsLoading(false);
    }
  }, [navigate]);

  const handleCodingMarkModification = (test) => {
    setSelectedCodingTest(test);
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
    setShowCodingMarkModal(true);
  };

  const saveCodingMarkModifications = async () => {
    try {
      const token = localStorage.getItem('token');
      const updateData = {
        resultId: selectedCodingTest._id,
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
        setShowCodingMarkModal(false);
        fetchCodingTests();
        fetchDashboardData(); // Refresh the main results too
      } else {
        toast.error('Failed to update marks');
      }
    } catch (error) {
      console.error('Error updating marks:', error);
      toast.error('Failed to save changes');
    }
  };

  const flagCodingTestForCheating = async (testId, reason) => {
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
        fetchDashboardData();
      } else {
        toast.error('Failed to flag test');
      }
    } catch (error) {
      console.error('Error flagging test:', error);
      toast.error('Failed to flag test');
    }
  };

  const getFilteredCodingTests = () => {
    return codingTests.filter(test => {
      const matchesSearch = 
        test.studentId?.name?.toLowerCase().includes(codingSearchTerm.toLowerCase()) ||
        test.studentId?.email?.toLowerCase().includes(codingSearchTerm.toLowerCase()) ||
        test.testTitle?.toLowerCase().includes(codingSearchTerm.toLowerCase());
      
      const matchesStatus = codingStatusFilter === 'all' || 
        (codingStatusFilter === 'flagged' && test.isFlagged) ||
        (codingStatusFilter === 'reviewed' && test.adminReviewed) ||
        (codingStatusFilter === 'pending' && !test.adminReviewed);
      
      return matchesSearch && matchesStatus;
    });
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

    // Validate required fields
    if (!testForm.title?.trim()) {
      return toast.error('📝 Test title is required');
    }
    if (!testForm.subject?.trim()) {
      return toast.error('📚 Subject is required');
    }
    if (!testForm.class?.trim()) {
      return toast.error('🎓 Class is required');
    }
    if (!testForm.board?.trim()) {
      return toast.error('🏫 Board is required');
    }
    if (!testForm.startDate || !testForm.endDate) {
      return toast.error('📅 Start date and end date are required');
    }

    // Validate dates
    const startDate = new Date(testForm.startDate);
    const endDate = new Date(testForm.endDate);
    if (startDate >= endDate) {
      return toast.error('📅 End date must be after start date');
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const payload = {
        ...testForm,
        description: testForm.description || '', // Add default description
        // Ensure dates are in ISO format
        startDate: new Date(testForm.startDate).toISOString(),
        endDate: new Date(testForm.endDate).toISOString(),
        // Ensure numeric fields are numbers
        duration: Number(testForm.duration),
        totalMarks: Number(testForm.totalMarks),
        passingMarks: Number(testForm.passingMarks),
        questionsCount: Number(testForm.questionsCount),
        questionPaperURL: fileUrls.questionPaper,
        answerKeyURL: fileUrls.answerKey || '' // Allow empty answer key
      };

      console.log('📤 Sending test creation payload:', payload);
      console.log('📝 Payload fields check:', {
        hasTitle: !!payload.title,
        hasSubject: !!payload.subject,
        hasClass: !!payload.class,
        hasBoard: !!payload.board,
        hasStartDate: !!payload.startDate,
        hasEndDate: !!payload.endDate,
        startDateValue: payload.startDate,
        endDateValue: payload.endDate,
        durationType: typeof payload.duration,
        totalMarksType: typeof payload.totalMarks,
        passingMarksType: typeof payload.passingMarks,
        questionsCountType: typeof payload.questionsCount
      });

      const response = await axios.post(
        '/api/admin/tests',
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      console.log('✅ Test created successfully:', response.data);
      setTestForm(initialFormState);
      setFiles({ questionPaper: null, answerKey: null });
      setFileUrls({ questionPaper: '', answerKey: '' });
      setIsUploaded(false);
      toast.success('🚀 Test created! Redirecting…');
      navigate(-1);
    } catch (err) {
      console.error('❌ Test creation error:', err);
      console.error('❌ Error response data:', err.response?.data);
      console.error('❌ Error response status:', err.response?.status);
      
      // Handle validation errors specifically
      if (err.response?.status === 422) {
        const errorData = err.response?.data;
        console.error('❌ Validation error details:', errorData);
        
        const errors = errorData?.errors;
        if (errors && Array.isArray(errors)) {
          const errorMessages = errors.map(error => `${error.path || error.param}: ${error.msg}`).join(', ');
          toast.error(`Validation errors: ${errorMessages}`);
        } else if (errorData?.message) {
          toast.error(`Validation failed: ${errorData.message}`);
        } else {
          toast.error('Validation failed. Please check all required fields.');
          console.error('❌ Unknown validation error format:', errorData);
        }
      } else {
        toast.error(err.response?.data?.message || 'Test creation failed');
      }
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

    // Check authentication first
    if (!checkAuth()) {
      return;
    }

    setUploading(true);
    try {
      const token = localStorage.getItem('token');
      const fd = new FormData();
      fd.append('questionPaper', files.questionPaper);
      if (files.answerKey) fd.append('answerKey', files.answerKey);

      console.log('📤 Starting file upload...');
      // Call updated upload-temp API that returns MEGA URLs
      const { data } = await axios.post('/api/admin/tests/upload-temp', fd, {
        headers: { Authorization: `Bearer ${token}` }
      });

      console.log('✅ Upload response:', data);
      // Store direct MEGA URLs in state
      setFileUrls({
        questionPaper: data.data.questionPaper?.url || '',
        answerKey: data.data.answerKey?.url || ''
      });
      setIsUploaded(true);
      toast.success('✅ Files uploaded to Google Drive successfully!');
    } catch (err) {
      console.error('❌ Upload error:', err);
      
      if (err.response?.status === 401) {
        if (err.response?.data?.needsAuth) {
          toast.error('🔗 Please connect to Google Drive first');
          setGDriveConnected(false);
        } else {
          console.log('🔒 Authentication expired during upload');
          toast.error('Session expired. Please login again.');
        }
      } else {
        toast.error(err.response?.data?.message || 'Google Drive upload failed');
      }
    } finally {
      setUploading(false);
    }
  }, [
    uploading,
    files.questionPaper,
    files.answerKey,
    checkAuth
  ]);




  // Filter and search data
  const filterData = (data, type) => {
    let filtered = [...data];

    // Remove duplicates based on ID first
    if (type === 'results') {
      const seen = new Set();
      filtered = filtered.filter(item => {
        if (seen.has(item._id)) {
          return false;
        }
        seen.add(item._id);
        return true;
      });
    }

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(item => {
        const searchFields = type === 'students'
          ? [item.name, item.email, item.rollNo]
          : type === 'tests'
            ? [item.title, item.subject]
            : [item.testTitle, item.studentId?.name, item.studentId?.email];

        return searchFields.some(field =>
          field?.toLowerCase().includes(searchTerm.toLowerCase())
        );
      });
    }

    // Class filter
    if (filterClass) {
      filtered = filtered.filter(item => {
        if (type === 'results') {
          return item.studentId?.class === filterClass;
        }
        return item.class === filterClass;
      });
    }

    // Board filter
    if (filterBoard) {
      filtered = filtered.filter(item => {
        if (type === 'results') {
          return item.studentId?.board === filterBoard;
        }
        return item.board === filterBoard;
      });
    }

    // Status filter for results
    if (filterStatus && type === 'results') {
      filtered = filtered.filter(item => item.status === filterStatus);
    }

    // Sort
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      if (type === 'results') {
        switch (sortBy) {
          case 'submittedAt':
            aValue = new Date(a.submittedAt);
            bValue = new Date(b.submittedAt);
            break;
          case 'studentName':
            aValue = a.studentId?.name || '';
            bValue = b.studentId?.name || '';
            break;
          case 'testTitle':
            aValue = a.testTitle || '';
            bValue = b.testTitle || '';
            break;
          default:
            aValue = a[sortBy];
            bValue = b[sortBy];
        }
      } else {
        aValue = a[sortBy];
        bValue = b[sortBy];
      }

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
              labels: (Array.isArray(gradeDistribution) ? gradeDistribution : []).map(item => item.grade),
              datasets: [{
                label: 'Number of Students',
                data: (Array.isArray(gradeDistribution) ? gradeDistribution : []).map(item => item.count),
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
        {(Array.isArray(gradeDistribution) ? gradeDistribution : []).map((grade, index) => (
          <div key={index} className="grade-stat-item">
            <span className={`grade-badge grade-${(grade.grade || '').toString().toLowerCase().replace('+', 'plus')}`}>
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
        ) : (Array.isArray(recentActivity) ? recentActivity : []).length > 0 ? (
          (Array.isArray(recentActivity) ? recentActivity : []).map((activity, index) => (
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
            disabled={dashboardLoading}
          >
            {dashboardLoading ? 'Loading...' : 'Refresh All Data'}
          </button>
          <div className="last-updated">
            Last updated: {new Date().toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* Loading State */}
      {dashboardLoading ? (
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
                  labels: (Array.isArray(gradeDistribution) ? gradeDistribution : []).map(item => item.grade),
                        datasets: [{
                          label: 'Number of Students',
                      data: (Array.isArray(gradeDistribution) ? gradeDistribution : []).map(item => item.count),
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
                  {(Array.isArray(gradeDistribution) ? gradeDistribution : []).map((grade, index) => (
                      <div key={index} className="grade-stat-item">
                        <span className={`grade-badge grade-${(grade.grade || '').toString().toLowerCase().replace('+', 'plus')}`}>
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
                  ) : (Array.isArray(recentActivity) ? recentActivity : []).length > 0 ? (
                    (Array.isArray(recentActivity) ? recentActivity : []).map((activity, index) => (
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
                    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'July', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                    datasets: [{
                      label: 'Submissions',
                      data: chartData.monthly,
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
        
        {/* Test Type Selection */}
        <div className="test-type-selector">
          <button
            type="button"
            className="test-type-btn traditional-test-btn active"
            onClick={() => {}}
          >
            📄 Traditional Test
          </button>
          <button
            type="button"
            className="test-type-btn coding-test-btn"
            onClick={() => setShowCodingTestCreator(true)}
          >
            💻 Coding Test
          </button>
        </div>
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
                {CLASS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
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
                {BOARD_OPTIONS.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
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
        <div style={{ marginBottom: '1rem' }}>
  {!gdriveConnected ? (
    <button
      className="btn btn-warning"
      onClick={(e) => {
        e.preventDefault();
        handleConnectGDrive();
      }}
      type="button"
    >
      <i className="fab fa-google-drive" style={{ marginRight: 8 }} />
      Connect Google Drive
    </button>
  ) : (
    <button
      className="btn btn-success"
      disabled
      type="button"
    >
      <i className="fab fa-google-drive" style={{ marginRight: 8 }} />
      Google Drive Connected
    </button>
  )}
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

            <div className="form-group">
              <label>Maximum Violations Allowed</label>
              <input
                type="number"
                min="1"
                max="10"
                value={testForm.proctoringSettings.maxViolations}
                onChange={(e) => setTestForm({
                  ...testForm,
                  proctoringSettings: { ...testForm.proctoringSettings, maxViolations: parseInt(e.target.value) || 10 }
                })}
              />
              <small>Students will be auto-submitted after exceeding this limit (1-10)</small>
            </div>
          </div>
        </div>

        {/* Camera Monitoring Settings */}
        <div className="form-section">
          <h3>📹 Camera Monitoring Settings</h3>

          <div className="proctoring-grid">
            <div className="proctoring-option">
              <label>
                <input
                  type="checkbox"
                  checked={testForm.cameraMonitoring?.enabled || false}
                  onChange={(e) => setTestForm({
                    ...testForm,
                    cameraMonitoring: { 
                      ...testForm.cameraMonitoring, 
                      enabled: e.target.checked 
                    }
                  })}
                />
                <span className="option-content">
                  <strong>Enable Camera Monitoring</strong>
                  <small>Activate camera-based monitoring during test</small>
                </span>
              </label>
            </div>

            {testForm.cameraMonitoring?.enabled && (
              <>
                <div className="proctoring-option">
                  <label>
                    <input
                      type="checkbox"
                      checked={testForm.cameraMonitoring?.requireCameraAccess || false}
                      onChange={(e) => setTestForm({
                        ...testForm,
                        cameraMonitoring: { 
                          ...testForm.cameraMonitoring, 
                          requireCameraAccess: e.target.checked 
                        }
                      })}
                    />
                    <span className="option-content">
                      <strong>Require Camera Access</strong>
                      <small>Test won't start without camera permissions</small>
                    </span>
                  </label>
                </div>

                <div className="proctoring-option">
                  <label>
                    <input
                      type="checkbox"
                      checked={testForm.cameraMonitoring?.suspiciousActivityDetection || false}
                      onChange={(e) => setTestForm({
                        ...testForm,
                        cameraMonitoring: { 
                          ...testForm.cameraMonitoring, 
                          suspiciousActivityDetection: e.target.checked 
                        }
                      })}
                    />
                    <span className="option-content">
                      <strong>Suspicious Activity Detection</strong>
                      <small>AI-based detection of irregular behavior</small>
                    </span>
                  </label>
                </div>

                <div className="proctoring-option">
                  <label>
                    <input
                      type="checkbox"
                      checked={testForm.cameraMonitoring?.saveToGoogleDrive || false}
                      onChange={(e) => setTestForm({
                        ...testForm,
                        cameraMonitoring: { 
                          ...testForm.cameraMonitoring, 
                          saveToGoogleDrive: e.target.checked 
                        }
                      })}
                    />
                    <span className="option-content">
                      <strong>Save Photos to Google Drive</strong>
                      <small>Store monitoring images in Google Drive</small>
                    </span>
                  </label>
                </div>

                <div className="form-group">
                  <label>Photo Capture Interval</label>
                  <select
                    value={testForm.cameraMonitoring?.captureInterval || 60}
                    onChange={(e) => setTestForm({
                      ...testForm,
                      cameraMonitoring: { 
                        ...testForm.cameraMonitoring, 
                        captureInterval: parseInt(e.target.value) 
                      }
                    })}
                  >
                    <option value={30}>Every 30 seconds</option>
                    <option value={60}>Every 1 minute</option>
                    <option value={120}>Every 2 minutes</option>
                    <option value={300}>Every 5 minutes</option>
                  </select>
                  <small>How often to capture monitoring photos</small>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Paper Upload Settings */}
        <div className="form-section">
          <h3>📄 Paper Upload Settings</h3>

          <div className="proctoring-grid">
            <div className="proctoring-option">
              <label>
                <input
                  type="checkbox"
                  checked={testForm.paperSubmissionRequired || false}
                  onChange={(e) => setTestForm({
                    ...testForm,
                    paperSubmissionRequired: e.target.checked
                  })}
                />
                <span className="option-content">
                  <strong>Require Paper Submission</strong>
                  <small>Students must upload answer sheets</small>
                </span>
              </label>
            </div>

            {testForm.paperSubmissionRequired && (
              <>
                <div className="proctoring-option">
                  <label>
                    <input
                      type="checkbox"
                      checked={testForm.paperUploadAllowedDuringTest || false}
                      onChange={(e) => setTestForm({
                        ...testForm,
                        paperUploadAllowedDuringTest: e.target.checked
                      })}
                    />
                    <span className="option-content">
                      <strong>Allow Upload During Test</strong>
                      <small>Students can upload and exit early</small>
                    </span>
                  </label>
                </div>

                <div className="form-group">
                  <label>Upload Time Limit (minutes)</label>
                  <input
                    type="number"
                    min="5"
                    max="60"
                    value={testForm.paperUploadTimeLimit || 15}
                    onChange={(e) => setTestForm({
                      ...testForm,
                      paperUploadTimeLimit: parseInt(e.target.value) || 15
                    })}
                  />
                  <small>Time allowed for paper upload after test completion (5-60 minutes)</small>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Submit */}
        <div className="form-actions">
          <button
            onClick={handleUploadFiles}
            disabled={uploading || isUploaded || !gdriveConnected || (!files.questionPaper && !files.answerKey)}
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
              disabled={uploading || (!files.questionPaper && !files.answerKey)}
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
                      <div className="test-type-badge">
                        {test.type === 'coding' || test.isCodingTest ? (
                          <span className="badge coding-badge">💻 Coding Test</span>
                        ) : (
                          <span className="badge traditional-badge">📄 Traditional Test</span>
                        )}
                      </div>
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
  const renderResultsTable = () => {
    const filteredResults = filterData(results, 'results');
    const paginatedResults = paginateData(filteredResults);

    return (
      <div className="results-management">
        <div className="section-header">
          <h2>📊 Results Management</h2>
          <div className="view-toggle">
            <button
              className={`btn ${!showCodingManagement ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setShowCodingManagement(false)}
            >
              📄 All Results ({filteredResults.length})
            </button>
            <button
              className={`btn ${showCodingManagement ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setShowCodingManagement(true)}
            >
              💻 Coding Tests ({codingTests.filter(t => !t.adminReviewed).length} pending)
            </button>
          </div>
          <div className="header-actions">
            <button className="btn btn-primary">
              📤 Export Results
            </button>
            <button
              className={`btn ${bulkActionMode ? 'btn-danger' : 'btn-outline'}`}
              onClick={() => setBulkActionMode(!bulkActionMode)}
            >
              {bulkActionMode ? '✕ Cancel' : '☑️ Bulk Actions'}
            </button>
          </div>
        </div>

        {showCodingManagement ? renderCodingTestManagement() : renderRegularResults(filteredResults, paginatedResults)}

        {/* Filters Section */}
        <div className="filters-section">
          <div className="search-box">
            <input
              type="text"
              placeholder="🔍 Search results..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="filter-controls">
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
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="reviewed">Reviewed</option>
              <option value="published">Published</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>

        {/* Results Table */}
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                {bulkActionMode && <th><input type="checkbox" /></th>}
                <th>Student</th>
                <th>Test Info</th>
                <th>Type</th>
                <th>Score</th>
                <th>Status</th>
                <th>Submitted</th>
                <th>Violations</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedResults.map(r => {
                const isCodingTest = r.testId?.type === 'coding' || 
                                   r.submissionType === 'multi_question_coding' || 
                                   r.codingResults ||
                                   r.testTitle?.toLowerCase().includes('cpcode') ||
                                   r.testTitle?.toLowerCase().includes('coding') ||
                                   r.testTitle?.toLowerCase().includes('program');
                
                // Debug logging
                console.log('Result debug:', {
                  testTitle: r.testTitle,
                  testId: r.testId,
                  submissionType: r.submissionType,
                  codingResults: r.codingResults,
                  isCodingTest: isCodingTest
                });
                return (
                  <tr key={r._id}>
                    {bulkActionMode && (
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedItems.includes(r._id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedItems([...selectedItems, r._id]);
                            } else {
                              setSelectedItems(selectedItems.filter(id => id !== r._id));
                            }
                          }}
                        />
                      </td>
                    )}
                    <td>
                      <div className="student-info">
                        <div className="student-avatar">
                          {r.studentId?.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div className="student-details">
                          <h4>{r.studentId?.name || 'Unknown'}</h4>
                          <small>{r.studentId?.email || 'No email'}</small>
                          <small>Roll: {r.studentId?.rollNo || 'N/A'}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="test-info">
                        <h4>{r.testTitle || 'Unknown Test'}</h4>
                        <small>{r.testSubject || 'N/A'}</small>
                      </div>
                    </td>
                    <td>
                      <span className={`test-type-badge ${isCodingTest ? 'coding' : 'traditional'}`}>
                        {isCodingTest ? '💻 Coding' : '📄 Traditional'}
                      </span>
                    </td>
                    <td>
                      <div className="score-display">
                        {isCodingTest ? (
                          // Coding test score display
                          r.codingResults ? (
                            <div className="coding-score">
                              <div className="score-primary">
                                {r.codingResults.totalScore || r.marksObtained || 0}/{r.codingResults.maxScore || r.totalMarks || 0}
                              </div>
                              <div className="score-secondary">
                                {r.codingResults.passedTestCases || 0}/{r.codingResults.totalTestCases || 0} Tests
                              </div>
                              <div className="score-percentage">
                                {r.percentage ? `${r.percentage.toFixed(1)}%` : '0%'}
                              </div>
                            </div>
                          ) : (
                            <span className="score-pending">Processing...</span>
                          )
                        ) : (
                          // Traditional test score display
                          r.marksObtained != null ? (
                            <div className="traditional-score">
                              <div className="score-primary">
                                {r.marksObtained}/{r.totalMarks}
                              </div>
                              <div className="score-percentage">
                                {r.percentage ? `${r.percentage.toFixed(1)}%` : 
                                 r.totalMarks > 0 ? `${((r.marksObtained / r.totalMarks) * 100).toFixed(1)}%` : '0%'}
                              </div>
                            </div>
                          ) : (
                            <span className="score-pending">Pending</span>
                          )
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`status-badge status-${r.status}`}>
                        {r.status === 'pending' ? '⏳ Pending' :
                         r.status === 'reviewed' ? '👁️ Reviewed' :
                         r.status === 'published' ? '✅ Published' :
                         r.status === 'completed' ? '🏁 Completed' :
                         '❓ Unknown'}
                      </span>
                    </td>
                    <td>
                      <div className="submission-time">
                        {r.submittedAt ? new Date(r.submittedAt).toLocaleDateString('en-IN') : 'N/A'}
                        {r.submittedAt && (
                          <small>{new Date(r.submittedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</small>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="violations-display">
                        {r.violations?.length > 0 ? (
                          <span className="violations-count warning">
                            ⚠️ {r.violations.length}
                          </span>
                        ) : (
                          <span className="violations-count clean">✅ None</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="action-buttons">
                        {isCodingTest ? (
                          // Coding test actions
                          <>
                            <button
                              className="btn btn-sm btn-success"
                              title="Review & Mark Coding Test"
                              onClick={() =>
                                navigate('/admin/answer-review', { state: { fromResult: r, defaultTab: 'coding' } })
                              }
                            >
                              📝 Mark
                            </button>
                            <button
                              className="btn btn-sm btn-info"
                              title="View Coding Solutions"
                              onClick={() => navigate(`/admin/coding-review/${r._id}`)}
                            >
                              💻 Code Review
                            </button>
                            <button
                              className="btn btn-sm btn-primary"
                              title="View Details"
                              onClick={() => navigate(`/admin/result-details/${r._id}`)}
                            >
                              👁️ Details
                            </button>
                          </>
                        ) : (
                          // Traditional test actions
                          <>
                            <button
                              className="btn btn-sm btn-success"
                              title="Answer Review & Marking"
                              onClick={() =>
                                navigate('/admin/answer-review', { state: { fromResult: r } })
                              }
                            >
                              📝 Mark
                            </button>
                            {(r.answerSheetURL || r.answerSheetUrl) && (
                              <button
                                className="btn btn-sm btn-outline"
                                title="View Answer Sheet"
                                onClick={() =>
                                  window.open((r.answerSheetURL || r.answerSheetUrl), '_blank')
                                }
                              >
                                📄 Sheet
                              </button>
                            )}
                            <button
                              className="btn btn-sm btn-info"
                              title="View Details"
                              onClick={() => navigate(`/admin/result-details/${r._id}`)}
                            >
                              👁️ Details
                            </button>
                          </>
                        )}
                        {r.violations?.length > 0 && (
                          <button
                            className="btn btn-sm btn-warning"
                            title="View Violations"
                            onClick={() => navigate(`/admin/violations/${r._id}`)}
                          >
                            ⚠️ Violations
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Mobile Card Layout */}
          <div className="mobile-results-container">
            {paginatedResults.map(r => {
              const isCodingTest = r.testId?.type === 'coding' || 
                                 r.submissionType === 'multi_question_coding' || 
                                 r.codingResults ||
                                 r.testTitle?.toLowerCase().includes('cpcode') ||
                                 r.testTitle?.toLowerCase().includes('coding') ||
                                 r.testTitle?.toLowerCase().includes('program');

              return (
                <div key={`mobile-${r._id}`} className="mobile-result-card">
                  {bulkActionMode && (
                    <div className="mobile-bulk-select">
                      <input
                        type="checkbox"
                        checked={selectedItems.includes(r._id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedItems([...selectedItems, r._id]);
                          } else {
                            setSelectedItems(selectedItems.filter(id => id !== r._id));
                          }
                        }}
                      />
                    </div>
                  )}

                  <div className="mobile-result-header">
                    <div className="mobile-student-info">
                      <h4>{r.studentId?.name || 'Unknown'}</h4>
                      <small>{r.studentId?.email || 'No email'}</small>
                      <small>Roll: {r.studentId?.rollNo || 'N/A'}</small>
                    </div>
                    <span className={`test-type-badge ${isCodingTest ? 'coding' : 'traditional'}`}>
                      {isCodingTest ? '💻 Coding' : '📄 Traditional'}
                    </span>
                  </div>

                  <div className="mobile-result-body">
                    <div className="mobile-result-field">
                      <label>Test</label>
                      <div className="value">
                        <strong>{r.testTitle || 'Unknown Test'}</strong>
                        <br />
                        <small>{r.testSubject || 'N/A'}</small>
                      </div>
                    </div>

                    <div className="mobile-result-field">
                      <label>Status</label>
                      <div className="value">
                        <span className={`status-badge status-${r.status}`}>
                          {r.status === 'pending' ? '⏳ Pending' :
                           r.status === 'reviewed' ? '👁️ Reviewed' :
                           r.status === 'published' ? '✅ Published' :
                           r.status === 'completed' ? '🏁 Completed' :
                           '❓ Unknown'}
                        </span>
                      </div>
                    </div>

                    <div className="mobile-result-field">
                      <label>Submitted</label>
                      <div className="value">
                        {r.submittedAt ? (
                          <>
                            {new Date(r.submittedAt).toLocaleDateString('en-IN')}
                            <br />
                            <small>{new Date(r.submittedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</small>
                          </>
                        ) : 'N/A'}
                      </div>
                    </div>

                    <div className="mobile-result-field">
                      <label>Violations</label>
                      <div className="value">
                        {r.violations?.length > 0 ? (
                          <span className="violations-count warning">
                            ⚠️ {r.violations.length}
                          </span>
                        ) : (
                          <span className="violations-count clean">✅ None</span>
                        )}
                      </div>
                    </div>

                    <div className="mobile-score-display">
                      {isCodingTest ? (
                        r.codingResults ? (
                          <>
                            <div className="mobile-score-primary">
                              {r.codingResults.totalScore || r.marksObtained || 0}/{r.codingResults.maxScore || r.totalMarks || 0}
                            </div>
                            <div className="mobile-score-secondary">
                              {r.codingResults.passedTestCases || 0}/{r.codingResults.totalTestCases || 0} Tests Passed
                            </div>
                            <div className="mobile-score-percentage">
                              {r.percentage ? `${r.percentage.toFixed(1)}%` : '0%'}
                            </div>
                          </>
                        ) : (
                          <span className="score-pending">Processing...</span>
                        )
                      ) : (
                        r.marksObtained != null ? (
                          <>
                            <div className="mobile-score-primary">
                              {r.marksObtained}/{r.totalMarks}
                            </div>
                            <div className="mobile-score-percentage">
                              {r.percentage ? `${r.percentage.toFixed(1)}%` : 
                               r.totalMarks > 0 ? `${((r.marksObtained / r.totalMarks) * 100).toFixed(1)}%` : '0%'}
                            </div>
                          </>
                        ) : (
                          <span className="score-pending">Pending</span>
                        )
                      )}
                    </div>
                  </div>

                  <div className="mobile-actions">
                    {isCodingTest ? (
                      <>
                        <button
                          className="btn btn-sm btn-success"
                          onClick={() =>
                            navigate('/admin/answer-review', { state: { fromResult: r, defaultTab: 'coding' } })
                          }
                        >
                          📝 Mark
                        </button>
                        <button
                          className="btn btn-sm btn-info"
                          onClick={() => navigate(`/admin/coding-review/${r._id}`)}
                        >
                          💻 Code
                        </button>
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => navigate(`/admin/result-details/${r._id}`)}
                        >
                          👁️ Details
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="btn btn-sm btn-success"
                          onClick={() =>
                            navigate('/admin/answer-review', { state: { fromResult: r } })
                          }
                        >
                          📝 Mark
                        </button>
                        {(r.answerSheetURL || r.answerSheetUrl) && (
                          <button
                            className="btn btn-sm btn-outline"
                            onClick={() =>
                              window.open((r.answerSheetURL || r.answerSheetUrl), '_blank')
                            }
                          >
                            📄 Sheet
                          </button>
                        )}
                        <button
                          className="btn btn-sm btn-info"
                          onClick={() => navigate(`/admin/result-details/${r._id}`)}
                        >
                          👁️ Details
                        </button>
                      </>
                    )}
                    {r.violations?.length > 0 && (
                      <button
                        className="btn btn-sm btn-warning"
                        onClick={() => navigate(`/admin/violations/${r._id}`)}
                      >
                        ⚠️ Violations
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pagination */}
        <div className="pagination-container">
          <div className="pagination-info">
            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredResults.length)} of {filteredResults.length} results
          </div>
          <div className="pagination-controls">
            <button
              className="btn btn-sm btn-outline"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(currentPage - 1)}
            >
              ← Previous
            </button>
            <span className="page-info">Page {currentPage} of {Math.ceil(filteredResults.length / itemsPerPage) || 1}</span>
            <button
              className="btn btn-sm btn-outline"
              disabled={currentPage >= Math.ceil(filteredResults.length / itemsPerPage)}
              onClick={() => setCurrentPage(currentPage + 1)}
            >
              Next →
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Render regular results view
  const renderRegularResults = (filteredResults, paginatedResults) => (
    <>
      {/* Filters Section */}
      <div className="filters-section">
        <div className="search-box">
          <input
            type="text"
            placeholder="🔍 Search results..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="filter-controls">
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
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="done">Completed</option>
            <option value="reviewed">Reviewed</option>
          </select>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {bulkActionMode && (
        <div className="bulk-actions-bar">
          <div className="selection-info">
            <input
              type="checkbox"
              checked={selectedItems.length === filteredResults.length && filteredResults.length > 0}
              onChange={() => {
                if (selectedItems.length === filteredResults.length) {
                  setSelectedItems([]);
                } else {
                  setSelectedItems(filteredResults.map(item => item._id));
                }
              }}
            />
            <span>{selectedItems.length} of {filteredResults.length} selected</span>
          </div>
          <div className="bulk-actions">
            <button
              className="btn btn-danger"
              onClick={() => handleBulkAction('delete')}
              disabled={selectedItems.length === 0}
            >
              🗑️ Delete Selected
            </button>
            <button
              className="btn btn-warning"
              onClick={() => handleBulkAction('unpublish')}
              disabled={selectedItems.length === 0}
            >
              👁️‍🗨️ Mark Reviewed
            </button>
            <button
              className="btn btn-success"
              onClick={() => handleBulkAction('publish')}
              disabled={selectedItems.length === 0}
            >
              ✅ Publish Selected
            </button>
          </div>
        </div>
      )}

      {/* Results Table - Same as before */}
      {filteredResults.length > 0 ? (
        // Rest of the table content stays the same
        <div className="table-container">
          {/* Student Search Section */}
          <div className="student-search-section">
            <div className="search-form">
              <input
                type="email"
                placeholder="Enter student email..."
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                className="search-email-input"
              />
              <button
                onClick={handleStudentSearch}
                className="search-btn"
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
                          <div className="result-info">
                            <span className="test-title">{result.testTitle}</span>
                            <span className="score">{result.marksObtained}/{result.totalMarks}</span>
                            <span className="percentage">{((result.marksObtained / result.totalMarks) * 100).toFixed(1)}%</span>
                            <span className="date">{new Date(result.submittedAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Standard Results Table content... */}
          <table className="data-table">
            <thead>
              <tr>
                {bulkActionMode && <th><input type="checkbox" /></th>}
                <th>Student</th>
                <th>Test Info</th>
                <th>Type</th>
                <th>Score</th>
                <th>Status</th>
                <th>Submitted</th>
                <th>Violations</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedResults.map(r => {
                const isCodingTest = r.testId?.type === 'coding' || 
                                   r.submissionType === 'multi_question_coding' || 
                                   r.codingResults ||
                                   r.testTitle?.toLowerCase().includes('cpcode') ||
                                   r.testTitle?.toLowerCase().includes('coding') ||
                                   r.testTitle?.toLowerCase().includes('program');

                return (
                  <tr 
                    key={r._id}
                    className={`${r.status === 'pending' ? 'pending-row' : ''} ${selectedItems.includes(r._id) ? 'selected' : ''}`}
                  >
                    {bulkActionMode && (
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedItems.includes(r._id)}
                          onChange={() => {
                            if (selectedItems.includes(r._id)) {
                              setSelectedItems(selectedItems.filter(id => id !== r._id));
                            } else {
                              setSelectedItems([...selectedItems, r._id]);
                            }
                          }}
                        />
                      </td>
                    )}
                    <td>
                      <div className="student-info">
                        <strong>{r.studentId?.name || 'Unknown'}</strong>
                        <small>{r.studentId?.email}</small>
                        {r.studentId?.class && (
                          <span className="class-badge">{r.studentId.class}-{r.studentId.board}</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="test-info">
                        <strong>{r.testTitle}</strong>
                        <small>{r.testSubject}</small>
                      </div>
                    </td>
                    <td>
                      <span className={`type-badge ${isCodingTest ? 'coding' : 'traditional'}`}>
                        {isCodingTest ? '💻 Coding' : '📝 Traditional'}
                      </span>
                    </td>
                    <td>
                      <div className="score-display">
                        <span className="score">{r.marksObtained || 0}/{r.totalMarks || 0}</span>
                        {isCodingTest && r.codingResults && (
                          <div className="coding-score-details">
                            <div className="test-cases-summary">
                              <small className="test-cases-info">
                                {r.codingResults.passedTestCases || 0}/{r.codingResults.totalTestCases || 0} Tests
                              </small>
                            </div>
                          </div>
                        )}
                        <span className="percentage">
                          {r.totalMarks > 0 ? ((r.marksObtained / r.totalMarks) * 100).toFixed(1) : 0}%
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className={`status-badge ${
                         r.status === 'pending' ? 'warning' :
                         r.status === 'completed' || r.status === 'done' ? 'success' :
                         r.status === 'reviewed' ? 'info' :
                         r.status === 'published' ? 'info' : 'default'
                       }`}>
                        {
                         r.status === 'pending' ? '⏳ Pending' :
                         r.status === 'completed' || r.status === 'done' ? '✅ Done' :
                         r.status === 'reviewed' ? '👁️ Reviewed' :
                         r.status === 'published' ? '📢 Published' :
                         r.status
                        }
                      </span>
                    </td>
                    <td>
                      <div className="submission-info">
                        {r.submittedAt && (
                          <span>{new Date(r.submittedAt).toLocaleDateString('en-IN')}</span>
                        )}
                        {r.submittedAt && (
                          <small>{new Date(r.submittedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</small>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="violations-display">
                        {r.violations?.length > 0 ? (
                          <span className="violations-count warning">
                            ⚠️ {r.violations.length}
                          </span>
                        ) : (
                          <span className="violations-count clean">✅ None</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="action-buttons">
                        {isCodingTest ? (
                          <>
                            <button
                              className="btn btn-sm btn-success"
                              title="Review & Mark Coding Test"
                              onClick={() =>
                                navigate('/admin/answer-review', { state: { fromResult: r, defaultTab: 'coding' } })
                              }
                            >
                              📝 Mark
                            </button>
                            <button
                              className="btn btn-sm btn-info"
                              title="View Coding Solutions"
                              onClick={() => navigate(`/admin/coding-review/${r._id}`)}
                            >
                              💻 Code
                            </button>
                            <button
                              className="btn btn-sm btn-warning"
                              title="Advanced Coding Management"
                              onClick={() => {
                                setShowCodingManagement(true);
                                setCodingSearchTerm(r.studentId?.email || '');
                              }}
                            >
                              🔧 Manage
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              className="btn btn-sm btn-success"
                              title="Answer Review & Marking"
                              onClick={() =>
                                navigate('/admin/answer-review', { state: { fromResult: r } })
                              }
                            >
                              📝 Review
                            </button>
                            <button
                              className="btn btn-sm btn-primary"
                              title="View Details"
                              onClick={() => navigate(`/admin/result-details/${r._id}`)}
                            >
                              👁️ Details
                            </button>
                          </>
                        )}
                        <button
                          className="btn btn-sm btn-outline"
                          title="View violations"
                          onClick={() => {
                            Swal.fire({
                              title: 'Test Violations',
                              html: r.violations?.length > 0 ?
                                r.violations.map(v => `<p><strong>${v.type}</strong>: ${v.details || 'No details'}</p>`).join('') :
                                '<p>No violations recorded</p>',
                              icon: 'info'
                            });
                          }}
                        >
                          🚨
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="pagination-container">
            <div className="pagination-info">
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredResults.length)} of {filteredResults.length} results
            </div>
            <div className="pagination-controls">
              <button
                className="btn btn-sm btn-outline"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
              >
                ← Previous
              </button>
              <span className="page-info">Page {currentPage} of {Math.ceil(filteredResults.length / itemsPerPage) || 1}</span>
              <button
                className="btn btn-sm btn-outline"
                disabled={currentPage >= Math.ceil(filteredResults.length / itemsPerPage)}
                onClick={() => setCurrentPage(currentPage + 1)}
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="no-data">
          <p>📄 No results found matching your criteria</p>
        </div>
      )}
    </>
  );

  // Render coding test management view
  const renderCodingTestManagement = () => {
    const filteredCodingTests = getFilteredCodingTests();
    
    return (
      <div className="coding-test-management">
        <div className="coding-filters-section">
          <div className="search-box">
            <input
              type="text"
              placeholder="🔍 Search coding tests by student, email, or test title..."
              value={codingSearchTerm}
              onChange={(e) => setCodingSearchTerm(e.target.value)}
            />
          </div>
          <div className="status-filters">
            <button 
              className={`filter-btn ${codingStatusFilter === 'all' ? 'active' : ''}`}
              onClick={() => setCodingStatusFilter('all')}
            >
              All Tests ({codingTests.length})
            </button>
            <button 
              className={`filter-btn ${codingStatusFilter === 'pending' ? 'active' : ''}`}
              onClick={() => setCodingStatusFilter('pending')}
            >
              🔍 Pending Review ({codingTests.filter(t => !t.adminReviewed).length})
            </button>
            <button 
              className={`filter-btn ${codingStatusFilter === 'flagged' ? 'active' : ''}`}
              onClick={() => setCodingStatusFilter('flagged')}
            >
              🚩 Flagged ({codingTests.filter(t => t.isFlagged).length})
            </button>
            <button 
              className={`filter-btn ${codingStatusFilter === 'reviewed' ? 'active' : ''}`}
              onClick={() => setCodingStatusFilter('reviewed')}
            >
              ✅ Reviewed ({codingTests.filter(t => t.adminReviewed).length})
            </button>
          </div>
        </div>

        {codingTestsLoading ? (
          <div className="loading-spinner">Loading coding tests...</div>
        ) : filteredCodingTests.length > 0 ? (
          <div className="coding-tests-table">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Test</th>
                  <th>Score</th>
                  <th>Test Cases</th>
                  <th>Submitted</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCodingTests.map((test) => (
                  <tr key={test._id} className={test.isFlagged ? 'flagged-row' : ''}>
                    <td>
                      <div className="student-info">
                        <strong>{test.studentId?.name || 'Unknown'}</strong>
                        <small>{test.studentId?.email}</small>
                        {test.studentId?.class && (
                          <span className="class-badge">{test.studentId.class}</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="test-info">
                        <strong>{test.testTitle}</strong>
                        <small>{test.testSubject}</small>
                      </div>
                    </td>
                    <td>
                      <div className="score-display">
                        <span className="score">{test.totalScore || 0}/{test.maxScore || 0}</span>
                        <span className="percentage">
                          {test.maxScore > 0 ? ((test.totalScore / test.maxScore) * 100).toFixed(1) : 0}%
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="test-cases-info">
                        <span className={`test-cases ${(test.passedTestCases / test.totalTestCases) > 0.7 ? 'success' : 'warning'}`}>
                          {test.passedTestCases || 0}/{test.totalTestCases || 0}
                        </span>
                        <small>
                          {test.totalTestCases > 0 ? 
                            `${((test.passedTestCases / test.totalTestCases) * 100).toFixed(0)}% passed` : 
                            'No tests'
                          }
                        </small>
                      </div>
                    </td>
                    <td>
                      <div className="submission-info">
                        {test.submittedAt && (
                          <>
                            <span>{new Date(test.submittedAt).toLocaleDateString()}</span>
                            <small>{new Date(test.submittedAt).toLocaleTimeString()}</small>
                          </>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="status-badges">
                        {test.isFlagged && <span className="badge danger">🚩 Flagged</span>}
                        {test.adminReviewed ? (
                          <span className="badge success">✅ Reviewed</span>
                        ) : (
                          <span className="badge warning">🔍 Pending</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="btn btn-sm btn-success"
                          title="Modify Marks"
                          onClick={() => handleCodingMarkModification(test)}
                        >
                          📝 Mark
                        </button>
                        <button
                          className="btn btn-sm btn-info"
                          title="View Code Solutions"
                          onClick={() => navigate('/admin/answer-review', { state: { fromResult: test, defaultTab: 'coding' } })}
                        >
                          💻 Code
                        </button>
                        <button
                          className="btn btn-sm btn-warning"
                          title="Flag for Cheating"
                          onClick={() => flagCodingTestForCheating(test._id, 'Manual review required')}
                        >
                          🚩 Flag
                        </button>
                        <button
                          className="btn btn-sm btn-primary"
                          title="View Monitoring Data"
                          onClick={() => navigate(`/admin/monitoring-details/${test._id}`)}
                        >
                          👁️ Monitor
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="no-data">
            <p>💻 No coding tests found matching your criteria</p>
          </div>
        )}

        {/* Mark Modification Modal */}
        {showCodingMarkModal && selectedCodingTest && (
          <div className="modal-overlay" onClick={() => setShowCodingMarkModal(false)}>
            <div className="modal-content coding-mark-modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>📝 Modify Coding Test Marks</h3>
                <button 
                  className="close-btn" 
                  onClick={() => setShowCodingMarkModal(false)}
                >
                  ×
                </button>
              </div>
              <div className="modal-body">
                <div className="student-test-info">
                  <h4>{selectedCodingTest.studentId?.name}</h4>
                  <p>{selectedCodingTest.testTitle}</p>
                </div>
                
                <div className="marks-form">
                  <div className="form-group">
                    <label>Total Score</label>
                    <input
                      type="number"
                      value={modifiedMarks.totalScore || 0}
                      onChange={(e) => setModifiedMarks({
                        ...modifiedMarks,
                        totalScore: parseInt(e.target.value) || 0
                      })}
                      min="0"
                      max={selectedCodingTest.maxScore || 100}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Admin Notes</label>
                    <textarea
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      placeholder="Add notes about mark modifications..."
                      rows={4}
                    />
                  </div>
                  
                  <div className="cheating-flags">
                    <h4>🚩 Flagging Options</h4>
                    <label>
                      <input
                        type="checkbox"
                        checked={cheatingFlags.timeViolation || false}
                        onChange={(e) => setCheatingFlags({
                          ...cheatingFlags,
                          timeViolation: e.target.checked
                        })}
                      />
                      Time Violation
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={cheatingFlags.codePatterns || false}
                        onChange={(e) => setCheatingFlags({
                          ...cheatingFlags,
                          codePatterns: e.target.checked
                        })}
                      />
                      Suspicious Code Patterns
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={cheatingFlags.behaviorAnomaly || false}
                        onChange={(e) => setCheatingFlags({
                          ...cheatingFlags,
                          behaviorAnomaly: e.target.checked
                        })}
                      />
                      Behavior Anomaly
                    </label>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  className="btn btn-outline" 
                  onClick={() => setShowCodingMarkModal(false)}
                >
                  Cancel
                </button>
                <button 
                  className="btn btn-success" 
                  onClick={saveCodingMarkModifications}
                >
                  💾 Save Changes
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

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

      {/* Grade Distribution Chart */}
      {renderGradeDistribution()}

      {/* Recent Activity */}
      {renderRecentActivity()}
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
    <div className={`admin-dashboard ${darkMode ? 'dark' : 'light'} ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${mobileMenuOpen ? 'mobile-menu-open' : ''}`}>
      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div 
          className="mobile-sidebar-overlay" 
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`admin-sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo">
            <span className="logo-icon">🎓</span>
            <span className="logo-text">AucTutor</span>
          </div>
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            {sidebarCollapsed ? '→' : '←'}
          </button>
          {/* Mobile Close Button */}
          <button
            className="mobile-close-btn"
            onClick={() => setMobileMenuOpen(false)}
          >
            ✕
          </button>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section">
            <span className="nav-section-title">Main</span>
            <button
              className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('dashboard');
                setMobileMenuOpen(false);
              }}
            >
              <span className="nav-icon">📊</span>
              <span className="nav-text">Dashboard</span>
            </button>
            <button
              className={`nav-item ${activeTab === 'analytics' ? 'active' : ''}`}
              onClick={() => {
                navigate('/admin/analytics');
                setMobileMenuOpen(false);
              }}
            >
              <span className="nav-icon">📈</span>
              <span className="nav-text">Analytics</span>
            </button>
          </div>

          <div className="nav-section">
            <span className="nav-section-title">Management</span>
            <button
              className={`nav-item ${activeTab === 'create-test' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('create-test');
                setMobileMenuOpen(false);
              }}
            >
              <span className="nav-icon">➕</span>
              <span className="nav-text">Create Test</span>
            </button>
            <button
              className={`nav-item ${activeTab === 'tests' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('tests');
                setMobileMenuOpen(false);
              }}
            >
              <span className="nav-icon">📝</span>
              <span className="nav-text">Tests</span>
            </button>
            <button
              className={`nav-item ${activeTab === 'students' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('students');
                setMobileMenuOpen(false);
              }}
            >
              <span className="nav-icon">👥</span>
              <span className="nav-text">Students</span>
            </button>
            <button
              className={`nav-item ${activeTab === 'results' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('results');
                setMobileMenuOpen(false);
              }}
            >
              <span className="nav-icon">📊</span>
              <span className="nav-text">Results</span>
            </button>
            <button
              className={`nav-item ${activeTab === 'analytics' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('analytics');
                setMobileMenuOpen(false);
              }}
            >
              <span className="nav-icon">📈</span>
              <span className="nav-text">Analytics</span>
            </button>
            <button
              className={`nav-item ${activeTab === 'promotions' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('promotions');
                setMobileMenuOpen(false);
              }}
            >
              <span className="nav-icon">📢</span>
              <span className="nav-text">Promotions</span>
            </button>
            <button
              className={`nav-item ${activeTab === 'manual-entry' ? 'active' : ''}`}
              onClick={() => {
                navigate('/admin/manual-entry');
                setMobileMenuOpen(false);
              }}
            >
              <span className="nav-icon">📋</span>
              <span className="nav-text">Manual Entry</span>
            </button>
            <button
              className={`nav-item ${activeTab === 'coding-practice' ? 'active' : ''}`}
              onClick={() => {
                navigate('/admin/coding-practice');
                setMobileMenuOpen(false);
              }}
            >
              <span className="nav-icon">💻</span>
              <span className="nav-text">Coding Practice</span>
            </button>
          </div>

          <div className="nav-section">
            <span className="nav-section-title">System</span>
            <button
              className={`nav-item ${activeTab === 'notifications' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('notifications');
                setMobileMenuOpen(false);
              }}
            >
              <span className="nav-icon">📢</span>
              <span className="nav-text">Notifications</span>
            </button>
            <button
              className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('settings');
                setMobileMenuOpen(false);
              }}
            >
              <span className="nav-icon">⚙️</span>
              <span className="nav-text">Settings</span>
            </button>
            <button
              className={`nav-item ${activeTab === 'oauth-settings' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('oauth-settings');
                setMobileMenuOpen(false);
              }}
            >
              <span className="nav-icon">🔐</span>
              <span className="nav-text">OAuth Config</span>
            </button>
            <button
              className={`nav-item ${activeTab === 'mobile-upload' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('mobile-upload');
                setMobileMenuOpen(false);
              }}
            >
              <span className="nav-icon">📱</span>
              <span className="nav-text">Mobile Upload</span>
            </button>
          </div>
        </nav>

        <div className="sidebar-footer">
          {/* Mobile Theme Toggle */}
          <div className="mobile-theme-toggle">
            <button
              className="theme-toggle-mobile"
              onClick={() => {
                setDarkMode(!darkMode);
                setMobileMenuOpen(false);
              }}
              title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              <span className="theme-icon">{darkMode ? '☀️' : '🌙'}</span>
              <span className="theme-text">
                {darkMode ? 'Light Mode' : 'Dark Mode'}
              </span>
              <span className="theme-status">
                {darkMode ? '(Active: Dark)' : '(Active: Light)'}
              </span>
            </button>
          </div>

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
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
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
              {activeTab === 'promotions' && '📢 Promotions Management'}
              {activeTab === 'notifications' && '📢 Notification Center'}
              {activeTab === 'settings' && '⚙️ System Settings'}
              {activeTab === 'oauth-settings' && '🔐 OAuth Configuration'}
              {activeTab === 'mobile-upload' && '📱 Mobile Upload Manager'}
            </h1>
          </div>

          <div className="header-right">
            <button
              className={`header-btn notification-btn ${activeTab === 'notifications' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('notifications');
                setMobileMenuOpen(false);
              }}
              title="View Notifications"
            >
              🔔
              <span className="notification-badge">3</span>
            </button>

            <button
              className="header-btn theme-toggle"
              onClick={() => {
                setDarkMode(!darkMode);
                setMobileMenuOpen(false);
              }}
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
          {activeTab === 'promotions' && <PromotionsManager />}
          {activeTab === 'notifications' && <NotificationCenter />}
          {activeTab === 'settings' && <NotificationSettings />}
          {activeTab === 'oauth-settings' && <OAuthSettings />}
          {activeTab === 'mobile-upload' && <MobileUploadManager />}
        </div>
        
        {/* Coding Test Creator Modal */}
        {showCodingTestCreator && (
          <CodingTestCreator
            onClose={() => setShowCodingTestCreator(false)}
            onTestCreated={(newTest) => {
              setTests(prev => [newTest, ...prev]);
              setShowCodingTestCreator(false);
              toast.success('🚀 Coding test created successfully!');
              // Switch to tests tab to see the created test
              setActiveTab('tests');
            }}
          />
        )}
      </main>
      <ExampleBox />
    </div>
  );

};

export default AdminDashboard;