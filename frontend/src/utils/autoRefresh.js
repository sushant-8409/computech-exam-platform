// Auto-refresh utility for handling cookie expiration and codebase changes
class AutoRefreshManager {
  constructor() {
    this.lastCodebaseCheck = localStorage.getItem('lastCodebaseCheck') || Date.now();
    this.codebaseVersion = localStorage.getItem('codebaseVersion') || '1.0.0';
    this.refreshInterval = 5 * 60 * 1000; // 5 minutes
    this.isRefreshing = false;
    
    this.init();
  }

  init() {
    // Check for codebase changes periodically
    setInterval(() => {
      this.checkCodebaseChanges();
    }, this.refreshInterval);

    // Check for expired cookies on focus
    window.addEventListener('focus', () => {
      this.checkCookieExpiration();
    });

    // Handle page visibility change
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.checkCookieExpiration();
      }
    });

    // Initial check
    this.checkCodebaseChanges();
    this.checkCookieExpiration();
  }

  async checkCodebaseChanges() {
    if (this.isRefreshing) return;

    try {
      // Check if main bundle has changed
      const response = await fetch('/static/js/main.js', { method: 'HEAD' });
      const lastModified = response.headers.get('last-modified');
      const etag = response.headers.get('etag');
      
      const storedLastModified = localStorage.getItem('bundleLastModified');
      const storedEtag = localStorage.getItem('bundleEtag');

      if ((lastModified && lastModified !== storedLastModified) || 
          (etag && etag !== storedEtag)) {
        
        localStorage.setItem('bundleLastModified', lastModified || '');
        localStorage.setItem('bundleEtag', etag || '');
        
        this.handleCodebaseChange();
      }
    } catch (error) {
      console.warn('Could not check for codebase changes:', error);
    }
  }

  checkCookieExpiration() {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      // Simple JWT expiration check
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      
      // If token expires in less than 5 minutes, refresh
      if (payload.exp && payload.exp - currentTime < 300) {
        this.refreshToken();
      }
    } catch (error) {
      console.warn('Could not check token expiration:', error);
    }
  }

  async refreshToken() {
    if (this.isRefreshing) return;
    this.isRefreshing = true;

    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.token) {
          localStorage.setItem('token', data.token);
          console.log('Token refreshed successfully');
        }
      } else {
        // Token refresh failed, redirect to login
        this.handleTokenExpiration();
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      this.handleTokenExpiration();
    } finally {
      this.isRefreshing = false;
    }
  }

  handleCodebaseChange() {
    // Show notification about codebase update
    if (window.toast) {
      window.toast.info('New version available! Refreshing page...', {
        position: 'top-center',
        autoClose: 3000
      });
    }

    // Refresh page after short delay
    setTimeout(() => {
      window.location.reload();
    }, 3000);
  }

  handleTokenExpiration() {
    // Clear expired token
    localStorage.removeItem('token');
    
    if (window.toast) {
      window.toast.error('Session expired. Please login again.', {
        position: 'top-center',
        autoClose: 5000
      });
    }

    // Redirect to login after delay
    setTimeout(() => {
      window.location.href = '/login';
    }, 2000);
  }

  // Manual refresh method
  forceRefresh() {
    window.location.reload();
  }

  // Update codebase version manually
  updateCodebaseVersion(version) {
    this.codebaseVersion = version;
    localStorage.setItem('codebaseVersion', version);
    localStorage.setItem('lastCodebaseCheck', Date.now());
  }
}

// Initialize auto-refresh manager
const autoRefreshManager = new AutoRefreshManager();

// Export for manual use if needed
window.autoRefreshManager = autoRefreshManager;

export default autoRefreshManager;
