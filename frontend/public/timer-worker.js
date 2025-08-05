// Optimized Timer Web Worker for Test Interface
// This runs in a separate thread to avoid main thread blocking

let timerState = {
  startTime: null,
  endTime: null,
  duration: 0,
  paused: false,
  intervalId: null,
  lastSync: 0,
  driftCorrection: 0
};

// High precision timer using performance.now() when available
const getHighPrecisionTime = () => {
  return typeof performance !== 'undefined' && performance.now 
    ? performance.timeOrigin + performance.now() 
    : Date.now();
};

// Start the timer
const startTimer = (config) => {
  const { duration, startTime, endTime, testId } = config;
  
  timerState.duration = duration;
  timerState.startTime = startTime || getHighPrecisionTime();
  timerState.endTime = endTime || (timerState.startTime + (duration * 1000));
  timerState.lastSync = getHighPrecisionTime();
  
  // Clear any existing timer
  if (timerState.intervalId) {
    clearInterval(timerState.intervalId);
  }
  
  // Use requestAnimationFrame for smooth updates when available
  if (typeof requestAnimationFrame !== 'undefined') {
    const updateTimer = () => {
      if (!timerState.paused) {
        const now = getHighPrecisionTime();
        const elapsed = now - timerState.startTime + timerState.driftCorrection;
        const remaining = Math.max(0, timerState.duration - Math.floor(elapsed / 1000));
        
        postMessage({
          type: 'TIMER_UPDATE',
          data: {
            timeRemaining: remaining,
            elapsed: Math.floor(elapsed / 1000),
            testId
          }
        });
        
        if (remaining > 0) {
          timerState.intervalId = requestAnimationFrame(updateTimer);
        } else {
          postMessage({
            type: 'TIMER_FINISHED',
            data: { testId }
          });
        }
      }
    };
    updateTimer();
  } else {
    // Fallback to setInterval for environments without requestAnimationFrame
    timerState.intervalId = setInterval(() => {
      if (!timerState.paused) {
        const now = getHighPrecisionTime();
        const elapsed = now - timerState.startTime + timerState.driftCorrection;
        const remaining = Math.max(0, timerState.duration - Math.floor(elapsed / 1000));
        
        postMessage({
          type: 'TIMER_UPDATE',
          data: {
            timeRemaining: remaining,
            elapsed: Math.floor(elapsed / 1000),
            testId
          }
        });
        
        if (remaining <= 0) {
          clearInterval(timerState.intervalId);
          postMessage({
            type: 'TIMER_FINISHED',
            data: { testId }
          });
        }
      }
    }, 100); // Update every 100ms for smooth display
  }
};

// Pause the timer
const pauseTimer = () => {
  timerState.paused = true;
  if (timerState.intervalId) {
    if (typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(timerState.intervalId);
    } else {
      clearInterval(timerState.intervalId);
    }
  }
};

// Resume the timer
const resumeTimer = () => {
  timerState.paused = false;
  if (!timerState.intervalId) {
    startTimer({
      duration: timerState.duration,
      startTime: timerState.startTime,
      endTime: timerState.endTime
    });
  }
};

// Sync with server time to correct drift
const syncTimer = (serverData) => {
  const { remainingSeconds, serverTime } = serverData;
  const localTime = getHighPrecisionTime();
  const expectedRemaining = Math.max(0, Math.floor((timerState.endTime - localTime) / 1000));
  
  // Calculate drift
  const drift = expectedRemaining - remainingSeconds;
  
  if (Math.abs(drift) > 2) { // Only correct if drift is more than 2 seconds
    timerState.driftCorrection += drift * 1000;
    timerState.lastSync = localTime;
    
    postMessage({
      type: 'TIMER_SYNCED',
      data: {
        drift: drift,
        correctedTime: remainingSeconds,
        syncTime: localTime
      }
    });
  }
};

// Stop the timer
const stopTimer = () => {
  timerState.paused = true;
  if (timerState.intervalId) {
    if (typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(timerState.intervalId);
    } else {
      clearInterval(timerState.intervalId);
    }
    timerState.intervalId = null;
  }
};

// Get current timer status
const getTimerStatus = () => {
  const now = getHighPrecisionTime();
  const elapsed = now - timerState.startTime + timerState.driftCorrection;
  const remaining = Math.max(0, timerState.duration - Math.floor(elapsed / 1000));
  
  return {
    timeRemaining: remaining,
    elapsed: Math.floor(elapsed / 1000),
    paused: timerState.paused,
    drift: timerState.driftCorrection
  };
};

// Message handler
self.onmessage = function(e) {
  const { type, data } = e.data;
  
  switch (type) {
    case 'START_TIMER':
      startTimer(data);
      break;
      
    case 'PAUSE_TIMER':
      pauseTimer();
      break;
      
    case 'RESUME_TIMER':
      resumeTimer();
      break;
      
    case 'SYNC_TIMER':
      syncTimer(data);
      break;
      
    case 'STOP_TIMER':
      stopTimer();
      break;
      
    case 'GET_STATUS':
      postMessage({
        type: 'TIMER_STATUS',
        data: getTimerStatus()
      });
      break;
      
    default:
      postMessage({
        type: 'ERROR',
        data: { message: `Unknown message type: ${type}` }
      });
  }
};

// Send initial ready message
postMessage({
  type: 'WORKER_READY',
  data: { message: 'Timer worker initialized successfully' }
});
