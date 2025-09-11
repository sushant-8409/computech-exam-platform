import axios from 'axios';

class TestMonitoringSystem {
  constructor() {
    this.sessionId = null;
    this.isMonitoring = false;
    this.settings = {
      cameraMonitoring: false,
      browserLockdown: false,
      screenshotInterval: 30000, // 30 seconds
      flagSuspiciousActivity: true
    };
    this.stream = null;
    this.canvas = null;
    this.context = null;
    this.videoElement = null;
    this.intervalIds = [];
    this.screenshots = []; // Track screenshots locally
    this.violations = []; // Track violations locally
    this.suspiciousActivities = []; // Track suspicious activities locally
    this.violationCounts = {
      tabSwitch: 0,
      fullscreenExit: 0,
      focusLoss: 0
    };
    this.lastActivity = Date.now();
    this.isVisible = true;
  }

  // Initialize monitoring for a test session
  async startMonitoring(testId, monitoringSettings = {}) {
    console.log('📸 Starting test monitoring system...');
    
    this.settings = { ...this.settings, ...monitoringSettings };
    this.sessionId = `${testId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.startTime = new Date();

    try {
      // Start monitoring session on server
      const response = await axios.post('/api/student/monitoring/start', {
        testId,
        sessionId: this.sessionId,
        settings: this.settings
      });

      console.log('📊 Monitoring start response:', response.data);

      if (response.data.success) {
        console.log('✅ Monitoring session started:', this.sessionId);
        this.isMonitoring = true;
        
        // Initialize monitoring components
        await this.initializeComponents();
        this.setupEventListeners();
        
        if (this.settings.cameraMonitoring) {
          const cameraResult = await this.startCameraMonitoring();
          if (!cameraResult) {
            console.warn('⚠️ Camera monitoring failed to initialize but continuing with other monitoring');
          }
        }

        return {
          success: true,
          sessionId: this.sessionId,
          message: 'Monitoring started successfully'
        };
      } else {
        throw new Error(response.data.message || 'Server returned unsuccessful response');
      }
    } catch (error) {
      console.error('❌ Failed to start monitoring:', error);
      
      // Provide more detailed error information
      let errorMessage = 'Failed to start monitoring system';
      
      if (error.response) {
        // Server responded with an error
        errorMessage = error.response.data?.message || `Server error: ${error.response.status}`;
        console.error('Server error details:', error.response.data);
      } else if (error.request) {
        // Network error - request was made but no response
        errorMessage = 'Network error - could not reach monitoring server';
        console.error('Network error:', error.request);
      } else {
        // Something else went wrong
        errorMessage = error.message || 'Unknown monitoring error';
      }
      
      return {
        success: false,
        message: errorMessage,
        error: error.message
      };
    }
  }

  // Initialize monitoring components
  async initializeComponents() {
    // Create hidden canvas for screenshots
    this.canvas = document.createElement('canvas');
    this.context = this.canvas.getContext('2d');
    this.canvas.style.display = 'none';
    document.body.appendChild(this.canvas);

    // Initialize browser lockdown
    if (this.settings.browserLockdown) {
      this.enableBrowserLockdown();
    }
  }

  // Setup event listeners for violation detection
  setupEventListeners() {
    // Tab/Window focus monitoring
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.isVisible = false;
        this.recordViolation('tab_switch', 'Student switched away from test tab');
      } else {
        this.isVisible = true;
        this.updateActivity();
      }
    });

    window.addEventListener('blur', () => {
      this.recordViolation('focus_loss', 'Test window lost focus');
    });

    window.addEventListener('focus', () => {
      this.updateActivity();
    });

    // Fullscreen monitoring
    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement && this.settings.browserLockdown) {
        this.recordViolation('fullscreen_exit', 'Student exited fullscreen mode');
      }
    });

    // Keyboard shortcuts prevention (if browser lockdown enabled)
    if (this.settings.browserLockdown) {
      document.addEventListener('keydown', this.preventKeyboardShortcuts.bind(this));
    }

    // Context menu prevention
    document.addEventListener('contextmenu', (e) => {
      if (this.settings.browserLockdown) {
        e.preventDefault();
        this.recordViolation('context_menu', 'Student attempted to access context menu');
      }
    });

    // Mouse activity monitoring
    document.addEventListener('mousemove', () => {
      this.updateActivity();
    });

    document.addEventListener('click', () => {
      this.updateActivity();
    });

    // Keyboard activity monitoring
    document.addEventListener('keypress', () => {
      this.updateActivity();
    });
  }

  // Start camera monitoring
  async startCameraMonitoring() {
    try {
      console.log('📹 Requesting camera access...');
      
      // Request camera permission
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640 }, 
          height: { ideal: 480 },
          facingMode: 'user'
        },
        audio: false 
      });

      console.log('📹 Camera access granted, stream:', this.stream);

      // Create video element to preview camera (hidden)
      this.videoElement = document.createElement('video');
      this.videoElement.srcObject = this.stream;
      this.videoElement.autoplay = true;
      this.videoElement.style.display = 'none';
      this.videoElement.muted = true; // Prevent audio feedback
      document.body.appendChild(this.videoElement);

      // Wait for video to load
      await new Promise((resolve) => {
        this.videoElement.onloadedmetadata = () => {
          console.log('📹 Video metadata loaded, ready to capture');
          resolve();
        };
      });

      // Start periodic screenshots after video is ready
      const screenshotInterval = setInterval(() => {
        if (this.isMonitoring && this.stream) {
          this.captureScreenshot();
        }
      }, this.settings.screenshotInterval || 30000); // Default 30 seconds

      this.intervalIds.push(screenshotInterval);

      console.log('📸 Camera monitoring started with interval:', this.settings.screenshotInterval);
      return true;
    } catch (error) {
      console.warn('⚠️ Camera access denied or failed:', error);
      
      // Record as suspicious activity
      this.recordSuspiciousActivity('camera_denied', 0.8, 'Student denied camera access');
      return false;
    }
  }

  // Capture screenshot from camera
  async captureScreenshot() {
    if (!this.stream || !this.isMonitoring || !this.videoElement) {
      console.warn('📸 Cannot capture screenshot - missing requirements');
      return;
    }

    try {
      // Ensure video element is ready
      if (this.videoElement.readyState < 2) {
        console.warn('📸 Video element not ready for capture');
        return;
      }

      // Set canvas size to match video
      this.canvas.width = this.videoElement.videoWidth || 640;
      this.canvas.height = this.videoElement.videoHeight || 480;
      
      // Draw current frame
      this.context.drawImage(this.videoElement, 0, 0, this.canvas.width, this.canvas.height);
      
      // Convert to base64
      const imageData = this.canvas.toDataURL('image/jpeg', 0.8);
      
      console.log('📸 Screenshot captured, size:', imageData.length);
      
      // Send screenshot to server
      await this.sendScreenshot(imageData);
      
      // Store locally for monitoring stats
      this.screenshots.push({
        timestamp: new Date(),
        data: imageData.substring(0, 100) + '...', // Only store beginning for display
        type: 'monitoring'
      });
      
      return imageData;
    } catch (error) {
      console.error('❌ Failed to capture screenshot:', error);
      return null;
    }
  }

  // Send screenshot to server
  async sendScreenshot(imageData, flagged = false) {
    try {
      await axios.post('/api/student/monitoring/screenshot', {
        sessionId: this.sessionId,
        imageData,
        type: 'monitoring',
        flagged
      });
    } catch (error) {
      console.error('❌ Failed to send screenshot:', error);
    }
  }

  // Record violation
  async recordViolation(type, details = '', severity = 'medium') {
    if (!this.isMonitoring) return;

    console.warn(`⚠️ Violation detected: ${type} - ${details}`);
    
    const violation = {
      type,
      timestamp: new Date(),
      details,
      severity,
      sessionTime: Date.now() - (this.startTime ? this.startTime.getTime() : Date.now())
    };
    
    this.violationCounts[type] = (this.violationCounts[type] || 0) + 1;
    this.violations.push(violation); // Store locally

    try {
      await axios.post('/api/student/monitoring/violation', {
        sessionId: this.sessionId,
        type,
        details,
        severity
      });

      // Show warning to student
      this.showViolationWarning(type, details);

    } catch (error) {
      console.error('❌ Failed to record violation:', error);
    }
  }

  // Record suspicious activity
  async recordSuspiciousActivity(type, confidence = 0.5, description = '') {
    if (!this.isMonitoring) return;

    console.warn(`🚨 Suspicious activity detected: ${type} (${Math.round(confidence * 100)}%)`);

    const activity = {
      type,
      timestamp: new Date(),
      confidence,
      description,
      severity: confidence > 0.8 ? 'high' : confidence > 0.5 ? 'medium' : 'low',
      sessionTime: Date.now() - (this.startTime ? this.startTime.getTime() : Date.now())
    };

    this.suspiciousActivities.push(activity); // Store locally

    try {
      await axios.post('/api/student/monitoring/suspicious', {
        sessionId: this.sessionId,
        type,
        confidence,
        description
      });
    } catch (error) {
      console.error('❌ Failed to record suspicious activity:', error);
    }
  }

  // Show violation warning to student
  showViolationWarning(type, details) {
    const warningMessages = {
      tab_switch: '⚠️ Warning: Switching tabs during the test is not allowed!',
      fullscreen_exit: '⚠️ Warning: Please return to fullscreen mode!',
      focus_loss: '⚠️ Warning: Keep the test window focused!',
      context_menu: '⚠️ Warning: Right-click menu is disabled during the test!',
      keyboard_shortcut: '⚠️ Warning: Keyboard shortcuts are disabled during the test!'
    };

    const message = warningMessages[type] || `⚠️ Warning: ${details}`;
    
    // Create warning overlay
    const warning = document.createElement('div');
    warning.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #ff4444;
      color: white;
      padding: 15px 25px;
      border-radius: 8px;
      font-weight: bold;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(255, 68, 68, 0.3);
      animation: slideDown 0.3s ease-out;
    `;
    warning.textContent = message;
    document.body.appendChild(warning);

    // Add animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideDown {
        from { transform: translateX(-50%) translateY(-100%); opacity: 0; }
        to { transform: translateX(-50%) translateY(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (warning.parentNode) {
        warning.remove();
      }
    }, 5000);
  }

  // Enable browser lockdown
  enableBrowserLockdown() {
    console.log('🔒 Enabling browser lockdown...');

    // Request fullscreen
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(err => {
        console.warn('⚠️ Could not enter fullscreen:', err);
        this.recordViolation('fullscreen_denied', 'Could not enable fullscreen mode');
      });
    }

    // Disable right-click
    document.addEventListener('contextmenu', e => e.preventDefault());

    // Disable text selection
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';

    // Hide cursor on idle (optional)
    let idleTimer;
    document.addEventListener('mousemove', () => {
      document.body.style.cursor = 'auto';
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        document.body.style.cursor = 'none';
      }, 3000);
    });
  }

  // Prevent keyboard shortcuts
  preventKeyboardShortcuts(e) {
    const forbiddenKeys = [
      { key: 'F12' }, // Developer tools
      { key: 'F5' }, // Refresh
      { ctrl: true, key: 'r' }, // Refresh
      { ctrl: true, key: 'R' }, // Refresh
      { ctrl: true, shift: true, key: 'I' }, // Developer tools
      { ctrl: true, shift: true, key: 'C' }, // Developer tools
      { ctrl: true, shift: true, key: 'J' }, // Console
      { ctrl: true, key: 'u' }, // View source
      { ctrl: true, key: 'U' }, // View source
      { alt: true, key: 'Tab' }, // Alt+Tab
      { ctrl: true, key: 't' }, // New tab
      { ctrl: true, key: 'T' }, // New tab
      { ctrl: true, key: 'w' }, // Close tab
      { ctrl: true, key: 'W' }, // Close tab
      { ctrl: true, key: 'n' }, // New window
      { ctrl: true, key: 'N' }, // New window
      { ctrl: true, shift: true, key: 'n' }, // Incognito
      { ctrl: true, shift: true, key: 'N' }, // Incognito
    ];

    const isForbidden = forbiddenKeys.some(forbidden => {
      return Object.keys(forbidden).every(prop => {
        if (prop === 'key') return e.key === forbidden[prop];
        if (prop === 'ctrl') return e.ctrlKey === forbidden[prop];
        if (prop === 'alt') return e.altKey === forbidden[prop];
        if (prop === 'shift') return e.shiftKey === forbidden[prop];
        return true;
      });
    });

    if (isForbidden) {
      e.preventDefault();
      e.stopPropagation();
      this.recordViolation('keyboard_shortcut', `Blocked shortcut: ${e.key}`);
      return false;
    }
  }

  // Update activity timestamp
  updateActivity() {
    this.lastActivity = Date.now();
  }

  // Get monitoring statistics
  async getStats() {
    if (!this.sessionId) return null;

    try {
      const response = await axios.get(`/api/monitoring/stats/${this.sessionId}`);
      return response.data.stats;
    } catch (error) {
      console.error('❌ Failed to get monitoring stats:', error);
      return null;
    }
  }

  // End monitoring session
  async endMonitoring(resultId = null) {
    if (!this.isMonitoring) return;

    console.log('🏁 Ending monitoring session...');
    this.isMonitoring = false;
    this.endTime = new Date(); // Set proper end time

    try {
      // Clear all intervals
      this.intervalIds.forEach(id => clearInterval(id));
      this.intervalIds = [];

      // Stop camera stream
      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
        this.stream = null;
      }

      // Remove canvas
      if (this.canvas && this.canvas.parentNode) {
        this.canvas.remove();
      }

      // Exit fullscreen
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }

      // Re-enable normal behavior
      document.body.style.userSelect = 'auto';
      document.body.style.webkitUserSelect = 'auto';
      document.body.style.cursor = 'auto';

      // End monitoring session on server with proper timestamps
      const response = await axios.post('/api/student/monitoring/end', {
        sessionId: this.sessionId,
        resultId,
        startTime: this.startTime,
        endTime: this.endTime
      });

      console.log('✅ Monitoring session ended successfully');
      return response.data;

    } catch (error) {
      console.error('❌ Failed to end monitoring:', error);
      return { success: false, message: 'Failed to end monitoring' };
    } finally {
      this.sessionId = null;
    }
  }

  // Get violation summary for display
  getViolationSummary() {
    return {
      totalViolations: Object.values(this.violationCounts).reduce((sum, count) => sum + count, 0),
      tabSwitches: this.violationCounts.tabSwitch || 0,
      fullscreenExits: this.violationCounts.fullscreenExit || 0,
      focusLosses: this.violationCounts.focusLoss || 0,
      isCurrentlyVisible: this.isVisible,
      lastActivity: this.lastActivity
    };
  }

  // Get comprehensive monitoring statistics for test submission
  async getMonitoringStats() {
    try {
      const violationSummary = this.getViolationSummary();
      
      // Get additional stats from server if session is active
      let serverStats = {};
      if (this.sessionId && this.isMonitoring) {
        try {
          const response = await axios.get(`/api/student/monitoring/stats?sessionId=${this.sessionId}`);
          if (response.data.success) {
            serverStats = response.data.stats;
          }
        } catch (error) {
          console.warn('Could not fetch server monitoring stats:', error);
        }
      }
      
      return {
        violations: [...this.violations, ...(serverStats.violations || [])],
        totalViolations: this.violations.length + (serverStats.totalViolations || 0),
        screenshots: [...this.screenshots, ...(serverStats.screenshots || [])],
        suspiciousActivities: [...this.suspiciousActivities, ...(serverStats.suspiciousActivities || [])],
        sessionId: this.sessionId,
        isMonitoring: this.isMonitoring,
        violationBreakdown: {
          tabSwitches: this.violationCounts.tabSwitch || 0,
          fullscreenExits: this.violationCounts.fullscreenExit || 0,
          focusLosses: this.violationCounts.focusLoss || 0
        },
        monitoringDuration: this.startTime ? Date.now() - this.startTime.getTime() : 0,
        lastActivity: this.lastActivity
      };
    } catch (error) {
      console.error('Failed to get monitoring stats:', error);
      return {
        violations: this.violations || [],
        totalViolations: this.violations?.length || 0,
        screenshots: this.screenshots || [],
        suspiciousActivities: this.suspiciousActivities || [],
        sessionId: this.sessionId,
        isMonitoring: this.isMonitoring,
        violationBreakdown: {
          tabSwitches: this.violationCounts?.tabSwitch || 0,
          fullscreenExits: this.violationCounts?.fullscreenExit || 0,
          focusLosses: this.violationCounts?.focusLoss || 0
        },
        monitoringDuration: 0,
        lastActivity: this.lastActivity
      };
    }
  }
}

// Export singleton instance
const testMonitoringSystem = new TestMonitoringSystem();
export default testMonitoringSystem;
