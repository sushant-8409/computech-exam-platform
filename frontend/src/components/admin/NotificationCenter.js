import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import axios from 'axios';
import styles from './NotificationCenter.module.css';
import MultiSelect from './MultiSelect'

const NotificationCenter = () => {
  const [students, setStudents] = useState([]);
  const [tests, setTests] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [selectedTests, setSelectedTests] = useState([]);
  const [notificationType, setNotificationType] = useState('both');
  const [emailTemplate, setEmailTemplate] = useState('test_created');
  const [customMessage, setCustomMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    fetchStudents();
    fetchTests();
    fetchNotifications();
  }, []);

  const fetchStudents = async () => {
    try {
      const response = await axios.get('/api/admin/students');
      setStudents(response.data.students || []);
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  const fetchTests = async () => {
    try {
      const response = await axios.get('/api/admin/tests');
      setTests(response.data.tests || []);
    } catch (error) {
      console.error('Error fetching tests:', error);
    }
  };

  const fetchNotifications = async () => {
    try {
      const response = await axios.get('/api/admin/notifications');
      setNotifications(response.data.notifications || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const handleSendNotification = async () => {
  if (selectedStudents.length === 0 || selectedTests.length === 0) {
    toast.error('Please select at least one student and one test');
    return;
  }

  setLoading(true);
  try {
    const payload = {
      studentIds: selectedStudents.map(s => s.value),
      testIds: selectedTests.map(t => t.value),
      notificationType,
      emailTemplate, // ✅ This becomes the 'type' parameter
      customMessage,
      // ✅ Add explicit context to help with type detection
      context: {
        isResultNotification: emailTemplate === 'result_published',
        isTestNotification: ['test_created', 'test_assignment'].includes(emailTemplate),
        fromNotificationCenter: true
      }
    };

    console.log('📤 Sending notification with payload:', payload);

    await axios.post('/api/admin/notifications/send', payload);
    toast.success(`Notifications sent to ${selectedStudents.length} students`);
    
    // Reset form
    setSelectedStudents([]);
    setSelectedTests([]);
    setCustomMessage('');
    fetchNotifications();
  } catch (error) {
    toast.error('Failed to send notifications');
    console.error('Send notification error:', error);
  } finally {
    setLoading(false);
  }
};


  const studentOptions = students.map(student => ({
    value: student._id,
    label: `${student.name} (${student.email}) - Class ${student.class}`,
    data: student
  }));

  const testOptions = tests.map(test => ({
    value: test._id,
    label: `${test.title} - ${test.subject} (Class ${test.class})`,
    data: test
  }));

  return (
    <div className={styles.notificationCenter}>
      <div className={styles.header}>
        <h2>📢 Notification Center</h2>
        <p>Send notifications to students about tests and important updates</p>
      </div>

      <div className={styles.formSection}>
        <div className={styles.selectionGrid}>
          {/* Student Selection */}
          <div className={styles.selectGroup}>
            <label className={styles.label}>
              👥 Select Students *
              <span className={styles.selectedCount}>
                ({selectedStudents.length} selected)
              </span>
            </label>
            <MultiSelect
              options={studentOptions}
              value={selectedStudents}
              onChange={setSelectedStudents}
              placeholder="Choose students..."
              searchPlaceholder="Search students..."
            />
          </div>

          {/* Test Selection */}
          <div className={styles.selectGroup}>
            <label className={styles.label}>
              📝 Select Tests *
              <span className={styles.selectedCount}>
                ({selectedTests.length} selected)
              </span>
            </label>
            <MultiSelect
              options={testOptions}
              value={selectedTests}
              onChange={setSelectedTests}
              placeholder="Choose tests..."
              searchPlaceholder="Search tests..."
            />
          </div>
        </div>

        {/* Notification Type */}
        <div className={styles.notificationTypeGroup}>
          <label className={styles.label}>📨 Notification Type</label>
          <div className={styles.radioGroup}>
            <label className={styles.radioOption}>
              <input
                type="radio"
                value="email"
                checked={notificationType === 'email'}
                onChange={(e) => setNotificationType(e.target.value)}
              />
              <span className={styles.radioLabel}>📧 Email Only</span>
            </label>
            <label className={styles.radioOption}>
              <input
                type="radio"
                value="app"
                checked={notificationType === 'app'}
                onChange={(e) => setNotificationType(e.target.value)}
              />
              <span className={styles.radioLabel}>📱 App Only</span>
            </label>
            <label className={styles.radioOption}>
              <input
                type="radio"
                value="both"
                checked={notificationType === 'both'}
                onChange={(e) => setNotificationType(e.target.value)}
              />
              <span className={styles.radioLabel}>📧📱 Both</span>
            </label>
          </div>
        </div>

        {/* Email Template Selection */}
        {(notificationType === 'email' || notificationType === 'both') && (
          <div className={styles.templateGroup}>
            <label className={styles.label}>📄 Email Template</label>
            <select
              value={emailTemplate}
              onChange={(e) => setEmailTemplate(e.target.value)}
              className={styles.templateSelect}
            >
              <option value="test_created">Test Assigned</option>
              <option value="test_completed">Test Completed</option>
              <option value="result_published">Result Published</option>
              <option value="custom">Custom Message</option>
            </select>
          </div>
        )}

        {/* Custom Message */}
        <div className={styles.messageGroup}>
          <label className={styles.label}>✍️ Custom Message (Optional)</label>
          <textarea
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            placeholder="Add any additional message..."
            className={styles.messageTextarea}
            rows={4}
          />
        </div>

        {/* Preview Section */}
        {selectedStudents.length > 0 && selectedTests.length > 0 && (
          <div className={styles.previewSection}>
            <h3>📋 Preview</h3>
            <div className={styles.previewContent}>
              <p><strong>Recipients:</strong> {selectedStudents.length} students</p>
              <p><strong>Tests:</strong> {selectedTests.length} tests</p>
              <p><strong>Delivery:</strong> {notificationType}</p>
              
              <div className={styles.recipientList}>
                <strong>Selected Students:</strong>
                <ul>
                  {selectedStudents.slice(0, 3).map(student => (
                    <li key={student.value}>{student.label}</li>
                  ))}
                  {selectedStudents.length > 3 && (
                    <li>...and {selectedStudents.length - 3} more</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Send Button */}
        <div className={styles.actionGroup}>
          <button
            onClick={handleSendNotification}
            disabled={loading || selectedStudents.length === 0 || selectedTests.length === 0}
            className={styles.sendButton}
          >
            {loading ? '📤 Sending...' : '🚀 Send Notifications'}
          </button>
        </div>
      </div>

      {/* Recent Notifications */}
      <div className={styles.recentSection}>
        <h3>📜 Recent Notifications</h3>
        <div className={styles.notificationsList}>
          {notifications.length === 0 ? (
            <p className={styles.emptyState}>No notifications sent yet</p>
          ) : (
            notifications.map(notification => (
              <div key={notification._id} className={styles.notificationItem}>
                <div className={styles.notificationContent}>
                  <h4>{notification.title}</h4>
                  <p>{notification.message}</p>
                  <div className={styles.notificationMeta}>
                    <span>📧 {notification.emailCount} emails</span>
                    <span>📱 {notification.appCount} app notifications</span>
                    <span>🕒 {new Date(notification.createdAt).toLocaleString()}</span>
                  </div>
                </div>
                <div className={styles.notificationStatus}>
                  <span className={`${styles.statusBadge} ${styles[notification.status]}`}>
                    {notification.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationCenter;
