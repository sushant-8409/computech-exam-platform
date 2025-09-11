import React, { useState } from 'react';

const ExampleBox = () => {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <div style={{ 
      position: 'fixed', 
      top: '80px', 
      right: '20px', 
      background: 'white', 
      padding: '20px', 
      border: '2px solid #2563eb',
      borderRadius: '12px',
      zIndex: 1000,
      maxWidth: '45vw',
      width: '400px',
      maxHeight: '70vh',
      overflow: 'auto',
      boxShadow: '0 8px 25px rgba(0,0,0,0.15)',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '15px' 
      }}>
        <h4 style={{ 
          margin: 0, 
          color: '#2563eb', 
          fontSize: '16px',
          fontWeight: '600'
        }}>
          💡 Admin Quick Guide
        </h4>
        <button 
          onClick={() => setIsVisible(false)}
          style={{
            background: '#f3f4f6',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            fontSize: '14px',
            cursor: 'pointer',
            padding: '4px 8px',
            color: '#6b7280'
          }}
          title="Close"
        >
          ✕
        </button>
      </div>
      <div>
        <p style={{ 
          fontSize: '14px', 
          margin: '0 0 12px 0',
          color: '#1f2937',
          fontWeight: '500' 
        }}>
          🎯 <strong>Key Features:</strong>
        </p>
        <ul style={{ 
          fontSize: '13px', 
          margin: 0, 
          paddingLeft: '20px',
          color: '#4b5563',
          lineHeight: '1.6'
        }}>
          <li>📊 <strong>Results Tab:</strong> View all test submissions</li>
          <li>💻 <strong>Coding Admin:</strong> Manage coding tests with marks modification</li>
          <li>🔍 <strong>Smart Detection:</strong> Automatic coding vs traditional test identification</li>
          <li>🚩 <strong>Anti-Cheating:</strong> Flag suspicious activities</li>
          <li>📈 <strong>Monitoring:</strong> Track student behavior during tests</li>
        </ul>
        <div style={{
          marginTop: '12px',
          padding: '10px',
          background: '#eff6ff',
          borderRadius: '6px',
          border: '1px solid #bfdbfe'
        }}>
          <p style={{ 
            margin: 0, 
            fontSize: '12px', 
            color: '#1d4ed8',
            textAlign: 'center',
            fontWeight: '500'
          }}>
            💡 Coding tests now show as "💻 Coding" instead of "📄 Traditional"
          </p>
        </div>
      </div>
    </div>
  );
};

export default ExampleBox;
