import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * High-performance timer hook using Web Workers
 * Prevents main thread blocking and provides smooth, lag-free timing
 */
export const useWebWorkerTimer = (testId) => {
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [drift, setDrift] = useState(0);
  const [lastSync, setLastSync] = useState(0);
  
  const workerRef = useRef(null);
  const onTimerFinishedRef = useRef(null);
  const onTimerUpdateRef = useRef(null);
  const onTimerSyncRef = useRef(null);
  
  // Initialize Web Worker
  useEffect(() => {
    // Check if Web Workers are supported
    if (typeof Worker === 'undefined') {
      console.warn('Web Workers not supported, falling back to main thread timer');
      return;
    }
    
    try {
      workerRef.current = new Worker('/timer-worker.js');
      
      workerRef.current.onmessage = (e) => {
        const { type, data } = e.data;
        
        switch (type) {
          case 'WORKER_READY':
            console.log('✅ Timer Worker initialized successfully');
            break;
            
          case 'TIMER_UPDATE':
            setTimeRemaining(data.timeRemaining);
            setElapsed(data.elapsed);
            
            // Call update callback if provided
            if (onTimerUpdateRef.current) {
              onTimerUpdateRef.current(data);
            }
            break;
            
          case 'TIMER_FINISHED':
            setTimeRemaining(0);
            setIsRunning(false);
            
            // Call finished callback if provided
            if (onTimerFinishedRef.current) {
              onTimerFinishedRef.current();
            }
            break;
            
          case 'TIMER_SYNCED':
            setDrift(data.drift);
            setLastSync(data.syncTime);
            
            // Call sync callback if provided
            if (onTimerSyncRef.current) {
              onTimerSyncRef.current(data);
            }
            break;
            
          case 'TIMER_STATUS':
            setTimeRemaining(data.timeRemaining);
            setElapsed(data.elapsed);
            setIsPaused(data.paused);
            setDrift(data.drift);
            break;
            
          case 'ERROR':
            console.error('Timer Worker Error:', data.message);
            break;
            
          default:
            console.warn('Unknown timer worker message:', type, data);
        }
      };
      
      workerRef.current.onerror = (error) => {
        console.error('Timer Worker Error:', error);
      };
      
    } catch (error) {
      console.error('Failed to initialize Timer Worker:', error);
    }
    
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);
  
  // Start timer
  const startTimer = useCallback((config) => {
    if (!workerRef.current) {
      console.error('Timer worker not available');
      return false;
    }
    
    const timerConfig = {
      duration: config.duration || 0,
      startTime: config.startTime || Date.now(),
      endTime: config.endTime,
      testId: testId
    };
    
    workerRef.current.postMessage({
      type: 'START_TIMER',
      data: timerConfig
    });
    
    setIsRunning(true);
    setIsPaused(false);
    return true;
  }, [testId]);
  
  // Pause timer
  const pauseTimer = useCallback(() => {
    if (!workerRef.current) return false;
    
    workerRef.current.postMessage({ type: 'PAUSE_TIMER' });
    setIsPaused(true);
    return true;
  }, []);
  
  // Resume timer
  const resumeTimer = useCallback(() => {
    if (!workerRef.current) return false;
    
    workerRef.current.postMessage({ type: 'RESUME_TIMER' });
    setIsPaused(false);
    return true;
  }, []);
  
  // Stop timer
  const stopTimer = useCallback(() => {
    if (!workerRef.current) return false;
    
    workerRef.current.postMessage({ type: 'STOP_TIMER' });
    setIsRunning(false);
    setIsPaused(false);
    return true;
  }, []);
  
  // Sync with server
  const syncTimer = useCallback((serverData) => {
    if (!workerRef.current) return false;
    
    workerRef.current.postMessage({
      type: 'SYNC_TIMER',
      data: serverData
    });
    return true;
  }, []);
  
  // Get current status
  const getStatus = useCallback(() => {
    if (!workerRef.current) return null;
    
    workerRef.current.postMessage({ type: 'GET_STATUS' });
  }, []);
  
  // Set callback functions
  const onTimerFinished = useCallback((callback) => {
    onTimerFinishedRef.current = callback;
  }, []);
  
  const onTimerUpdate = useCallback((callback) => {
    onTimerUpdateRef.current = callback;
  }, []);
  
  const onTimerSync = useCallback((callback) => {
    onTimerSyncRef.current = callback;
  }, []);
  
  return {
    // State
    timeRemaining,
    elapsed,
    isRunning,
    isPaused,
    drift,
    lastSync,
    
    // Controls
    startTimer,
    pauseTimer,
    resumeTimer,
    stopTimer,
    syncTimer,
    getStatus,
    
    // Callbacks
    onTimerFinished,
    onTimerUpdate,
    onTimerSync,
    
    // Utils
    isWorkerSupported: typeof Worker !== 'undefined',
    workerReady: !!workerRef.current
  };
};
