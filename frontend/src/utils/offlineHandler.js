class OfflineHandler {
  constructor() {
    this.isOnline = navigator.onLine;
    this.setupEventListeners();
    this.setupOfflineStorage();
  }

  setupEventListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.syncOfflineData();
      this.showConnectionStatus('back online');
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.showConnectionStatus('offline - some features limited');
    });
  }

  setupOfflineStorage() {
    // Cache test data and results locally
    this.dbName = 'ComputechExamDB';
    this.version = 1;
  }

  showConnectionStatus(message) {
    // Show toast notification
    const toast = document.createElement('div');
    toast.className = 'offline-toast';
    toast.textContent = `Connection status: ${message}`;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      document.body.removeChild(toast);
    }, 3000);
  }

  async syncOfflineData() {
    // Sync any offline exam submissions
    const offlineSubmissions = JSON.parse(localStorage.getItem('offlineSubmissions') || '[]');
    
    for (const submission of offlineSubmissions) {
      try {
        await this.submitExamData(submission);
        // Remove from offline storage after successful sync
        this.removeFromOfflineStorage(submission.id);
      } catch (error) {
        console.error('Failed to sync submission:', error);
      }
    }
  }
}

export default new OfflineHandler();
