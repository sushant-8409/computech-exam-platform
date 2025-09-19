import React, { useState, useRef } from 'react';
import { useAuth } from '../App';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import ReCAPTCHA from 'react-google-recaptcha';
import axios from 'axios';
import './Signup.css';

const Signup = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [captchaValue, setCaptchaValue] = useState(null);
  const [captchaError, setCaptchaError] = useState(null);
  const recaptchaRef = useRef(null);
  const isProd = process.env.NODE_ENV === 'production';
  
  // Check if reCAPTCHA is configured
  const recaptchaSiteKey = process.env.REACT_APP_RECAPTCHA_SITE_KEY;

  // Handle reCAPTCHA errors
  const handleCaptchaError = () => {
    setCaptchaError('reCAPTCHA configuration error. Please contact administrator.');
    console.error('reCAPTCHA Error: Invalid key type or configuration issue');
  };

  /* already logged-in? bounce */
  if (user) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/student'} replace />;
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const captchaOperational = !!recaptchaSiteKey && !captchaError;
    
    // Basic validation
    if (!formData.name || !formData.email || !formData.password || !formData.confirmPassword) {
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

    if (formData.password.length < 6) {
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

    if (formData.password !== formData.confirmPassword) {
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

    // Validate captcha (only if reCAPTCHA is configured)
    if (captchaOperational && !captchaValue) {
      await Swal.fire({
        icon: 'warning',
        title: 'Captcha Required',
        text: 'Please complete the captcha verification to continue.',
        confirmButtonText: 'OK',
        background: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        confirmButtonColor: 'var(--primary)'
      });
      return;
    }
    
    setLoading(true);

    try {
      const response = await axios.post('/api/signup', {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        captcha: captchaValue
      });

      if (response.data.success) {
        // Show success message
        await Swal.fire({
          icon: 'success',
          title: 'Account Created!',
          text: `Welcome to AucTutor, ${response.data.user.name}!`,
          timer: 2000,
          showConfirmButton: false,
          background: 'var(--bg-primary)',
          color: 'var(--text-primary)'
        });
        
        // Store token and redirect
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        navigate('/student');
      } else {
        await Swal.fire({
          icon: 'error',
          title: 'Signup Failed',
          text: response.data.message || 'Unable to create account. Please try again.',
          confirmButtonText: 'Try Again',
          background: 'var(--bg-primary)',
          color: 'var(--text-primary)',
          confirmButtonColor: 'var(--primary)'
        });
      }
    } catch (error) {
      console.error('Signup error:', error);
      const errorMessage = error?.response?.data?.message || 'Server error. Please try again later.';
      await Swal.fire({
        icon: 'error',
        title: 'Connection Error',
        text: errorMessage,
        confirmButtonText: 'Retry',
        background: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        confirmButtonColor: 'var(--primary)'
      });
    } finally {
      setLoading(false);
      // Reset captcha after any attempt
      if (recaptchaRef.current) {
        recaptchaRef.current.reset();
        setCaptchaValue(null);
      }
    }
  };

  return (
    <div className="signup-container">
      <div className="signup-card card">
        <div className="signup-header">
          <h2>Join AucTutor</h2>
          <p>Create your account to start learning</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input
              type="text"
              name="name"
              className="form-control"
              placeholder="Enter your full name"
              value={formData.name}
              onChange={handleInputChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              name="email"
              className="form-control"
              placeholder="Enter your email"
              value={formData.email}
              onChange={handleInputChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              name="password"
              className="form-control"
              placeholder="Enter your password"
              value={formData.password}
              onChange={handleInputChange}
              required
              minLength={6}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Confirm Password</label>
            <input
              type="password"
              name="confirmPassword"
              className="form-control"
              placeholder="Confirm your password"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              required
              minLength={6}
            />
          </div>

          {/* ReCAPTCHA */}
          {recaptchaSiteKey && !captchaError && (
            <div className="form-group recaptcha">
              <ReCAPTCHA
                ref={recaptchaRef}
                sitekey={recaptchaSiteKey}
                onChange={(value) => {
                  setCaptchaValue(value);
                  setCaptchaError(null);
                }}
                onExpired={() => setCaptchaValue(null)}
                onError={handleCaptchaError}
                onErrored={handleCaptchaError}
                theme="dark"
              />
            </div>
          )}
          
          {(captchaError || !recaptchaSiteKey) && !isProd && (
            <div className="form-group">
              <div style={{
                padding: '10px',
                backgroundColor: '#fff3cd',
                border: '1px solid #ffeaa7',
                borderRadius: '4px',
                color: '#856404',
                fontSize: '14px'
              }}>
                ⚠️ {captchaError || 'reCAPTCHA not configured. Please contact administrator.'}
              </div>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary w-100"
            disabled={loading}
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <div className="signup-links">
          <p>
            Already have an account?{' '}
            <Link to="/login" className="link">
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Signup;