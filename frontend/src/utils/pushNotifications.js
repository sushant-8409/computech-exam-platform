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
    const hasServiceWorker = 'serviceWorker' in navigator;
    const hasPushManager = 'PushManager' in window;
    const hasNotification = 'Notification' in window;
    
    console.log('🔍 Push notification support check:', {
      serviceWorker: hasServiceWorker,
      pushManager: hasPushManager,
      notification: hasNotification,
      overall: hasServiceWorker && hasPushManager && hasNotification
    });
    
    return hasServiceWorker && hasPushManager && hasNotification;
  }

  // Initialize push notifications
  async initialize() {
    try {
      console.log('🚀 Initializing push notification manager...');
      console.log('🌐 User Agent:', navigator.userAgent);
      console.log('🔒 Protocol:', window.location.protocol);
      console.log('🏠 Host:', window.location.host);
      
      const supported = this.isSupported();
      if (!supported) {
        console.warn('⚠️ Push notifications not supported in this browser');
        this.isSubscribed = false;
        return false;
      }

      console.log('✅ Push notifications are supported');

      // Reset state
      this.isSubscribed = false;
      this.subscription = null;

      // Check if we're on HTTPS or localhost
      const isSecure = window.location.protocol === 'https:' || 
                      window.location.hostname === 'localhost' || 
                      window.location.hostname === '127.0.0.1';
      
      if (!isSecure) {
        console.warn('⚠️ Push notifications require HTTPS or localhost');
        this.isSubscribed = false;
        return false;
      }

      console.log('🔒 Secure context confirmed');

      // Register service worker
      console.log('📝 Registering service worker...');
      let registration;
      
      try {
        registration = await navigator.serviceWorker.register('/sw.js');
        console.log('✅ Service Worker registered:', registration.scope);
      } catch (swError) {
        console.warn('⚠️ Service Worker registration failed:', swError);
        // Try alternative registration
        try {
          registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
          console.log('✅ Service Worker registered with explicit scope:', registration.scope);
        } catch (swError2) {
          console.error('❌ Service Worker registration failed completely:', swError2);
          throw new Error('Service Worker registration failed');
        }
      }

      // Wait for service worker to be ready
      console.log('⏳ Waiting for service worker to be ready...');
      await navigator.serviceWorker.ready;
      console.log('✅ Service Worker ready');

      // Check existing subscription
      console.log('🔍 Checking for existing subscription...');
      const existingSubscription = await registration.pushManager.getSubscription();
      
      if (existingSubscription) {
        console.log('🔍 Found existing push subscription:', existingSubscription);
        this.subscription = existingSubscription;
        this.isSubscribed = true;
        
        // Verify with backend (but don't fail if verification fails)
        try {
          console.log('🔍 Verifying subscription with backend...');
          const verificationResult = await this.verifySubscription();
          console.log('📱 Verification result:', verificationResult);
        } catch (error) {
          console.warn('⚠️ Subscription verification failed, but keeping existing subscription:', error.message);
        }
      } else {
        console.log('📭 No existing push subscription found');
        this.isSubscribed = false;
      }

      console.log(`📱 Push notification initialization complete. Status: ${this.isSubscribed ? 'subscribed' : 'not subscribed'}`);
      return true;
      
    } catch (error) {
      console.error('❌ Failed to initialize push notifications:', error);
      this.isSubscribed = false;
      this.subscription = null;
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
      console.log('🔍 Verifying push subscription with backend...');
      
      const response = await fetch('/api/student/push/status', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        console.warn(`⚠️ Push status check failed: ${response.status}`);
        // Don't change subscription state if verification fails - assume it's still valid
        return { success: false, subscribed: this.isSubscribed };
      }
      
      const result = await response.json();
      console.log('📱 Push status from backend:', result);
      
      // Only update subscription state if backend response is successful
      if (result.success) {
        this.isSubscribed = result.subscribed;
        console.log(`✅ Push subscription verified: ${this.isSubscribed ? 'active' : 'inactive'}`);
      }
      
      return result;
    } catch (error) {
      console.error('❌ Failed to verify subscription:', error);
      // Don't change subscription state on network errors - assume it's still valid
      console.log('🔄 Keeping existing subscription state due to verification error');
      return { success: false, subscribed: this.isSubscribed };
    }
  }

  // Get subscription status
  getStatus() {
    const supported = this.isSupported();
    const permission = 'Notification' in window ? Notification.permission : 'unavailable';
    
    console.log('📊 Getting push notification status:', {
      supported,
      subscribed: this.isSubscribed,
      permission,
      hasSubscription: !!this.subscription
    });
    
    return {
      supported,
      subscribed: this.isSubscribed,
      permission
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
