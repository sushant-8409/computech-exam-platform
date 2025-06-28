import React, { useState } from 'react';
import { useAuth, useTheme } from '../App';
import { Link, useLocation } from 'react-router-dom';
import styles from './Header.module.css';

const Header = () => {
  const { user, logout } = useAuth();
  const { darkMode, toggleTheme } = useTheme();
  const location = useLocation();
  const [showMobileNav, setShowMobileNav] = useState(false);

  const getDashboardPath = () => {
    if (!user) return '/login';
    return user.role === 'admin' ? '/admin' : '/student';
  };

  const isDashboardActive = () => {
    if (!user) return false;
    const currentPath = location.pathname;
    
    if (user.role === 'admin') {
      return currentPath === '/admin' || currentPath.startsWith('/admin');
    } else {
      return currentPath === '/student' || currentPath.startsWith('/student');
    }
  };

  return (
    <header className={`${styles.appHeader} ${darkMode ? styles.dark : ''}`}>
      <div className={styles.headerContent}>
        <div className={styles.headerLeft}>
          <h1>🎓 CompuTech Exam Platform</h1>
        </div>

        {/* ✅ Desktop Navigation */}
        <div className={`${styles.headerCenter} ${styles.desktopNav}`}>
          <Link 
            to={getDashboardPath()}
            className={`${styles.navLink} ${isDashboardActive() ? styles.active : ''}`}
          >
            📊 Dashboard
          </Link>
          
          {user?.role === 'student' && (
            <>
              <Link 
                to="/student/mock-test" 
                className={`${styles.navLink} ${location.pathname.includes('/mock-test') ? styles.active : ''}`}
              >
                🧪 Mock Tests
              </Link>
              <Link 
                to="/student/results" 
                className={`${styles.navLink} ${location.pathname.includes('/results') ? styles.active : ''}`}
              >
                📋 My Results
              </Link>
            </>
          )}

          {user?.role === 'admin' && (
            <>
              <Link 
                to="/admin/answer-review" 
                className={`${styles.navLink} ${location.pathname.includes('/answer-review') ? styles.active : ''}`}
              >
                📝 Review
              </Link>
              <Link 
                to="/admin/analytics" 
                className={`${styles.navLink} ${location.pathname.includes('/analytics') ? styles.active : ''}`}
              >
                📊 Analytics
              </Link>
            </>
          )}
        </div>

        {/* ✅ Mobile Navigation Toggle */}
        <div className={styles.mobileNavToggle}>
          <button 
            className={styles.hamburger}
            onClick={() => setShowMobileNav(!showMobileNav)}
          >
            ☰
          </button>
        </div>

        <div className={styles.headerRight}>
          <button onClick={toggleTheme} className={styles.themeBtn}>
            {darkMode ? '☀️ Light' : '🌙 Dark'}
          </button>
          {user && (
            <div className={styles.userSection}>
              <span className={styles.userName}>👋 {user.name}</span>
              <span className={styles.userRole}>({user.role})</span>
              <button onClick={logout} className={styles.logoutBtn}>
                🚪 Logout
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ✅ Mobile Navigation Dropdown */}
      {showMobileNav && (
        <div className={styles.mobileNavDropdown}>
          <Link 
            to={getDashboardPath()}
            className={`${styles.mobileNavLink} ${isDashboardActive() ? styles.active : ''}`}
            onClick={() => setShowMobileNav(false)}
          >
            📊 Dashboard
          </Link>
          
          {user?.role === 'student' && (
            <>
              <Link 
                to="/student/mock-test" 
                className={`${styles.mobileNavLink} ${location.pathname.includes('/mock-test') ? styles.active : ''}`}
                onClick={() => setShowMobileNav(false)}
              >
                🧪 Mock Tests
              </Link>
              <Link 
                to="/student/results" 
                className={`${styles.mobileNavLink} ${location.pathname.includes('/results') ? styles.active : ''}`}
                onClick={() => setShowMobileNav(false)}
              >
                📋 My Results
              </Link>
            </>
          )}

          {user?.role === 'admin' && (
            <>
              <Link 
                to="/admin/answer-review" 
                className={`${styles.mobileNavLink} ${location.pathname.includes('/answer-review') ? styles.active : ''}`}
                onClick={() => setShowMobileNav(false)}
              >
                📝 Answer Review
              </Link>
              <Link 
                to="/admin/analytics" 
                className={`${styles.mobileNavLink} ${location.pathname.includes('/analytics') ? styles.active : ''}`}
                onClick={() => setShowMobileNav(false)}
              >
                📊 Analytics
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  );
};

export default Header;
