// utils/offlineHandler.js
import { toast } from 'react-toastify';

class OfflineHandler {
  constructor() {
    this.isOnline = navigator.onLine;
    this.pendingRequests = [];
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;

    console.log('🌐 Initializing offline handler...');
    
    // ✅ Listen for online/offline events
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));

    // ✅ Set initial state
    this.isOnline = navigator.onLine;
    this.initialized = true;

    // ✅ Check if app is already offline
    if (!this.isOnline) {
      this.handleOffline();
    }

    console.log('✅ Offline handler initialized, online status:', this.isOnline);

    // ✅ Return cleanup function
    return this.cleanup.bind(this);
  }

  handleOnline() {
    console.log('🟢 App came online');
    this.isOnline = true;
    
    toast.success('🌐 Connection restored! Syncing data...', {
      toastId: 'online-status'
    });

    // ✅ Process pending requests
    this.processPendingRequests();
    
    // ✅ Trigger data sync
    this.syncData();
  }

  handleOffline() {
    console.log('🔴 App went offline');
    this.isOnline = false;
    
    toast.warning('📡 You are offline. Some features may be limited.', {
      toastId: 'offline-status',
      autoClose: false
    });
  }

  // ✅ Queue requests when offline
  queueRequest(requestFn, options = {}) {
    if (this.isOnline) {
      return requestFn();
    }

    return new Promise((resolve, reject) => {
      this.pendingRequests.push({
        requestFn,
        resolve,
        reject,
        timestamp: Date.now(),
        ...options
      });

      console.log(`📝 Queued request (${this.pendingRequests.length} pending)`);
    });
  }

  // ✅ Process queued requests when back online
  async processPendingRequests() {
    if (!this.isOnline || this.pendingRequests.length === 0) return;

    console.log(`🔄 Processing ${this.pendingRequests.length} pending requests...`);

    const requests = [...this.pendingRequests];
    this.pendingRequests = [];

    for (const request of requests) {
      try {
        const result = await request.requestFn();
        request.resolve(result);
        console.log('✅ Processed pending request successfully');
      } catch (error) {
        console.error('❌ Failed to process pending request:', error);
        request.reject(error);
      }
    }

    if (requests.length > 0) {
      toast.success(`✅ Synced ${requests.length} pending actions`);
    }
  }

  // ✅ Sync data when back online
  async syncData() {
    try {
      // Sync any cached data, user progress, etc.
      const token = localStorage.getItem('token');
      if (token) {
        // You can add specific sync logic here
        console.log('🔄 Syncing user data...');
      }
    } catch (error) {
      console.error('❌ Data sync failed:', error);
    }
  }

  // ✅ Get current online status
  getOnlineStatus() {
    return this.isOnline;
  }

  // ✅ Cleanup event listeners
  cleanup() {
    console.log('🧹 Cleaning up offline handler...');
    window.removeEventListener('online', this.handleOnline.bind(this));
    window.removeEventListener('offline', this.handleOffline.bind(this));
    this.initialized = false;
  }
}

const offlineHandler = new OfflineHandler();
export default offlineHandler;
