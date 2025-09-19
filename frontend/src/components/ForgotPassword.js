import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import axios from 'axios';
import './ForgotPassword.css';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email) {
      await Swal.fire({
        icon: 'warning',
        title: 'Email Required',
        text: 'Please enter your email address.',
        confirmButtonText: 'OK',
        background: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        confirmButtonColor: 'var(--primary)'
      });
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post('/api/forgot-password', { email });

      if (response.data.success) {
        await Swal.fire({
          icon: 'success',
          title: 'Reset Link Sent!',
          text: response.data.message,
          confirmButtonText: 'OK',
          background: 'var(--bg-primary)',
          color: 'var(--text-primary)',
          confirmButtonColor: 'var(--primary)'
        });
        setEmail('');
      } else {
        await Swal.fire({
          icon: 'error',
          title: 'Error',
          text: response.data.message || 'Something went wrong. Please try again.',
          confirmButtonText: 'OK',
          background: 'var(--bg-primary)',
          color: 'var(--text-primary)',
          confirmButtonColor: 'var(--primary)'
        });
      }
    } catch (error) {
      console.error('Forgot password error:', error);
      await Swal.fire({
        icon: 'error',
        title: 'Server Error',
        text: 'Unable to process request. Please try again later.',
        confirmButtonText: 'OK',
        background: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        confirmButtonColor: 'var(--primary)'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="forgot-password-container">
      <div className="forgot-password-card card">
        <div className="forgot-password-header">
          <h2>Reset Your Password</h2>
          <p>Enter your email address and we'll send you a link to reset your password.</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="form-control"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary w-100"
            disabled={loading}
          >
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>

        <div className="forgot-password-links">
          <p>
            Remember your password?{' '}
            <Link to="/login" className="link">
              Sign in here
            </Link>
          </p>
          <p>
            Don't have an account?{' '}
            <Link to="/signup" className="link">
              Sign up here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;