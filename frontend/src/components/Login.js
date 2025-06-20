import React, { useState } from 'react';
import { useAuth }      from '../App';
import { useNavigate, Navigate } from 'react-router-dom';

import { ToastContainer, toast } from 'react-toastify';     // ← NEW
import 'react-toastify/dist/ReactToastify.css';             // ← NEW

const Login = () => {
  const { login, user } = useAuth();
  const navigate = useNavigate();

  const [credentials, setCredentials] = useState({ email: '', password: '' });
  const [loading,     setLoading]     = useState(false);

  /* already logged-in? bounce */
  if (user) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/student'} replace />;
  }

  /* ---------------------------------------------------------------- */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await login(credentials.email, credentials.password);

      if (result?.success) {
        toast.dismiss();                                     // clear old errors
        toast.success('Login successful 🎉', { autoClose: 2000 });
        navigate(result.user.role === 'admin' ? '/admin' : '/student');
      } else {
        /* result could be null or { success:false, message:'…' }   */
        toast.error(result?.message || 'Invalid email / password');
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Server error. Try again.');
    } finally {
      setLoading(false);
    }
  };
  /* ---------------------------------------------------------------- */

  return (
    <div className="login-container">
      <div className="login-card card">
        <div className="login-header">
          <h2>Welcome Back!</h2>
          <p>Sign in to CompuTech Exam Platform</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="form-control"
              placeholder="Enter your email"
              value={credentials.email}
              onChange={e => setCredentials({ ...credentials, email: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-control"
              placeholder="Enter your password"
              value={credentials.password}
              onChange={e => setCredentials({ ...credentials, password: e.target.value })}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary w-100"
            disabled={loading}
          >
            {loading ? 'Signing In…' : 'Sign In'}
          </button>
        </form>

        {/* Links */}
        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Don&apos;t have an account?{' '}
            <a
              href="https://computech-07f0.onrender.com/signup.html"
              style={{ color: 'var(--primary)', textDecoration: 'none' }}
            >
              Sign up here
            </a>
          </p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
            Forgot password?{' '}
            <a
              href="https://computech-07f0.onrender.com/forget-password.html"
              style={{ color: 'var(--primary)', textDecoration: 'none' }}
            >
              Reset here
            </a>
          </p>
        </div>
      </div>

      {/* Toast outlet – keep once at root or per page */}
      <ToastContainer position="top-right" theme="colored" />   {/* ← NEW */}
    </div>
  );
};

export default Login;
