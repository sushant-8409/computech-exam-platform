import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import axios from 'axios';
import './ResetPassword.css';

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState('');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const tokenParam = searchParams.get('token');
    if (!tokenParam) {
      Swal.fire({
        icon: 'error',
        title: 'Invalid Reset Link',
        text: 'This reset link is invalid or has expired.',
        confirmButtonText: 'Go to Login',
        background: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        confirmButtonColor: 'var(--primary)'
      }).then(() => {
        navigate('/login');
      });
      return;
    }
    setToken(tokenParam);
  }, [searchParams, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!password || !confirmPassword) {
      await Swal.fire({
        icon: 'warning',
        title: 'Missing Information',
        text: 'Please fill in all fields.',
        confirmButtonText: 'OK',
        background: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        confirmButtonColor: 'var(--primary)'
      });
      return;
    }

    if (password.length < 6) {
      await Swal.fire({
        icon: 'warning',
        title: 'Password Too Short',
        text: 'Password must be at least 6 characters long.',
        confirmButtonText: 'OK',
        background: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        confirmButtonColor: 'var(--primary)'
      });
      return;
    }

    if (password !== confirmPassword) {
      await Swal.fire({
        icon: 'warning',
        title: 'Passwords Don\'t Match',
        text: 'Please make sure both passwords match.',
        confirmButtonText: 'OK',
        background: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        confirmButtonColor: 'var(--primary)'
      });
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post('/api/reset-password', {
        token,
        newPassword: password
      });

      if (response.data.success) {
        await Swal.fire({
          icon: 'success',
          title: 'Password Reset Successful!',
          text: response.data.message,
          confirmButtonText: 'Go to Login',
          background: 'var(--bg-primary)',
          color: 'var(--text-primary)',
          confirmButtonColor: 'var(--primary)'
        });
        navigate('/login');
      } else {
        await Swal.fire({
          icon: 'error',
          title: 'Reset Failed',
          text: response.data.message || 'Something went wrong. Please try again.',
          confirmButtonText: 'OK',
          background: 'var(--bg-primary)',
          color: 'var(--text-primary)',
          confirmButtonColor: 'var(--primary)'
        });
      }
    } catch (error) {
      console.error('Reset password error:', error);
      await Swal.fire({
        icon: 'error',
        title: 'Server Error',
        text: error.response?.data?.message || 'Unable to reset password. Please try again later.',
        confirmButtonText: 'OK',
        background: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        confirmButtonColor: 'var(--primary)'
      });
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return null; // Show nothing while redirecting
  }

  return (
    <div className="reset-password-container">
      <div className="reset-password-card card">
        <div className="reset-password-header">
          <h2>Set New Password</h2>
          <p>Enter your new password below.</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">New Password</label>
            <input
              type="password"
              className="form-control"
              placeholder="Enter new password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Confirm New Password</label>
            <input
              type="password"
              className="form-control"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary w-100"
            disabled={loading}
          >
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>

        <div className="reset-password-links">
          <p>
            Remember your password?{' '}
            <Link to="/login" className="link">
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;