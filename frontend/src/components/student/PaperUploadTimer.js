import React, { useState, useEffect } from 'react';
import PaperUpload from './PaperUpload';
import './PaperUploadTimer.module.css';

const PaperUploadTimer = ({ test, user, onComplete, onSkip }) => {
  const [timeLeft, setTimeLeft] = useState(test?.paperUploadTimeLimit * 60 || 900); // Default 15 minutes
  const [isActive, setIsActive] = useState(true);
  const [uploadComplete, setUploadComplete] = useState(false);

  useEffect(() => {
    if (!isActive) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setIsActive(false);
          if (onComplete && !uploadComplete) {
            onComplete(false); // Time expired without upload
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isActive, onComplete, uploadComplete]);

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleUploadComplete = (url) => {
    setUploadComplete(true);
    setIsActive(false);
    if (onComplete) {
      onComplete(true, url); // Successfully uploaded
    }
  };

  const handleSkip = () => {
    setIsActive(false);
    if (onSkip) {
      onSkip();
    }
  };

  if (!test?.paperSubmissionRequired) {
    return null;
  }

  return (
    <div className="paper-upload-timer-overlay">
      <div className="paper-upload-timer-container">
        <div className="timer-header">
          <h2>📄 Answer Sheet Submission Required</h2>
          <div className="timer-display">
            <span className="timer-label">Time Remaining:</span>
            <span className={`timer-value ${timeLeft < 300 ? 'warning' : ''} ${timeLeft < 60 ? 'critical' : ''}`}>
              {formatTime(timeLeft)}
            </span>
          </div>
        </div>

        {timeLeft > 0 && !uploadComplete ? (
          <div className="upload-content">
            <div className="instructions">
              <h3>📝 Upload Instructions</h3>
              <ul>
                <li>Use your camera to capture each page of your answer sheet</li>
                <li>Ensure good lighting and clear visibility of your writing</li>
                <li>Capture pages in order (Page 1, Page 2, etc.)</li>
                <li>All pages will be automatically combined into a single PDF</li>
                <li>Review your captured pages before uploading</li>
              </ul>
            </div>

            <PaperUpload
              testId={test._id}
              test={test}
              user={user}
              onUploadComplete={handleUploadComplete}
              disabled={timeLeft === 0}
            />

            <div className="timer-actions">
              <button 
                className="btn btn-outline"
                onClick={handleSkip}
                disabled={uploadComplete}
              >
                Skip Upload (Submit Without Paper)
              </button>
            </div>
          </div>
        ) : timeLeft === 0 && !uploadComplete ? (
          <div className="time-expired">
            <div className="expired-message">
              <span className="expired-icon">⏰</span>
              <h3>Time Expired</h3>
              <p>The time limit for paper submission has ended.</p>
              <p>Your test has been submitted without the answer sheet.</p>
            </div>
            <button 
              className="btn btn-primary"
              onClick={() => onComplete && onComplete(false)}
            >
              Continue to Results
            </button>
          </div>
        ) : (
          <div className="upload-success">
            <div className="success-message">
              <span className="success-icon">✅</span>
              <h3>Upload Successful!</h3>
              <p>Your answer sheet has been submitted successfully.</p>
            </div>
            <button 
              className="btn btn-primary"
              onClick={() => onComplete && onComplete(true)}
            >
              Continue to Results
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaperUploadTimer;
