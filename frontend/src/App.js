// src/App.js

import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { ToastContainer, toast } from 'react-toastify';
import { Analytics as VercelAnalytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import axios from 'axios';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';
import ReviewRequestPage from './components/student/ReviewRequestPage';
import QuestionWiseResults from './components/student/QuestionWiseResults';
import StudentCodeReview from './components/student/StudentCodeReview';
import Header from './components/Header';
import Login from './components/Login';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';
import LandingPage from './components/LandingPage';
import AdminDashboard from './components/admin/AdminDashboard';
import AnswerSheetReview from './components/admin/AnswerSheetReview';
import EditTestPage from './components/admin/EditTestPage';
import StudentDetail from './components/admin/StudentDetail';
import EditStudentPage from './components/admin/EditStudentPage';
import ManualTestEntry from './components/admin/ManualTestEntry';
import CodingTestReview from './components/admin/CodingTestReview';
import CodingPracticeAdmin from './components/admin/CodingPracticeAdmin';
import StudentDashboard from './components/student/StudentDashboard';
import TestInterface from './components/student/TestInterface';
import TraditionalTestInterface from './components/student/TraditionalTestInterface';
import CodingTestInterface from './components/student/CodingTestInterface';
import CodingPracticeContainer from './components/student/CodingPracticeContainer';
import CodingInterface from './components/student/CodingInterface';
import ResultDetail from './components/student/ResultDetail';
import LoadingSpinner from './components/LoadingSpinner';
import Analytics from './components/admin/Analytics';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import offlineHandler from './utils/offlineHandler';
import autoRefreshManager from './utils/autoRefresh';
import MockTestCreator from './components/student/MockTestCreator';
import MobileUploadInterface from './components/mobile/MobileUploadInterface';
import { useDevToolsProtection } from './hooks/useDevToolsProtection'; // Security protection

// Set axios base URL
// In production, use same-origin so /api hits Vercel serverless functions under the same domain
// In development, point to local backend or REACT_APP_API_URL if provided
const DEFAULT_LOCAL_API = 'http://localhost:5000';
const apiBase = process.env.NODE_ENV === 'production'
  ? ''
  : (process.env.REACT_APP_API_URL || DEFAULT_LOCAL_API);
axios.defaults.baseURL = apiBase;
axios.defaults.withCredentials = true;
// Change to your server URL


// Auth & Theme contexts
const AuthContext = createContext();
const ThemeContext = createContext();

export const useAuth = () => useContext(AuthContext);
export const useTheme = () => useContext(ThemeContext);

// ✅ Enhanced Auth Provider with complete user data persistence
function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  const verifyToken = useCallback(async token => {
    try {
      const res = await axios.get('/api/auth/verify', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.data.success) {
        const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
        const verifiedUser = res.data.user;
        
        const completeUser = {
          ...storedUser,
          ...verifiedUser,
          name: storedUser.name || verifiedUser.name,
          class: storedUser.class,
          board: storedUser.board,
          rollNo: storedUser.rollNo,
          school: storedUser.school
        };
        
        setUser(completeUser);
        console.log('✅ Session restored:', completeUser);
      } else {
        throw new Error('Token verification failed');
      }
    } catch (error) {
      console.log('❌ Token verification failed:', error.message);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
    } finally {
      setLoading(false);
      setAuthChecked(true);
    }
  }, []);

  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('token');
      const userData = localStorage.getItem('user');
      
      if (token && userData) {
        console.log('🔍 Found stored auth data, verifying...');
        await verifyToken(token);
      } else {
        console.log('🔍 No stored auth data found');
        setLoading(false);
        setAuthChecked(true);
      }
    };

    initializeAuth();

    // Set up periodic token refresh every 6 days (before 7-day expiration)
    const refreshInterval = setInterval(async () => {
      const token = localStorage.getItem('token');
      if (token && user) {
        try {
          const response = await axios.post('/api/auth/refresh', {}, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          if (response.data.success) {
            localStorage.setItem('token', response.data.token);
            console.log('✅ Token auto-refreshed');
          }
        } catch (error) {
          console.log('❌ Auto token refresh failed:', error);
        }
      }
    }, 6 * 24 * 60 * 60 * 1000); // 6 days in milliseconds

    // ✅ Add offline request handling
  const reqI = axios.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem('token');
      console.log('🔍 Request interceptor:', {
        url: config.url,
        hasToken: !!token,
        tokenPreview: token ? `${token.slice(0, 10)}...` : 'none'
      });
      
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      } else {
        console.log('⚠️ No token found in localStorage for request:', config.url);
      }
      
      // ✅ Check if offline and handle accordingly
      if (!offlineHandler.getOnlineStatus()) {
        console.log('📡 Request attempted while offline:', config.url);
        // You can modify this behavior based on your needs
      }
      
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  const resI = axios.interceptors.response.use(
    (response) => {
      console.log('✅ Successful response:', {
        url: response.config.url,
        status: response.status
      });
      return response;
    },
    (error) => {
      console.log('❌ Response error:', {
        url: error.config?.url,
        status: error.response?.status,
        message: error.response?.data?.message || error.message
      });

      // ✅ Handle network errors when offline
      if (!navigator.onLine) {
        console.log('🔴 Network request failed - app is offline');
        toast.error('Unable to connect. Please check your internet connection.');
      } else if (error.response?.status === 401) {
        console.log('🔒 Unauthorized request detected, attempting token refresh');
        
        // Try to refresh token before logging out
        const refreshToken = async () => {
          try {
            const currentToken = localStorage.getItem('token');
            if (currentToken) {
              const response = await axios.post('/api/auth/refresh', {}, {
                headers: { Authorization: `Bearer ${currentToken}` }
              });
              
              if (response.data.success) {
                localStorage.setItem('token', response.data.token);
                console.log('✅ Token refreshed successfully');
                // Retry the original request
                return axios.request(error.config);
              }
            }
          } catch (refreshError) {
            console.log('❌ Token refresh failed:', refreshError);
          }
          
          // If refresh fails, logout
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setUser(null);
          toast.error('Session expired. Please login again.');
          return Promise.reject(error);
        };
        
        return refreshToken();
      }
      return Promise.reject(error);
    }
  );

  return () => {
    axios.interceptors.request.eject(reqI);
    axios.interceptors.response.eject(resI);
    clearInterval(refreshInterval);
  };

  }, [verifyToken]);

  // inside AuthProvider
const login = async (email, password) => {
  try {
    console.log('🔍 Login attempt - Base URL:', axios.defaults.baseURL);
    console.log('🔍 Environment:', process.env.NODE_ENV);

    // Keep endpoint with '/api/...'; baseURL is '' in prod, 'http://localhost:5000' in dev
    const { data } = await axios.post('/api/auth/login', { email, password });

    if (data.success) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
      return { success: true, user: data.user };
    }
    return { success: false, message: data.message || 'Login failed' };
  } catch (err) {
    console.error('Login error:', err?.response?.data || err.message);
    return { success: false, message: 'Server error. Try again.' };
  }
};

  const logout = () => {
    console.log('🚪 Logging out user');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    toast.success('Logged out successfully');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, authChecked }}>
      {children}
    </AuthContext.Provider>
  );
}

// ✅ Enhanced Theme Provider
function ThemeProvider({ children }) {
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    document.body.className = darkMode ? 'dark-theme' : 'light-theme';
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const toggleTheme = () => {
    setDarkMode(dm => !dm);
  };

  return (
    <ThemeContext.Provider value={{ darkMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// ✅ App Layout WITH Header (for most routes)
function AppLayoutWithHeader() {
  return (
    <>
      <Header />
      <main className="main-content">
        <Outlet />
      </main>
      <ToastContainer 
        position="top-right" 
        autoClose={4000} 
        theme="colored"
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        limit={3}
        toastStyle={{
          fontSize: '14px',
          borderRadius: '8px',
          zIndex: 9999
        }}
      />
    </>
  );
}

// ✅ App Layout WITHOUT Header (for TestInterface)
function AppLayoutWithoutHeader() {
  return (
    <>
      <main className="main-content-full">
        <Outlet />
      </main>
      <ToastContainer 
        position="top-right" 
        autoClose={4000} 
        theme="colored"
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        limit={3}
        toastStyle={{
          fontSize: '14px',
          borderRadius: '8px',
          zIndex: 9999
        }}
      />
    </>
  );
}

// ✅ Enhanced LoginRoute with proper loading states
function LoginRoute() {
  const { user, loading, authChecked } = useAuth();
  
  if (loading || !authChecked) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white'
      }}>
        <LoadingSpinner 
          text="Loading AucTutor Exam Platform..." 
          size="large"
          color="primary"
        />
      </div>
    );
  }
  
  if (user) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/student'} replace />;
  }
  
  return <Login />;
}



// ✅ Enhanced ProtectedRoute
function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading, authChecked } = useAuth();
  
  if (loading || !authChecked) {
    return <LoadingSpinner text="Verifying access..." />;
  }
  
  if (!user) {
    console.log('🔒 Protected route accessed without authentication, redirecting to login');
    return <Navigate to="/login" replace />;
  }
  
  if (adminOnly && user.role !== 'admin') {
    console.log('🚫 Non-admin user attempted to access admin route, redirecting to student dashboard');
    return <Navigate to="/student" replace />;
  }
  
  return children;
}

// ✅ Smart redirect based on user role
function SmartRedirect() {
  const { user } = useAuth();
  // If this is a direct request for sitemap or static file, let the server handle it
  if (typeof window !== 'undefined' && window.location && window.location.pathname.startsWith('/sitemap.xml')) {
    return null; // allow the static file to be served
  }
  
  if (user) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/student'} replace />;
  }
  
  return <LandingPage />;
}

// ✅ Universal redirect for any unmatched URL - ensures landing page for unauthenticated
function UniversalRedirect() {
  const { user, loading, authChecked } = useAuth();
  
  if (loading || !authChecked) {
    return <LoadingSpinner text="Loading..." />;
  }
  
  if (!user) {
    console.log('🔒 Unauthorized access to unknown route, redirecting to landing page');
    // If requesting sitemap or static content, do not redirect
    if (typeof window !== 'undefined' && window.location && window.location.pathname.startsWith('/sitemap.xml')) {
      return null;
    }
    return <Navigate to="/" replace />;
  }
  
  // If user is authenticated but hits unknown route, redirect to their dashboard
  return <Navigate to={user.role === 'admin' ? '/admin' : '/student'} replace />;
}

export default function App() {
  // Initialize auto-refresh manager
  useEffect(() => {
    // Make toast available globally for auto-refresh manager
    window.toast = toast;
    
    // Initialize auto-refresh
    console.log('🔄 Auto-refresh manager initialized');
  }, []);

  // Initialize DevTools protection for the entire application
  const { getViolationCount } = useDevToolsProtection({
    enabled: true,
    maxViolations: 5,
    onViolation: (violation) => {
      console.warn('🔒 Security violation detected:', violation);
      
      // Log security violations to server if needed
      try {
        axios.post('/api/security/violation', {
          type: violation.type,
          timestamp: violation.timestamp,
          userAgent: violation.userAgent,
          url: violation.url
        }).catch(() => {
          // Ignore server errors for security logging
        });
      } catch (e) {
        // Ignore errors in violation reporting
      }
    }
  });

  useEffect(() => {
    // ✅ Actually initialize the offline handler
    const cleanup = offlineHandler.init();
    console.log('✅ Offline handler initialized');
    
    // ✅ Return cleanup function
    return cleanup;
  }, []);

  return (
    <>
    <HelmetProvider>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
          <PWAInstallPrompt />
          <Routes>

            {/* ✅ Public routes - homepage, login */}
            <Route path="/" element={<SmartRedirect />} />
            <Route path="/login" element={<LoginRoute />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* ✅ PROTECTED ROUTES: Traditional TestInterface WITHOUT Header */}
            <Route path="/student/test/:testId" element={
              <ProtectedRoute>
                <AppLayoutWithoutHeader />
              </ProtectedRoute>
            }>
              <Route index element={<TraditionalTestInterface />} />
            </Route>

            {/* ✅ PROTECTED ROUTES: Legacy TestInterface WITHOUT Header (for backward compatibility) */}
            <Route path="/student/legacy-test/:testId" element={
              <ProtectedRoute>
                <AppLayoutWithoutHeader />
              </ProtectedRoute>
            }>
              <Route index element={<TestInterface />} />
            </Route>

            {/* ✅ PROTECTED ROUTES: CodingTestInterface WITHOUT Header */}
            <Route path="/student/coding-test/:testId" element={
              <ProtectedRoute>
                <AppLayoutWithoutHeader />
              </ProtectedRoute>
            }>
              <Route index element={<CodingTestInterface />} />
            </Route>

            {/* ✅ PROTECTED ROUTES: CodingInterface WITHOUT Header */}
            <Route path="/student/coding-interface/:problemId" element={
              <ProtectedRoute>
                <AppLayoutWithoutHeader />
              </ProtectedRoute>
            }>
              <Route index element={<CodingInterface />} />
            </Route>

            {/* ✅ PROTECTED ROUTES: All dashboard routes WITH Header */}
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <AppLayoutWithHeader />
              </ProtectedRoute>
            }>
              {/* Smart default redirect based on user role for protected dashboard */}
              <Route index element={<SmartRedirect />} />
              


            </Route>

            {/* ✅ ADMIN ROUTES WITH Header */}
            <Route path="/admin" element={
              <ProtectedRoute adminOnly>
                <AppLayoutWithHeader />
              </ProtectedRoute>
            }>
              <Route index element={<AdminDashboard />} />
              <Route path="tests" element={<AdminDashboard />} />
              <Route path="tests/edit/:id" element={<EditTestPage />} />
              <Route path="answer-review" element={<AnswerSheetReview />} />
              <Route path="manual-entry" element={<ManualTestEntry />} />
              <Route path="students/:id" element={<StudentDetail />} />
              <Route path="students/edit/:id" element={<EditStudentPage />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="coding-review/:resultId" element={<CodingTestReview />} />
              <Route path="result-details/:resultId" element={<ResultDetail />} />
              <Route path="coding-practice" element={<CodingPracticeAdmin />} />
            </Route>

            {/* ✅ STUDENT ROUTES WITH Header */}
            <Route path="/student" element={
              <ProtectedRoute>
                <AppLayoutWithHeader />
              </ProtectedRoute>
            }>
              <Route index element={<StudentDashboard />} />
              <Route path="mock-test" element={<MockTestCreator />} />
              <Route path="coding-practice" element={<CodingPracticeContainer />} />
              <Route path="result/:resultId" element={<ResultDetail />} />
              <Route path="result/:resultId/code-review" element={<StudentCodeReview />} />
              <Route path="request-review/:resultId" element={<ReviewRequestPage />} />
              <Route path="result/:resultId/breakdown" element={<QuestionWiseResults />} />
            </Route>

            {/* Global result route for backward compatibility */}
            <Route path="/result/:resultId" element={
              <ProtectedRoute>
                <AppLayoutWithHeader />
              </ProtectedRoute>
            }>
              <Route index element={<ResultDetail />} />
            </Route>

            {/* Mobile Upload Interface - Public route with token validation */}
            <Route path="/mobile-upload/:token" element={<MobileUploadInterface />} />

            {/* ✅ UNIVERSAL CATCH-ALL: Any unmatched URL redirects to login if not authenticated */}
            <Route path="*" element={<UniversalRedirect />} />

          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
    </HelmetProvider>
      <VercelAnalytics />
      <SpeedInsights />
    </>
  );
}
