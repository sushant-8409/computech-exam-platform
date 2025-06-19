import React from 'react';
import { useAuth, useTheme } from '../App'; // ✅ Now properly exported
import { Link } from 'react-router-dom';
const Header = () => {
  const { user, logout } = useAuth();
  const { darkMode, toggleTheme } = useTheme();

  return (
    <header className="app-header">
      <div className="header-content">
        <div className="header-left">
          <h1>🎓 CompuTech Exam Platform</h1>
        </div>
        <header className="header">
          <div className="header-buttons">
            <Link to="/dashboard" className="button dashboard">
              Dashboard
            </Link>
          </div>
        </header>

        <div className="header-right">
          <button onClick={toggleTheme} className="theme-btn">
            {darkMode ? '☀️ Light' : '🌙 Dark'}
          </button>
          {user && (
            <div className="user-section">
              <span className="user-name">👋 {user.name}</span>
              <span className="user-role">({user.role})</span>
              <button onClick={logout} className="logout-btn">
                🚪 Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
