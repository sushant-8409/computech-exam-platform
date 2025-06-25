class PushNotificationManager {
  constructor() {
    this.publicVapidKey = process.env.REACT_APP_VAPID_PUBLIC_KEY || 'your-vapid-public-key';
    this.isSubscribed = false;
    this.subscription = null;
  }

  // Convert VAPID key to Uint8Array
  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // Check if push notifications are supported
  isSupported() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  // Initialize push notifications
  async initialize() {
    try {
      if (!this.isSupported()) {
        console.warn('Push notifications not supported');
        return false;
      }

      // Register service worker
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('✅ Service Worker registered:', registration);

      // Check existing subscription
      const existingSubscription = await registration.pushManager.getSubscription();
      if (existingSubscription) {
        this.subscription = existingSubscription;
        this.isSubscribed = true;
        console.log('✅ Existing push subscription found');
        
        // Verify with backend
        await this.verifySubscription();
      }

      return true;
    } catch (error) {
      console.error('❌ Failed to initialize push notifications:', error);
      return false;
    }
  }

  // Request permission and subscribe
  async subscribe() {
    try {
      if (!this.isSupported()) {
        throw new Error('Push notifications not supported');
      }

      // Request permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        throw new Error('Push notification permission denied');
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;
      
      // Subscribe to push notifications
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(this.publicVapidKey)
      });

      console.log('✅ Push subscription created:', subscription);

      // Send subscription to backend
      const response = await fetch('/api/student/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ 
          subscription,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString()
        })
      });

      const result = await response.json();
      
      if (result.success) {
        this.subscription = subscription;
        this.isSubscribed = true;
        console.log('✅ Push subscription sent to backend');
        return subscription;
      } else {
        throw new Error(result.message || 'Failed to register subscription');
      }

    } catch (error) {
      console.error('❌ Push subscription failed:', error);
      throw error;
    }
  }

  // Unsubscribe from push notifications
  async unsubscribe() {
    try {
      if (!this.subscription) {
        console.log('No active subscription to unsubscribe');
        return;
      }

      // Unsubscribe from browser
      const unsubscribed = await this.subscription.unsubscribe();
      
      if (unsubscribed) {
        // Notify backend
        await fetch('/api/student/push/unsubscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ 
            endpoint: this.subscription.endpoint 
          })
        });

        this.subscription = null;
        this.isSubscribed = false;
        console.log('✅ Unsubscribed from push notifications');
      }
      
    } catch (error) {
      console.error('❌ Push unsubscribe failed:', error);
      throw error;
    }
  }

  // Verify subscription with backend
  async verifySubscription() {
    try {
      const response = await fetch('/api/student/push/status', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      const result = await response.json();
      this.isSubscribed = result.success && result.subscribed;
      
      return result;
    } catch (error) {
      console.error('❌ Failed to verify subscription:', error);
      this.isSubscribed = false;
      return { success: false, subscribed: false };
    }
  }

  // Get subscription status
  getStatus() {
    return {
      supported: this.isSupported(),
      subscribed: this.isSubscribed,
      permission: Notification.permission
    };
  }

  // Test notification
  async sendTestNotification() {
    try {
      const response = await fetch('/api/student/test-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('❌ Test notification failed:', error);
      throw error;
    }
  }
}

export default new PushNotificationManager();
