import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import axios from 'axios';
import styles from './NotificationSettings.module.css';

const NotificationSettings = () => {
  const [settings, setSettings] = useState({
    emailNotifications: true,
    appNotifications: true,
    emailTemplates: {
      test_assigned: {
        subject: 'New Test Assigned - {{testTitle}}',
        body: `Hello {{studentName}},

A new test has been assigned to you:

Test: {{testTitle}}
Subject: {{testSubject}}
Class: {{testClass}}
Start Date: {{startDate}}
End Date: {{endDate}}
Duration: {{duration}} minutes
Total Marks: {{totalMarks}}

Please login to your account to take the test.

Best regards,
CompuTech Team`
      },
      test_reminder: {
        subject: 'Reminder: Test Due Soon - {{testTitle}}',
        body: `Hello {{studentName}},

This is a reminder that the test "{{testTitle}}" is due soon.

Test Details:
- Subject: {{testSubject}}
- End Date: {{endDate}}
- Duration: {{duration}} minutes

Please complete the test before the deadline.

Best regards,
CompuTech Team`
      },
      result_published: {
        subject: 'Test Results Published - {{testTitle}}',
        body: `Hello {{studentName}},

Your test results for "{{testTitle}}" have been published.

You can view your results by logging into your account.

Best regards,
CompuTech Team`
      }
    },
    appNotificationSettings: {
      showBadge: true,
      soundEnabled: true,
      vibrationEnabled: true
    }
  });

  const [loading, setLoading] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState('test_assigned');
  const [testLoading, setTestLoading] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await axios.get('/api/admin/notification-settings');
      setSettings({ ...settings, ...response.data.settings });
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const handleSaveSettings = async () => {
    setLoading(true);
    try {
      await axios.post('/api/admin/notification-settings', { settings });
      toast.success('Settings saved successfully');
    } catch (error) {
      toast.error('Failed to save settings');
      console.error('Save settings error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTestNotification = async () => {
    setTestLoading(true);
    try {
      // Get some test students - you might want to replace this with actual students
      const testStudents = [
        { 
          name: 'Test Student', 
          email: 'test@example.com', // Replace with actual email for testing
          _id: 'test-student-id' 
        }
      ];

      await axios.post('/api/admin/test-notification', {
        type: 'test_created',
        message: 'This is a test notification to verify the notification system is working correctly.',
        students: testStudents
      });

      toast.success('Test notification sent! Check your email and app notifications.');
    } catch (error) {
      toast.error('Failed to send test notification');
      console.error('Test notification error:', error);
    } finally {
      setTestLoading(false);
    }
  };

  const handleTemplateChange = (field, value) => {
    setSettings(prev => ({
      ...prev,
      emailTemplates: {
        ...prev.emailTemplates,
        [activeTemplate]: {
          ...prev.emailTemplates[activeTemplate],
          [field]: value
        }
      }
    }));
  };

  const handleSettingChange = (path, value) => {
    const pathArray = path.split('.');
    setSettings(prev => {
      const newSettings = { ...prev };
      let current = newSettings;
      
      for (let i = 0; i < pathArray.length - 1; i++) {
        current = current[pathArray[i]];
      }
      
      current[pathArray[pathArray.length - 1]] = value;
      return newSettings;
    });
  };

  const templateOptions = [
    { value: 'test_assigned', label: 'Test Assignment' },
    { value: 'test_reminder', label: 'Test Reminder' },
    { value: 'result_published', label: 'Result Published' }
  ];

  return (
    <div className={styles.notificationSettings}>
      <div className={styles.header}>
        <h2>⚙️ Notification Settings</h2>
        <p>Configure email templates and notification preferences</p>
      </div>

      <div className={styles.settingsGrid}>
        {/* General Settings */}
        <div className={styles.settingsSection}>
          <h3>📋 General Settings</h3>
          <div className={styles.settingItem}>
            <label className={styles.settingLabel}>
              <input
                type="checkbox"
                checked={settings.emailNotifications}
                onChange={(e) => handleSettingChange('emailNotifications', e.target.checked)}
              />
              <span>📧 Enable Email Notifications</span>
            </label>
          </div>
          <div className={styles.settingItem}>
            <label className={styles.settingLabel}>
              <input
                type="checkbox"
                checked={settings.appNotifications}
                onChange={(e) => handleSettingChange('appNotifications', e.target.checked)}
              />
              <span>📱 Enable App Notifications</span>
            </label>
          </div>
        </div>

        {/* App Notification Settings */}
        <div className={styles.settingsSection}>
          <h3>📱 App Notification Settings</h3>
          <div className={styles.settingItem}>
            <label className={styles.settingLabel}>
              <input
                type="checkbox"
                checked={settings.appNotificationSettings.showBadge}
                onChange={(e) => handleSettingChange('appNotificationSettings.showBadge', e.target.checked)}
              />
              <span>🔴 Show Badge Count</span>
            </label>
          </div>
          <div className={styles.settingItem}>
            <label className={styles.settingLabel}>
              <input
                type="checkbox"
                checked={settings.appNotificationSettings.soundEnabled}
                onChange={(e) => handleSettingChange('appNotificationSettings.soundEnabled', e.target.checked)}
              />
              <span>🔊 Enable Sound</span>
            </label>
          </div>
          <div className={styles.settingItem}>
            <label className={styles.settingLabel}>
              <input
                type="checkbox"
                checked={settings.appNotificationSettings.vibrationEnabled}
                onChange={(e) => handleSettingChange('appNotificationSettings.vibrationEnabled', e.target.checked)}
              />
              <span>📳 Enable Vibration</span>
            </label>
          </div>
        </div>
      </div>

      {/* Email Templates */}
      <div className={styles.templatesSection}>
        <h3>📄 Email Templates</h3>
        
        <div className={styles.templateSelector}>
          <label>Select Template:</label>
          <select
            value={activeTemplate}
            onChange={(e) => setActiveTemplate(e.target.value)}
            className={styles.templateSelect}
          >
            {templateOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.templateEditor}>
          <div className={styles.formGroup}>
            <label>📧 Email Subject</label>
            <input
              type="text"
              value={settings.emailTemplates[activeTemplate]?.subject || ''}
              onChange={(e) => handleTemplateChange('subject', e.target.value)}
              className={styles.subjectInput}
              placeholder="Email subject..."
            />
          </div>

          <div className={styles.formGroup}>
            <label>📝 Email Body</label>
            <textarea
              value={settings.emailTemplates[activeTemplate]?.body || ''}
              onChange={(e) => handleTemplateChange('body', e.target.value)}
              className={styles.bodyTextarea}
              rows={12}
              placeholder="Email body..."
            />
          </div>

          <div className={styles.templateVariables}>
            <h4>📋 Available Variables</h4>
            <div className={styles.variablesList}>
              <span className={styles.variable}>{'{{studentName}}'}</span>
              <span className={styles.variable}>{'{{testTitle}}'}</span>
              <span className={styles.variable}>{'{{testSubject}}'}</span>
              <span className={styles.variable}>{'{{testClass}}'}</span>
              <span className={styles.variable}>{'{{startDate}}'}</span>
              <span className={styles.variable}>{'{{endDate}}'}</span>
              <span className={styles.variable}>{'{{duration}}'}</span>
              <span className={styles.variable}>{'{{totalMarks}}'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.actionButtons}>
        <button
          onClick={handleTestNotification}
          disabled={testLoading}
          className={styles.testButton}
        >
          {testLoading ? '🧪 Testing...' : '🧪 Send Test Notification'}
        </button>
        <button
          onClick={handleSaveSettings}
          disabled={loading}
          className={styles.saveButton}
        >
          {loading ? '💾 Saving...' : '💾 Save Settings'}
        </button>
      </div>
    </div>
  );
};

export default NotificationSettings;
