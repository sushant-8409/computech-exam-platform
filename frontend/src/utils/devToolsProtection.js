class DevToolsProtection {
  constructor(options = {}) {
    this.maxViolations = options.maxViolations || 5; // Increased from 3 to 5
    this.violationCount = 0;
    this.isDestroyed = false;
    this.recursionFlag = false;
    this.onViolationCallback = options.onViolation || null;
    this.strictMode = options.strictMode || false;
    
    // Bind methods to preserve context
    this.recordViolation = this.recordViolation.bind(this);
    this.destroy = this.destroy.bind(this);
    
    // Initialize protection immediately
    this.init();
  }

  init() {
    if (this.isDestroyed) return;
    
    this.setupContextMenuProtection();
    this.setupKeyboardProtection();
    // Removed setupDevToolsDetection() - keyboard shortcuts are sufficient
    this.setupElementProtection();
    this.setupNetworkProtection();
    
    if (this.strictMode) {
      this.setupStrictModeProtections();
    }
  }

  recordViolation(type) {
    // Prevent infinite recursion
    if (this.recursionFlag || this.isDestroyed) return;
    this.recursionFlag = true;
    
    try {
      // Categorize violations by severity - Only keyboard shortcuts are critical
      const criticalViolations = [
        'F12 Key Press',
        'Ctrl+Shift+I',
        'Ctrl+Shift+J',
        'Ctrl+Shift+C'
      ];
      
      const isCritical = criticalViolations.includes(type);
      
      if (isCritical) {
        console.error(`🚨 CRITICAL Security violation detected: ${type} - IMMEDIATE TERMINATION`);
        
        // Call custom violation handler
        if (this.onViolationCallback) {
          this.onViolationCallback(type, this.violationCount);
        }
        
        // Send to server
        this.reportViolation(type);
        
        // Immediate termination for developer tools shortcuts
        this.enforceAction();
        return;
      } else {
        // Non-critical violations - count towards limit (including tab switching)
        this.violationCount++;
        console.warn(`⚠️ Security violation detected: ${type} (Count: ${this.violationCount}/${this.maxViolations})`);
        
        // Call custom violation handler
        if (this.onViolationCallback) {
          this.onViolationCallback(type, this.violationCount);
        }
        
        // Send to server
        this.reportViolation(type);
        
        // Check if max violations reached
        if (this.violationCount >= this.maxViolations) {
          this.enforceAction();
        }
      }
    } catch (error) {
      console.error('Error recording violation:', error);
    } finally {
      this.recursionFlag = false;
    }
  }

  async reportViolation(type) {
    try {
      await fetch('/api/security-violation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href
        })
      });
    } catch (error) {
      console.error('Failed to report violation:', error);
    }
  }

  setupContextMenuProtection() {
    document.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.recordViolation('Right Click Attempt');
    }, { passive: false });
  }

  setupKeyboardProtection() {
    document.addEventListener('keydown', (e) => {
      // F12
      if (e.key === 'F12') {
        e.preventDefault();
        this.recordViolation('F12 Key Press');
        return false;
      }
      
      // Ctrl+Shift+I (Dev Tools)
      if (e.ctrlKey && e.shiftKey && e.key === 'I') {
        e.preventDefault();
        this.recordViolation('Ctrl+Shift+I');
        return false;
      }
      
      // Ctrl+Shift+J (Console)
      if (e.ctrlKey && e.shiftKey && e.key === 'J') {
        e.preventDefault();
        this.recordViolation('Ctrl+Shift+J');
        return false;
      }
      
      // Ctrl+U (View Source)
      if (e.ctrlKey && e.key === 'u') {
        e.preventDefault();
        this.recordViolation('Ctrl+U');
        return false;
      }
      
      // Ctrl+Shift+C (Element Inspector)
      if (e.ctrlKey && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        this.recordViolation('Ctrl+Shift+C');
        return false;
      }
    }, { passive: false });
  }

  setupElementProtection() {
    // Protect against element inspection but be less aggressive
    document.addEventListener('selectstart', (e) => {
      // Allow text selection in input fields and textareas for answer typing
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return; // Allow selection in form fields
      }
      e.preventDefault();
      this.recordViolation('Text Selection Attempt');
    });
    
    document.addEventListener('dragstart', (e) => {
      // Allow drag in input fields
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }
      e.preventDefault();
      this.recordViolation('Drag Attempt');
    });
    
    // Disable text selection via CSS but allow in form elements
    const style = document.createElement('style');
    style.textContent = `
      * {
        user-select: none;
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
      }
      input, textarea, [contenteditable="true"] {
        user-select: text !important;
        -webkit-user-select: text !important;
        -moz-user-select: text !important;
        -ms-user-select: text !important;
      }
    `;
    document.head.appendChild(style);
    this.injectedStyle = style; // Store for cleanup
  }

  setupNetworkProtection() {
    // Store original fetch for cleanup
    if (!this.originalFetch) {
      this.originalFetch = window.fetch.bind(window);
    }
    
    // Monitor for network tab usage
    window.fetch = (...args) => {
      // Allow our own API calls and essential requests
      const url = args[0];
      if (typeof url === 'string' && (
        url.includes('/api/') || 
        url.includes('/static/') ||
        url.includes('localhost') ||
        url.includes('computech-exam-platform')
      )) {
        return this.originalFetch(...args);
      }
      
      // Only log suspicious external requests
      if (typeof url === 'string' && !url.startsWith('/')) {
        this.recordViolation('External Network Request');
      }
      
      return this.originalFetch(...args);
    };
  }

  setupStrictModeProtections() {
    // Monitor page visibility changes (tab switching) - counts as normal violation
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.recordViolation('Tab Switch During Exam');
      }
    });
    
    // Monitor window focus changes - counts as normal violation
    window.addEventListener('blur', () => {
      this.recordViolation('Window Lost Focus');
    });
    
    // Keep the same violation limit as regular mode
    // Tab switching is now treated as a normal violation (not critical)
  }

  enforceAction() {
    if (this.isDestroyed) return;
    
    // Check if this is a critical violation termination
    if (this.violationCount === 0) {
      // This means it was a critical violation (keyboard shortcut) - immediate logout
      console.error('🚨 CRITICAL VIOLATION: Developer tools detected - logging out immediately');
      
      // Clear any stored authentication data
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('refreshToken');
      sessionStorage.clear();
      
      // Redirect to login immediately without alert
      window.location.href = '/login?reason=security&violation=devtools';
      return;
    } else {
      // This is due to multiple non-critical violations - show warning before redirect
      alert(`⚠️ SECURITY ALERT: Multiple security violations detected (${this.violationCount}/${this.maxViolations})\n\nActions like right-clicking, text selection, tab switching, or window switching are not allowed during the exam.\n\nThe session will now be terminated.`);
      
      // Clear stored data for non-critical violations too
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('refreshToken');
      sessionStorage.clear();
    }
    
    // Redirect based on mode
    if (this.strictMode) {
      window.location.href = '/login?reason=security';
    } else {
      // Give user a moment to see their work before redirect (only for non-critical violations)
      setTimeout(() => {
        window.location.href = '/student?reason=security';
      }, 2000);
    }
  }

  destroy() {
    this.isDestroyed = true;
    
    // Remove injected styles
    if (this.injectedStyle && this.injectedStyle.parentNode) {
      this.injectedStyle.parentNode.removeChild(this.injectedStyle);
    }
    
    // Restore original fetch
    if (this.originalFetch) {
      window.fetch = this.originalFetch;
    }
    
    // Clear callbacks
    this.onViolationCallback = null;
  }
}

export default DevToolsProtection;
