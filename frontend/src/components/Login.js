import React, { useState } from 'react';
import { useAuth } from '../App';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './Login.css';

const Login = () => {
  const { login, user } = useAuth();
  const navigate = useNavigate();

  const [credentials, setCredentials] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  /* already logged-in? bounce */
  if (user) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/student'} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await login(credentials.email, credentials.password);

      if (result?.success) {
        // Show success message with SweetAlert
        await Swal.fire({
          icon: 'success',
          title: 'Login Successful!',
          text: `Welcome back, ${result.user.name || 'User'}!`,
          timer: 2000,
          showConfirmButton: false,
          background: 'var(--bg-primary)',
          color: 'var(--text-primary)'
        });
        navigate(result.user.role === 'admin' ? '/admin' : '/student');
      } else {
        // Show error with SweetAlert for incorrect credentials
        await Swal.fire({
          icon: 'error',
          title: 'Login Failed',
          text: result?.message || 'Invalid email or password. Please check your credentials and try again.',
          confirmButtonText: 'Try Again',
          background: 'var(--bg-primary)',
          color: 'var(--text-primary)',
          confirmButtonColor: 'var(--primary)'
        });
        

      }
    } catch (err) {
      // Show server error with SweetAlert
      const errorMessage = err?.response?.data?.message || 'Server error. Please try again later.';
      await Swal.fire({
        icon: 'error',
        title: 'Connection Error',
        text: errorMessage,
        html: `
          <p>${errorMessage}</p>
          <small style="color: var(--text-secondary);">
            If this problem persists, please contact support.
          </small>
        `,
        confirmButtonText: 'Retry',
        background: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        confirmButtonColor: 'var(--primary)'
      });
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
          <p>Sign in to AucTutor Exam Platform</p>
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
        <div className="login-links">
          <p>
            Don&apos;t have an account?{' '}
            {process.env.REACT_APP_SIGNUP_URL ? (
              <a href={process.env.REACT_APP_SIGNUP_URL} target="_blank" rel="noreferrer" className="link">Sign up here</a>
            ) : (
              <Link to="/signup" className="link">Sign up here</Link>
            )}
          </p>
          <p>
            Forgot password?{' '}
            {process.env.REACT_APP_FORGOT_PASSWORD_URL ? (
              <a href={process.env.REACT_APP_FORGOT_PASSWORD_URL} target="_blank" rel="noreferrer" className="link">Reset here</a>
            ) : (
              <Link to="/forgot-password" className="link">Reset here</Link>
            )}
          </p>
        </div>
      </div>

      {/* Toast outlet – keep once at root or per page */}
      <ToastContainer position="top-right" theme="colored" />   {/* ← NEW */}
    </div>
  );
};

export default Login;
