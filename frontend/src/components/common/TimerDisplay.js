import React, { memo, useMemo } from 'react';
import styles from './TimerDisplay.module.css';

/**
 * Optimized Timer Display Component
 * Uses React.memo to prevent unnecessary re-renders
 * Optimized for smooth display even during heavy UI operations
 */
const TimerDisplay = memo(({ 
  timeRemaining, 
  showWarning = true, 
  warningThreshold = 300, // 5 minutes
  criticalThreshold = 60,  // 1 minute
  size = 'medium',
  showIcon = true,
  className = '',
  onTimeOut 
}) => {
  
  // Memoized time formatting to prevent recalculation
  const formattedTime = useMemo(() => {
    const hours = Math.floor(timeRemaining / 3600);
    const minutes = Math.floor((timeRemaining % 3600) / 60);
    const seconds = timeRemaining % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, [timeRemaining]);
  
  // Memoized warning state to prevent unnecessary class recalculations
  const warningState = useMemo(() => {
    if (timeRemaining <= 0) return 'expired';
    if (timeRemaining <= criticalThreshold) return 'critical';
    if (timeRemaining <= warningThreshold && showWarning) return 'warning';
    return 'normal';
  }, [timeRemaining, criticalThreshold, warningThreshold, showWarning]);
  
  // Memoized CSS classes
  const timerClasses = useMemo(() => {
    return [
      styles.timerDisplay,
      styles[size],
      styles[warningState],
      className
    ].filter(Boolean).join(' ');
  }, [size, warningState, className]);
  
  // Trigger timeout callback when time expires
  React.useEffect(() => {
    if (timeRemaining <= 0 && onTimeOut) {
      onTimeOut();
    }
  }, [timeRemaining, onTimeOut]);
  
  return (
    <div className={timerClasses}>
      <div className={styles.timerContent}>
        {showIcon && (
          <span className={styles.timerIcon} aria-hidden="true">
            ⏰
          </span>
        )}
        <span 
          className={styles.timerText}
          aria-label={`Time remaining: ${formattedTime}`}
          role="timer"
          aria-live="polite"
          aria-atomic="true"
        >
          {formattedTime}
        </span>
      </div>
      
      {warningState === 'critical' && (
        <div className={styles.criticalWarning} aria-live="assertive">
          <span className={styles.pulseIcon}>⚠️</span>
          <span className={styles.warningText}>Time running out!</span>
        </div>
      )}
    </div>
  );
});

TimerDisplay.displayName = 'TimerDisplay';

export default TimerDisplay;
