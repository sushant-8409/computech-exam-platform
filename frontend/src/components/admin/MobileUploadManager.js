import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import styles from './MobileUploadManager.module.css';

const MobileUploadManager = () => {
  const [uploadRequests, setUploadRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    uploadType: 'test-paper',
    testName: '',
    subject: '',
    instructions: 'Please upload your document using the mobile interface.',
    validityMinutes: 10,
    allowedTypes: ['pdf', 'jpg', 'jpeg', 'png']
  });
  const [formErrors, setFormErrors] = useState({});
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadUploadRequests();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadUploadRequests, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadUploadRequests = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/mobile-upload/my-requests?limit=20', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setUploadRequests(response.data.data);
      }
    } catch (error) {
      console.error('Error loading upload requests:', error);
      toast.error('Failed to load upload requests');
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const errors = {};

    // Email validation
    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Invalid email format';
    }

    // Test name validation
    if (!formData.testName.trim()) {
      errors.testName = 'Test/Document name is required';
    }

    // Subject validation
    if (!formData.subject.trim()) {
      errors.subject = 'Subject is required';
    }

    // Validity validation
    if (formData.validityMinutes < 1 || formData.validityMinutes > 60) {
      errors.validityMinutes = 'Validity must be between 1 and 60 minutes';
    }

    // Instructions validation
    if (!formData.instructions.trim()) {
      errors.instructions = 'Instructions are required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateRequest = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Please fix form errors');
      return;
    }

    try {
      setCreating(true);
      const token = localStorage.getItem('token');
      
      const requestData = {
        email: formData.email.trim(),
        uploadType: formData.uploadType,
        uploadContext: {
          testName: formData.testName.trim(),
          subject: formData.subject.trim(),
          instructions: formData.instructions.trim(),
          allowedTypes: formData.allowedTypes
        },
        validityMinutes: parseInt(formData.validityMinutes)
      };

      const response = await axios.post('/api/mobile-upload/request', requestData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        toast.success('Mobile upload link sent successfully!');
        setShowCreateForm(false);
        setFormData({
          email: '',
          uploadType: 'test-paper',
          testName: '',
          subject: '',
          instructions: 'Please upload your document using the mobile interface.',
          validityMinutes: 10,
          allowedTypes: ['pdf', 'jpg', 'jpeg', 'png']
        });
        setFormErrors({});
        loadUploadRequests();
      }
    } catch (error) {
      console.error('Error creating upload request:', error);
      const errorMessage = error.response?.data?.error || 'Failed to create upload request';
      toast.error(errorMessage);
    } finally {
      setCreating(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleFileTypeChange = (type) => {
    setFormData(prev => ({
      ...prev,
      allowedTypes: prev.allowedTypes.includes(type)
        ? prev.allowedTypes.filter(t => t !== type)
        : [...prev.allowedTypes, type]
    }));
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { class: 'pending', text: 'Pending', icon: '⏳' },
      accessed: { class: 'accessed', text: 'Accessed', icon: '👁️' },
      uploaded: { class: 'uploaded', text: 'Uploaded', icon: '✅' },
      expired: { class: 'expired', text: 'Expired', icon: '⏰' },
      cancelled: { class: 'cancelled', text: 'Cancelled', icon: '❌' }
    };
    
    const config = statusConfig[status] || statusConfig.pending;
    return (
      <span className={`${styles.statusBadge} ${styles[config.class]}`}>
        {config.icon} {config.text}
      </span>
    );
  };

  const formatTimeRemaining = (expiresAt) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const remaining = expires.getTime() - now.getTime();
    
    if (remaining <= 0) {
      return 'Expired';
    }
    
    const minutes = Math.floor(remaining / (1000 * 60));
    const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
    
    return `${minutes}m ${seconds}s`;
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const copyUploadLink = (token) => {
    const baseUrl = window.location.origin;
    const uploadUrl = `${baseUrl}/mobile-upload/${token}`;
    navigator.clipboard.writeText(uploadUrl);
    toast.success('Upload link copied to clipboard!');
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p>Loading mobile upload requests...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>📱 Mobile Upload Manager</h2>
        <p>Send secure upload links to users for mobile document submission</p>
        <button 
          className={styles.createButton}
          onClick={() => setShowCreateForm(true)}
        >
          ➕ Create Upload Link
        </button>
      </div>

      {showCreateForm && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>Create Mobile Upload Link</h3>
              <button 
                className={styles.closeButton}
                onClick={() => setShowCreateForm(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateRequest} className={styles.form}>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Email Address *</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="user@example.com"
                    className={formErrors.email ? styles.error : ''}
                  />
                  {formErrors.email && <span className={styles.errorText}>{formErrors.email}</span>}
                </div>

                <div className={styles.formGroup}>
                  <label>Upload Type</label>
                  <select
                    name="uploadType"
                    value={formData.uploadType}
                    onChange={handleInputChange}
                  >
                    <option value="test-paper">Test Paper</option>
                    <option value="document">Document</option>
                    <option value="assignment">Assignment</option>
                  </select>
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Test/Document Name *</label>
                  <input
                    type="text"
                    name="testName"
                    value={formData.testName}
                    onChange={handleInputChange}
                    placeholder="e.g., Math Quiz 1, Assignment 2"
                    className={formErrors.testName ? styles.error : ''}
                  />
                  {formErrors.testName && <span className={styles.errorText}>{formErrors.testName}</span>}
                </div>

                <div className={styles.formGroup}>
                  <label>Subject *</label>
                  <input
                    type="text"
                    name="subject"
                    value={formData.subject}
                    onChange={handleInputChange}
                    placeholder="e.g., Mathematics, Computer Science"
                    className={formErrors.subject ? styles.error : ''}
                  />
                  {formErrors.subject && <span className={styles.errorText}>{formErrors.subject}</span>}
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Instructions *</label>
                <textarea
                  name="instructions"
                  value={formData.instructions}
                  onChange={handleInputChange}
                  rows={3}
                  placeholder="Provide clear instructions for the upload..."
                  className={formErrors.instructions ? styles.error : ''}
                />
                {formErrors.instructions && <span className={styles.errorText}>{formErrors.instructions}</span>}
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Link Validity (minutes) *</label>
                  <input
                    type="number"
                    name="validityMinutes"
                    value={formData.validityMinutes}
                    onChange={handleInputChange}
                    min="1"
                    max="60"
                    className={formErrors.validityMinutes ? styles.error : ''}
                  />
                  {formErrors.validityMinutes && <span className={styles.errorText}>{formErrors.validityMinutes}</span>}
                </div>

                <div className={styles.formGroup}>
                  <label>Allowed File Types</label>
                  <div className={styles.checkboxGroup}>
                    {['pdf', 'jpg', 'jpeg', 'png'].map(type => (
                      <label key={type} className={styles.checkboxLabel}>
                        <input
                          type="checkbox"
                          checked={formData.allowedTypes.includes(type)}
                          onChange={() => handleFileTypeChange(type)}
                        />
                        {type.toUpperCase()}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className={styles.formActions}>
                <button
                  type="button"
                  className={styles.cancelButton}
                  onClick={() => setShowCreateForm(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.submitButton}
                  disabled={creating}
                >
                  {creating ? 'Creating...' : 'Create & Send Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className={styles.requestsList}>
        {uploadRequests.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>📱</div>
            <h3>No Upload Requests</h3>
            <p>Create your first mobile upload link to get started.</p>
          </div>
        ) : (
          uploadRequests.map(request => (
            <div key={request._id} className={styles.requestCard}>
              <div className={styles.requestHeader}>
                <div className={styles.requestTitle}>
                  <strong>{request.uploadContext.testName}</strong>
                  <span className={styles.requestSubject}>{request.uploadContext.subject}</span>
                </div>
                {getStatusBadge(request.status)}
              </div>

              <div className={styles.requestDetails}>
                <div className={styles.detailItem}>
                  <strong>Email:</strong> {request.email}
                </div>
                <div className={styles.detailItem}>
                  <strong>Type:</strong> {request.uploadType.replace('-', ' ').toUpperCase()}
                </div>
                <div className={styles.detailItem}>
                  <strong>Created:</strong> {new Date(request.createdAt).toLocaleString()}
                </div>
                <div className={styles.detailItem}>
                  <strong>Expires:</strong> {new Date(request.expiresAt).toLocaleString()}
                </div>
                {request.status !== 'expired' && request.status !== 'uploaded' && (
                  <div className={styles.detailItem}>
                    <strong>Time Remaining:</strong> {formatTimeRemaining(request.expiresAt)}
                  </div>
                )}
              </div>

              {request.uploadedFiles?.length > 0 && (
                <div className={styles.uploadedFiles}>
                  <strong>Uploaded Files:</strong>
                  {request.uploadedFiles.map((file, index) => (
                    <div key={index} className={styles.uploadedFile}>
                      📄 {file.filename} ({formatFileSize(file.size)})
                      <span className={styles.uploadTime}>
                        {new Date(file.uploadedAt).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className={styles.requestActions}>
                <button
                  className={styles.copyButton}
                  onClick={() => copyUploadLink(request.token)}
                  title="Copy upload link"
                >
                  📋 Copy Link
                </button>
                
                {request.analytics && (
                  <div className={styles.analytics}>
                    <span>👁️ {request.analytics.linkClicks} views</span>
                    <span>📤 {request.analytics.uploadAttempts} attempts</span>
                    <span>✅ {request.analytics.successfulUploads} successful</span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default MobileUploadManager;