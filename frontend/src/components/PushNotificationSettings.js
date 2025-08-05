import React, { useState, useEffect } from 'react';
import pushManager from '../utils/pushNotifications';
import { toast } from 'react-toastify';
import styles from './PushNotificationSettings.module.css'; // ✅ Import CSS module

const PushNotificationSettings = () => {
  const [status, setStatus] = useState({
    supported: false,
    subscribed: false,
    permission: 'default'
  });
  const [loading, setLoading] = useState(false);
  const [showPermissionBanner, setShowPermissionBanner] = useState(false);

  useEffect(() => {
    initializePushNotifications();
  }, []);

  useEffect(() => {
    // Show permission banner if permission is denied or default
    setShowPermissionBanner(
      status.supported && 
      !status.subscribed && 
      (status.permission === 'denied' || status.permission === 'default')
    );
  }, [status]);

  const initializePushNotifications = async () => {
    try {
      setLoading(true);
      
      console.log('🔄 Initializing push notifications...');
      
      // Initialize push manager
      const initResult = await pushManager.initialize();
      console.log('📱 Push manager initialization result:', initResult);
      
      // Get current status
      const currentStatus = pushManager.getStatus();
      console.log('📊 Current push notification status:', currentStatus);
      setStatus(currentStatus);
      
    } catch (error) {
      console.error('❌ Failed to initialize push notifications:', error);
      toast.error('Failed to initialize push notifications');
      // Set a safe default state
      setStatus({
        supported: pushManager.isSupported(),
        subscribed: false,
        permission: Notification.permission
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async () => {
    try {
      setLoading(true);
      
      await pushManager.subscribe();
      
      // Update status
      const newStatus = pushManager.getStatus();
      setStatus(newStatus);
      
      toast.success('Push notifications enabled successfully!');
      
    } catch (error) {
      console.error('Subscription failed:', error);
      toast.error('Failed to enable push notifications: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUnsubscribe = async () => {
    try {
      setLoading(true);
      
      await pushManager.unsubscribe();
      
      // Update status
      const newStatus = pushManager.getStatus();
      setStatus(newStatus);
      
      toast.success('Push notifications disabled');
      
    } catch (error) {
      console.error('Unsubscribe failed:', error);
      toast.error('Failed to disable push notifications: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTestNotification = async () => {
    try {
      setLoading(true);
      
      await pushManager.sendTestNotification();
      toast.success('Test notification sent!');
      
    } catch (error) {
      console.error('Test notification failed:', error);
      toast.error('Failed to send test notification');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestPermission = async () => {
    try {
      const permission = await Notification.requestPermission();
      setStatus(prev => ({ ...prev, permission }));
      
      if (permission === 'granted') {
        toast.success('Notification permission granted!');
        setShowPermissionBanner(false);
      } else {
        toast.error('Notification permission denied');
      }
    } catch (error) {
      console.error('Permission request failed:', error);
      toast.error('Failed to request permission');
    }
  };

  if (!status.supported) {
    return (
      <div className={styles.pushNotificationSettings}>
        <h3>🔔 Push Notifications</h3>
        <div className={`${styles.notificationPermissionBanner} ${styles.denied}`}>
          <div className={`${styles.permissionBannerIcon} ${styles.denied}`}>
            ⚠️
          </div>
          <div className={styles.permissionBannerContent}>
            <h4 className={`${styles.permissionBannerTitle} ${styles.denied}`}>
              Not Supported
            </h4>
            <p className={`${styles.permissionBannerMessage} ${styles.denied}`}>
              Push notifications are not supported in this browser. Please try using a modern browser like Chrome, Firefox, or Safari.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.pushNotificationSettings}>
      <h3>🔔 Push Notifications</h3>
      
      {/* ✅ Permission Banner */}
      {showPermissionBanner && (
        <div className={`${styles.notificationPermissionBanner} ${
          status.permission === 'denied' ? styles.denied : ''
        }`}>
          <div className={`${styles.permissionBannerIcon} ${
            status.permission === 'denied' ? styles.denied : ''
          }`}>
            {status.permission === 'denied' ? '🔕' : '🔔'}
          </div>
          <div className={styles.permissionBannerContent}>
            <h4 className={`${styles.permissionBannerTitle} ${
              status.permission === 'denied' ? styles.denied : ''
            }`}>
              {status.permission === 'denied' 
                ? 'Notifications Blocked' 
                : 'Enable Notifications'
              }
            </h4>
            <p className={`${styles.permissionBannerMessage} ${
              status.permission === 'denied' ? styles.denied : ''
            }`}>
              {status.permission === 'denied'
                ? 'You have blocked notifications. Please enable them in your browser settings to receive updates.'
                : 'Allow notifications to get instant updates about new tests, results, and announcements.'
              }
            </p>
          </div>
          {status.permission !== 'denied' && (
            <div className={styles.permissionBannerActions}>
              <button 
                onClick={handleRequestPermission}
                className={`${styles.btn} ${styles.btnPrimary}`}
                disabled={loading}
              >
                {loading ? '⏳ Requesting...' : '🔔 Allow Notifications'}
              </button>
              <button 
                onClick={() => setShowPermissionBanner(false)}
                className={`${styles.btn} ${styles.btnOutline}`}
              >
                Maybe Later
              </button>
            </div>
          )}
        </div>
      )}

      {/* ✅ Notification Status */}
      <div className={styles.notificationStatus}>
        <p>
          <strong>Status:</strong> {status.subscribed ? '✅ Enabled' : '❌ Disabled'}
        </p>
        <p>
          <strong>Permission:</strong> {status.permission === 'granted' ? '✅ Granted' : 
            status.permission === 'denied' ? '❌ Denied' : '⏳ Not Set'}
        </p>
        {status.subscribed && (
          <p>
            <strong>Browser:</strong> {navigator.userAgent.includes('Chrome') ? '🟢 Chrome' : 
              navigator.userAgent.includes('Firefox') ? '🟠 Firefox' : 
              navigator.userAgent.includes('Safari') ? '🔵 Safari' : '🌐 Other'}
          </p>
        )}
      </div>

      {/* ✅ Notification Controls */}
      <div className={styles.notificationControls}>
        {!status.subscribed ? (
          <button 
            onClick={handleSubscribe}
            disabled={loading || status.permission !== 'granted'}
            className={`${styles.btn} ${styles.btnPrimary} ${loading ? styles.pulseAnimation : ''}`}
          >
            {loading ? (
              <>
                <span className={styles.loadingSpinner}>⏳</span>
                Enabling...
              </>
            ) : (
              <>
                🔔 Enable Notifications
              </>
            )}
          </button>
        ) : (
          <>
            <button 
              onClick={handleUnsubscribe}
              disabled={loading}
              className={`${styles.btn} ${styles.btnSecondary}`}
            >
              {loading ? '⏳ Disabling...' : '🔕 Disable Notifications'}
            </button>
            
            {/* <button 
              onClick={handleTestNotification}
              disabled={loading}
              className={`${styles.btn} ${styles.btnOutline}`}
            >
              {loading ? '⏳ Sending...' : '🧪 Test Notification'}
            </button> */}
          </>
        )}
      </div>

      {/* ✅ Notification Info */}
      <div className={styles.notificationInfo}>
        <small>
          💡 Enable push notifications to receive instant updates about new tests, 
          results, and important announcements. You can disable them anytime.
        </small>
        {status.subscribed && (
          <small style={{ display: 'block', marginTop: '0.5rem', color: '#10b981' }}>
            ✅ You're all set! You'll receive notifications when new content is available.
          </small>
        )}
      </div>
    </div>
  );
};

export default PushNotificationSettings;
