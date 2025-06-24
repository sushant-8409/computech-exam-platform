import React from 'react';
import styles from './LoadingSpinner.module.css';

const LoadingSpinner = ({ text = 'Loading...', size = 'medium' }) => {
  return (
    <div className={`${styles.loadingContainer} ${styles[size]}`}>
      <div className={styles.spinnerWrapper}>
        <div className={styles.spinner}>
          <div className={`${styles.spinnerRing} ${styles.ring1}`}></div>
          <div className={`${styles.spinnerRing} ${styles.ring2}`}></div>
          <div className={`${styles.spinnerRing} ${styles.ring3}`}></div>
          <div className={`${styles.spinnerRing} ${styles.ring4}`}></div>
        </div>
        <div className={styles.spinnerInner}>
          <div className={styles.spinnerDot}></div>
        </div>
      </div>
      <p className={styles.loadingText}>{text}</p>
    </div>
  );
};

export default LoadingSpinner;
