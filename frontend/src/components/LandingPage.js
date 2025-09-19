import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import SEOHead from './SEOHead';
import WorkingCompiler from './WorkingCompiler';
import './LandingPage.css';

const LandingPage = () => {
  const navigate = useNavigate();
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPopup, setShowPopup] = useState(false);
  const [currentPopup, setCurrentPopup] = useState(null);

  useEffect(() => {
    fetchPromotions();
    checkForPopups();
  }, []);

  const fetchPromotions = async () => {
    try {
      const response = await axios.get('/api/promotions/public');
      setPromotions(response.data.promotions || []);
    } catch (error) {
      console.error('Error fetching promotions:', error.response?.status === 404 ? 'Promotions API not available' : error.message);
      setPromotions([]); // Gracefully handle missing promotions
    } finally {
      setLoading(false);
    }
  };

  const checkForPopups = async () => {
    try {
      const response = await axios.get('/api/promotions/popup/landing');
      if (response.data.popup) {
        setCurrentPopup(response.data.popup);
        setShowPopup(true);
      }
    } catch (error) {
      console.error('Error checking for popups:', error.response?.status === 404 ? 'Popup API not available' : error.message);
      // Gracefully handle missing popup functionality
    }
  };

  const closePopup = () => {
    setShowPopup(false);
    setCurrentPopup(null);
  };

  const handleGetStarted = () => {
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="landing-loading">
        <div className="loading-spinner"></div>
        <p>Loading AucTutor...</p>
      </div>
    );
  }

  return (
    <>
      <SEOHead
        title="AucTutor - Advanced Online Education Platform"
        description="Master coding skills with interactive practice, take secure online exams, and get comprehensive performance analytics. Join thousands of students on AucTutor."
        keywords="online education, coding practice, programming tutorials, exam platform, performance analytics, student portal, AucTutor"
        url="https://auctutor.app"
      />
      
      <div className="landing-page">
        {/* Header */}
        <header className="landing-header">
          <div className="header-container">
            <div className="logo-section">
              <div className="logo-container">
                <img src="/icon-192x192.png" alt="AucTutor" className="logo-image" />
                <h1 className="logo">AucTutor</h1>
              </div>
              <span className="tagline">Code • Practice • Excel</span>
            </div>
            <div className="auth-buttons">
              <Link to="/login" className="login-btn">Login</Link>
              <Link to="/signup" className="signup-btn">Sign Up</Link>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <section className="hero">
        <div className="hero-content">
          <div className="hero-text">
            <h1 className="hero-title">
              🎓 Welcome to <span className="brand">AucTutor</span>
            </h1>
            <p className="hero-subtitle">
              Advanced Online Education Platform for Modern Learning
            </p>
            <p className="hero-description">
              Master coding skills, take secure exams, and track your academic progress 
              with our comprehensive educational platform designed for students and educators.
            </p>
            
            <div className="hero-features">
              <div className="feature-item">
                <span className="feature-icon">💻</span>
                <span>Interactive Coding Practice</span>
              </div>
              <div className="feature-item">
                <span className="feature-icon">🧪</span>
                <span>Secure Online Exams</span>
              </div>
              <div className="feature-item">
                <span className="feature-icon">📊</span>
                <span>Detailed Analytics</span>
              </div>
              <div className="feature-item">
                <span className="feature-icon">🎯</span>
                <span>Smart Practice</span>
              </div>
            </div>

            <div className="hero-buttons">
              <button 
                className="btn btn-primary"
                onClick={() => navigate('/login')}
              >
                🚀 Login Now
              </button>
              <button 
                className="btn btn-secondary"
                onClick={() => navigate('/register')}
              >
                📝 Sign Up Free
              </button>
            </div>
          </div>
          
          <div className="hero-visual">
            <div className="platform-preview">
              <div className="preview-header">
                <div className="preview-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                <span className="preview-title">AucTutor Platform</span>
              </div>
              <div className="preview-content">
                <div className="code-editor-preview">
                  <div className="code-line">
                    <span className="code-keyword">function</span>
                    <span className="code-function"> solve</span>
                    <span className="code-bracket">(</span>
                    <span className="code-param">problem</span>
                    <span className="code-bracket">) {'{'}</span>
                  </div>
                  <div className="code-line">
                    <span className="code-indent">  </span>
                    <span className="code-comment">// Your solution here</span>
                  </div>
                  <div className="code-line">
                    <span className="code-indent">  </span>
                    <span className="code-keyword">return</span>
                    <span className="code-string"> "success"</span>
                    <span className="code-semicolon">;</span>
                  </div>
                  <div className="code-line">
                    <span className="code-bracket">{'}'}</span>
                  </div>
                </div>
                <div className="results-preview">
                  <div className="test-result">
                    <span className="test-pass">✅ Test Case 1: Passed</span>
                  </div>
                  <div className="test-result">
                    <span className="test-pass">✅ Test Case 2: Passed</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features">
        <div className="container">
          <h2 className="section-title">Why Choose AucTutor?</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon-large">💻</div>
              <h3>Interactive Coding Practice</h3>
              <p>Practice coding problems with real-time feedback, just like LeetCode. Support for multiple programming languages with intelligent test case validation.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon-large">🔒</div>
              <h3>Secure Exam System</h3>
              <p>Take exams with advanced security features, offline support, and instant results generation with detailed analytics.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon-large">📊</div>
              <h3>Performance Analytics</h3>
              <p>Track your progress with comprehensive analytics, performance insights, and personalized learning recommendations.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon-large">🤖</div>
              <h3>AI-Powered Mock Tests</h3>
              <p>Experience intelligent mock tests with AI-generated questions, automated grading, and personalized performance analysis.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon-large">🧠</div>
              <h3>AI Learning Assistant</h3>
              <p>Get instant help with our AI-powered doubt solver and receive personalized coding solutions and explanations.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Compiler Demo */}
      <section className="compiler-demo">
        <div className="container">
          <WorkingCompiler />
        </div>
      </section>

      {/* Promotions Section */}
      {promotions.length > 0 && (
        <section className="promotions-section">
          <div className="container">
            <h2 className="section-title">Latest Updates & Announcements</h2>
            <div className="promotions-grid">
              {promotions.map((promotion) => (
                <div key={promotion._id} className="promotion-card">
                  {promotion.videoUrl && (
                    <div className="promotion-video">
                      <iframe
                        src={promotion.videoUrl}
                        title={promotion.title}
                        frameBorder="0"
                        allowFullScreen
                      ></iframe>
                    </div>
                  )}
                  <div className="promotion-content">
                    <h3>{promotion.title}</h3>
                    <p>{promotion.description}</p>
                    {promotion.buttonText && (
                      <button 
                        className="promotion-btn"
                        onClick={() => window.open(promotion.buttonUrl, '_blank')}
                      >
                        {promotion.buttonText}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section className="cta">
        <div className="container">
          <div className="cta-content">
            <h2>Ready to Transform Your Learning?</h2>
            <p>Join thousands of students and educators already using AucTutor</p>
            <div className="cta-buttons">
              <button 
                className="btn btn-primary btn-large"
                onClick={handleGetStarted}
              >
                Get Started Free
              </button>
              <button 
                className="btn btn-outline btn-large"
                onClick={() => navigate('/login')}
              >
                Login to Your Account
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-brand">
              <h3>🎓 AucTutor</h3>
              <p>Advanced Online Education Platform</p>
            </div>
            <div className="footer-links">
              <div className="footer-section">
                <h4>Platform</h4>
                <ul>
                  <li><a href="/login">Student Login</a></li>
                  <li><a href="/register">Sign Up</a></li>
                  <li><a href="/admin">Admin Portal</a></li>
                </ul>
              </div>
              <div className="footer-section">
                <h4>Features</h4>
                <ul>
                  <li>Coding Practice</li>
                  <li>Online Exams</li>
                  <li>AI Assistant</li>
                  <li>Analytics</li>
                </ul>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; 2025 AucTutor. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* Popup Modal */}
      {showPopup && currentPopup && (
        <div className="popup-overlay" onClick={closePopup}>
          <div className="popup-modal" onClick={(e) => e.stopPropagation()}>
            <button className="popup-close" onClick={closePopup}>×</button>
            <div className="popup-content">
              {currentPopup.videoUrl && (
                <div className="popup-video">
                  <iframe
                    src={currentPopup.videoUrl}
                    title={currentPopup.title}
                    frameBorder="0"
                    allowFullScreen
                  ></iframe>
                </div>
              )}
              <h3>{currentPopup.title}</h3>
              <p>{currentPopup.description}</p>
              {currentPopup.buttonText && (
                <button 
                  className="popup-btn"
                  onClick={() => {
                    window.open(currentPopup.buttonUrl, '_blank');
                    closePopup();
                  }}
                >
                  {currentPopup.buttonText}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
};

export default LandingPage;