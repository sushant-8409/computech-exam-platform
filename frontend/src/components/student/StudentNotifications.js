import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import styles from './StudentNotifications.module.css';

const StudentNotifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    // Add a small delay to ensure the component is fully mounted
    const timer = setTimeout(() => {
      fetchNotifications();
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        console.error('No authentication token found');
        toast.error('Not authenticated. Please login again.');
        setLoading(false);
        return;
      }

      console.log('🔄 Fetching student notifications...');
      const response = await axios.get('/api/student/notifications', {
        headers: { Authorization: `Bearer ${token}` }
      });

      console.log('📨 Notifications response:', response.data);

      // Check if response is actually JSON and not HTML
      if (typeof response.data === 'string' && response.data.includes('<!DOCTYPE')) {
        throw new Error('Server returned HTML instead of JSON - this usually means the API endpoint is not found or there\'s a routing issue');
      }

      if (response.data.success) {
        setNotifications(response.data.notifications || []);
        console.log(`✅ Loaded ${response.data.notifications?.length || 0} notifications`);
      } else {
        console.error('Failed to fetch notifications:', response.data);
        toast.error('Failed to load notifications');
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      
      // Better error handling
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
        
        if (error.response.status === 401) {
          toast.error('Authentication failed. Please login again.');
        } else if (error.response.status === 500) {
          toast.error('Server error. Please try again later.');
        } else {
          toast.error(`Error ${error.response.status}: Failed to load notifications`);
        }
      } else if (error.request) {
        console.error('No response received:', error.request);
        toast.error('Unable to connect to server. Please check your connection.');
      } else {
        console.error('Request setup error:', error.message);
        toast.error('Failed to load notifications');
      }
    } finally {
      setLoading(false);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'test_created':
      case 'test_assignment':
        return '📝';
      case 'result_published':
        return '📊';
      case 'test_completed':
        return '✅';
      case 'system_alert':
        return '⚠️';
      case 'custom_message':
        return '💬';
      default:
        return '📢';
    }
  };

  const getNotificationTypeLabel = (type) => {
    switch (type) {
      case 'test_created':
      case 'test_assignment':
        return 'New Test';
      case 'result_published':
        return 'Results Published';
      case 'test_completed':
        return 'Test Completed';
      case 'system_alert':
        return 'System Alert';
      case 'custom_message':
        return 'Message';
      default:
        return 'Notification';
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)} hours ago`;
    } else if (diffInHours < 48) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  };

  const displayedNotifications = showAll ? notifications : notifications.slice(0, 5);

  if (loading) {
    return (
      <div className={styles.notificationsContainer}>
        <div className={styles.header}>
          <h3>📢 Notifications</h3>
        </div>
        <div className={styles.loading}>Loading notifications...</div>
      </div>
    );
  }

  return (
    <div className={styles.notificationsContainer}>
      <div className={styles.header}>
        <h3>📢 Notifications</h3>
        <button 
          className={styles.refreshBtn}
          onClick={fetchNotifications}
          title="Refresh notifications"
        >
          🔄
        </button>
      </div>

      {notifications.length === 0 && !loading ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📭</div>
          <p>No notifications yet</p>
          <span>You'll see important updates here when they arrive</span>
          <div style={{ marginTop: '16px' }}>
            <button 
              className={styles.refreshBtn}
              onClick={fetchNotifications}
              style={{ 
                background: 'var(--primary, #8b5cf6)', 
                color: 'white', 
                padding: '8px 16px', 
                borderRadius: '6px',
                fontSize: '14px'
              }}
            >
              🔄 Check for Updates
            </button>
          </div>
        </div>
      ) : notifications.length === 0 ? (
        <div className={styles.loading}>Loading notifications...</div>
      ) : (
        <>
          <div className={styles.notificationsList}>
            {displayedNotifications.map((notification) => (
              <div key={notification._id} className={styles.notificationItem}>
                <div className={styles.notificationIcon}>
                  {getNotificationIcon(notification.type)}
                </div>
                <div className={styles.notificationContent}>
                  <div className={styles.notificationHeader}>
                    <span className={styles.notificationType}>
                      {getNotificationTypeLabel(notification.type)}
                    </span>
                    <span className={styles.notificationTime}>
                      {formatDate(notification.createdAt)}
                    </span>
                  </div>
                  <h4 className={styles.notificationTitle}>{notification.title}</h4>
                  <p className={styles.notificationMessage}>{notification.message}</p>
                  <div className={styles.notificationStatus}>
                    {notification.emailSent && (
                      <span className={styles.statusBadge}>📧 Email</span>
                    )}
                    {notification.appNotificationSent && (
                      <span className={styles.statusBadge}>📱 Push</span>
                    )}
                    {notification.status === 'sent' && (
                      <span className={styles.statusDelivered}>✅ Delivered</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {notifications.length > 5 && (
            <div className={styles.showMoreContainer}>
              <button 
                className={styles.showMoreBtn}
                onClick={() => setShowAll(!showAll)}
              >
                {showAll ? 'Show Less' : `Show ${notifications.length - 5} More`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default StudentNotifications;
