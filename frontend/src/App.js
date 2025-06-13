// src/App.js

import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import axios from 'axios';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';
import ReviewRequestPage from './components/student/ReviewRequestPage';
import QuestionWiseResults from './components/student/QuestionWiseResults';
import Header from './components/Header';
import Login from './components/Login';
import AdminDashboard from './components/admin/AdminDashboard';
import AnswerSheetReview from './components/admin/AnswerSheetReview';
import EditTestPage from './components/admin/EditTestPage';
import StudentDetail from './components/admin/StudentDetail';
import EditStudentPage from './components/admin/EditStudentPage';
import StudentDashboard from './components/student/StudentDashboard';
import TestInterface from './components/student/TestInterface';
import ResultDetail from './components/student/ResultDetail';
import LoadingSpinner from './components/LoadingSpinner';

// Set axios base URL
axios.defaults.baseURL = 'https://computech-exam-platform.onrender.com';
axios.defaults.withCredentials = true;
// Auth & Theme contexts
const AuthContext = createContext();
const ThemeContext = createContext();

export const useAuth = () => useContext(AuthContext);
export const useTheme = () => useContext(ThemeContext);

// Auth Provider
function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const verifyToken = useCallback(async token => {
    try {
      const res = await axios.get('/api/auth/verify', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) setUser(res.data.user);
      else localStorage.removeItem('token');
    } catch {
      localStorage.removeItem('token');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) verifyToken(token);
    else setLoading(false);

    const reqI = axios.interceptors.request.use(cfg => {
      const t = localStorage.getItem('token');
      if (t) cfg.headers.Authorization = `Bearer ${t}`;
      return cfg;
    });
    const resI = axios.interceptors.response.use(
      r => r,
      err => {
        if (err.response?.status === 401) {
          localStorage.removeItem('token');
          setUser(null);
          toast.error('Session expired. Please login again.');
        }
        return Promise.reject(err);
      }
    );
    return () => {
      axios.interceptors.request.eject(reqI);
      axios.interceptors.response.eject(resI);
    };
  }, [verifyToken]);

  const login = async (email, password) => {
    try {
      const { data } = await axios.post('/api/auth/login', { email, password });
      if (data.success) {
        localStorage.setItem('token', data.token);
        setUser(data.user);
        toast.success(`Welcome ${data.user.name}!`);
        return true;
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    }
    return false;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    toast.info('Logged out');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

// Theme Provider
function ThemeProvider({ children }) {
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  return (
    <ThemeContext.Provider value={{ darkMode, toggleTheme: () => setDarkMode(dm => !dm) }}>
      {children}
    </ThemeContext.Provider>
  );
}

// Shows Header, Outlet for nested routes, and Toasts
function AppLayout() {
  return (
    <>
      <Header />
      <main className="main-content">
        <Outlet />
      </main>
      <ToastContainer position="bottom-right" autoClose={3000} theme="colored" />
    </>
  );
}

// Redirects if already logged in
function LoginRoute() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (user) return <Navigate to={user.role === 'admin' ? '/admin' : '/student'} replace />;
  return <Login />;
}

// Guards routes based on auth & role
function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/student" replace />;
  return children;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>

            {/* Public login */}
            <Route path="/login" element={<LoginRoute />} />

            {/* Protected app layout */}
            <Route path="/" element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }>
              <Route
                path="/result/:resultId"
                element={
                  <ProtectedRoute>
                    <ResultDetail />
                  </ProtectedRoute>
                }
              />
               <Route index element={<Navigate to="/admin" replace />} />
              {/* Admin section */}
              <Route path="admin" element={<ProtectedRoute adminOnly><Outlet /></ProtectedRoute>}>
                <Route index element={<AdminDashboard />} />
                <Route path="tests" element={<AdminDashboard />} />
                <Route path="tests/edit/:id" element={<EditTestPage />} />
                <Route path="answer-review" element={<AnswerSheetReview />} />
                <Route path="students/:id" element={<StudentDetail />} />
                <Route path="students/edit/:id" element={<EditStudentPage />} />
              </Route>

              {/* Student section */}
              <Route path="student" element={<ProtectedRoute><Outlet /></ProtectedRoute>}>
                <Route index element={<StudentDashboard />} />
                <Route path="test/:testId" element={<TestInterface />} />
                <Route path="result/:resultId" element={<ResultDetail />} />
                <Route path="/student/request-review/:resultId" element={<ReviewRequestPage />} />
                <Route path="/student/result/:resultId/breakdown" element={<QuestionWiseResults />} />
              </Route>

              {/* Fallback to admin or student dashboard */}
              <Route path="*" element={<Navigate to="/" replace />} />

            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
