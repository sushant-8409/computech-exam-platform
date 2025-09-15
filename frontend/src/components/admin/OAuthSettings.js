import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useTheme } from '../../App';
import styles from './OAuthSettings.module.css';

const OAuthSettings = () => {
  const { darkMode } = useTheme();
  const [credentials, setCredentials] = useState(null);
  const [envConfig, setEnvConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    clientId: '',
    clientSecret: '',
    redirectUri: process.env.REACT_APP_API_URL ? `${process.env.REACT_APP_API_URL.replace(/\/$/, '')}/auth/google/callback` : 'http://localhost:5000/auth/google/callback',
    scopes: [
      'profile',
      'email',
      'https://www.googleapis.com/auth/drive.file'
    ]
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    loadCredentials();
    loadEnvConfig();
    checkAdminOAuthStatus();
  }, []);

  const checkAdminOAuthStatus = async () => {
    try {
      const response = await axios.get('/auth/google/admin-status');
      setConnectionStatus(response.data);
      setIsConnected(response.data.connected);
    } catch (error) {
      console.error('Error checking admin OAuth status:', error);
      setIsConnected(false);
    }
  };

  const loadCredentials = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/admin/oauth-credentials', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setCredentials(response.data.credentials);
        if (response.data.credentials) {
          setFormData({
            clientId: response.data.credentials.clientId,
            clientSecret: '', // Don't populate sensitive data
            redirectUri: response.data.credentials.redirectUri,
            scopes: response.data.credentials.scopes
          });
        }
      }
    } catch (error) {
      console.error('Error loading OAuth credentials:', error);
      toast.error('Failed to load OAuth credentials');
    } finally {
      setLoading(false);
    }
  };

  const loadEnvConfig = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/admin/oauth-credentials/current-env', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setEnvConfig(response.data.envConfig);
      }
    } catch (error) {
      console.error('Error loading environment config:', error);
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.clientId.trim()) {
      newErrors.clientId = 'Client ID is required';
    } else if (!/^[\w\-\.]+\.apps\.googleusercontent\.com$/.test(formData.clientId)) {
      newErrors.clientId = 'Invalid Google Client ID format';
    }

    if (!formData.clientSecret.trim()) {
      newErrors.clientSecret = 'Client Secret is required';
    } else if (formData.clientSecret.length < 20) {
      newErrors.clientSecret = 'Client Secret seems too short';
    }

    if (!formData.redirectUri.trim()) {
      newErrors.redirectUri = 'Redirect URI is required';
    } else if (!/^https?:\/\/.+/.test(formData.redirectUri)) {
      newErrors.redirectUri = 'Invalid URI format';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/admin/oauth-credentials', formData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        toast.success('OAuth credentials updated successfully');
        setCredentials(response.data.credentials);
        setShowForm(false);
        // Clear sensitive data from form
        setFormData(prev => ({ ...prev, clientSecret: '' }));
      }
    } catch (error) {
      console.error('Error updating OAuth credentials:', error);
      toast.error(error.response?.data?.message || 'Failed to update OAuth credentials');
    } finally {
      setSaving(false);
    }
  };

  const handleValidate = async () => {
    setValidating(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/admin/oauth-credentials/validate', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        if (response.data.isValid) {
          toast.success('OAuth credentials are valid');
        } else {
          toast.error(`Validation failed: ${response.data.validationError}`);
        }
        loadCredentials(); // Refresh to get updated validation status
      }
    } catch (error) {
      console.error('Error validating OAuth credentials:', error);
      toast.error('Failed to validate OAuth credentials');
    } finally {
      setValidating(false);
    }
  };

  const handleDelete = async () => {
    if (!credentials) return;

    const confirmed = window.confirm('Are you sure you want to delete these OAuth credentials? This will break Google authentication until new credentials are configured.');
    if (!confirmed) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/api/admin/oauth-credentials/${credentials._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('OAuth credentials deleted successfully');
      setCredentials(null);
      setFormData({
        clientId: '',
        clientSecret: '',
        redirectUri: 'http://localhost:5000/auth/google/callback',
        scopes: [
          'profile',
          'email',
          'https://www.googleapis.com/auth/drive.file'
        ]
      });
    } catch (error) {
      console.error('Error deleting OAuth credentials:', error);
      toast.error('Failed to delete OAuth credentials');
    }
  };

  const handleScopeChange = (scope, checked) => {
    setFormData(prev => ({
      ...prev,
      scopes: checked 
        ? [...prev.scopes, scope]
        : prev.scopes.filter(s => s !== scope)
    }));
  };

  const handleGoogleOAuthConnection = () => {
    const oauthWindow = window.open(
      '/auth/google?flow=admin', 
      'googleOAuth', 
      'width=500,height=600,scrollbars=yes,resizable=yes'
    );
    
    // Check periodically if the window is closed
    const checkClosed = setInterval(() => {
      if (oauthWindow.closed) {
        clearInterval(checkClosed);
        // Re-check OAuth status after connection
        setTimeout(() => {
          checkAdminOAuthStatus();
          toast.success('🔄 Checking OAuth connection status...');
        }, 1000);
      }
    }, 1000);
  };

  const handleDisconnectOAuth = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to disconnect Google OAuth? This will disable Google Drive integration.'
    );
    
    if (!confirmed) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete('/api/admin/oauth-disconnect', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Google OAuth disconnected successfully');
      setIsConnected(false);
      setConnectionStatus(null);
    } catch (error) {
      console.error('Error disconnecting OAuth:', error);
      toast.error('Failed to disconnect OAuth');
    }
  };

  if (loading) {
    return (
      <div className={`${styles.container} ${darkMode ? styles.dark : styles.light}`}>
        <div className={styles.loading}>Loading OAuth settings...</div>
      </div>
    );
  }

  return (
    <div className={`${styles.container} ${darkMode ? styles.dark : styles.light}`}>
      <div className={styles.header}>
        <h2>🔑 Google OAuth Configuration</h2>
        <p>Connect your Google account to enable Google Drive integration for file uploads</p>
      </div>

      {/* Google OAuth Connection Status */}
      <div className={`${styles.connectionSection} ${isConnected ? styles.connected : styles.disconnected}`}>
        <div className={styles.connectionHeader}>
          <div className={styles.connectionStatus}>
            <div className={styles.statusIcon}>
              {isConnected ? '🟢' : '🔴'}
            </div>
            <div className={styles.statusText}>
              <h3>{isConnected ? 'Google OAuth Connected' : 'Google OAuth Not Connected'}</h3>
              <p>
                {isConnected 
                  ? 'Your Google account is connected and ready for file uploads'
                  : 'Connect your Google account to enable Google Drive integration'
                }
              </p>
            </div>
          </div>
          <div className={styles.connectionActions}>
            {isConnected ? (
              <button 
                onClick={handleDisconnectOAuth}
                className={`${styles.btn} ${styles.btnDanger}`}
              >
                🔌 Disconnect
              </button>
            ) : (
              <button 
                onClick={handleGoogleOAuthConnection}
                className={`${styles.btn} ${styles.btnPrimary}`}
              >
                🔗 Connect Google Account
              </button>
            )}
          </div>
        </div>

        {/* Connection Details */}
        {isConnected && connectionStatus && (
          <div className={styles.connectionDetails}>
            <div className={styles.detailsGrid}>
              <div className={styles.detailItem}>
                <label>Connected Account:</label>
                <span>{connectionStatus.email || 'Unknown'}</span>
              </div>
              <div className={styles.detailItem}>
                <label>Connection Date:</label>
                <span>{connectionStatus.connectedAt ? new Date(connectionStatus.connectedAt).toLocaleDateString() : 'Unknown'}</span>
              </div>
              <div className={styles.detailItem}>
                <label>Drive Access:</label>
                <span className={styles.statusBadge}>
                  {connectionStatus.driveAccess ? '✅ Enabled' : '❌ Limited'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Environment Configuration Display */}
      {envConfig && (
        <div className={styles.envSection}>
          <h3>Current Environment Configuration</h3>
          <div className={styles.envGrid}>
            <div className={styles.envItem}>
              <label>Client ID:</label>
              <span className={envConfig.hasClientId ? styles.present : styles.missing}>
                {envConfig.hasClientId ? envConfig.clientIdPreview : 'Not set'}
              </span>
            </div>
            <div className={styles.envItem}>
              <label>Client Secret:</label>
              <span className={envConfig.hasClientSecret ? styles.present : styles.missing}>
                {envConfig.hasClientSecret ? '••••••••••••••••' : 'Not set'}
              </span>
            </div>
            <div className={styles.envItem}>
              <label>Redirect URI:</label>
              <span>{envConfig.redirectUri}</span>
            </div>
          </div>
        </div>
      )}

      {/* Current Database Configuration */}
      {credentials ? (
        <div className={styles.currentSection}>
          <div className={styles.sectionHeader}>
            <h3>Current Database Configuration</h3>
            <div className={styles.actions}>
              <button 
                onClick={handleValidate}
                disabled={validating}
                className={styles.validateBtn}
              >
                {validating ? 'Validating...' : '🔍 Validate'}
              </button>
              <button 
                onClick={() => setShowForm(!showForm)}
                className={styles.editBtn}
              >
                {showForm ? 'Cancel' : '✏️ Edit'}
              </button>
              <button 
                onClick={handleDelete}
                className={styles.deleteBtn}
              >
                🗑️ Delete
              </button>
            </div>
          </div>

          <div className={styles.credentialsGrid}>
            <div className={styles.credItem}>
              <label>Client ID:</label>
              <span>{credentials.clientId}</span>
            </div>
            <div className={styles.credItem}>
              <label>Client Secret:</label>
              <span>••••••••••••••••</span>
            </div>
            <div className={styles.credItem}>
              <label>Redirect URI:</label>
              <span>{credentials.redirectUri}</span>
            </div>
            <div className={styles.credItem}>
              <label>Status:</label>
              <span className={credentials.isValid ? styles.valid : styles.invalid}>
                {credentials.isValid ? '✅ Valid' : '❌ Invalid'}
                {credentials.validationError && ` (${credentials.validationError})`}
              </span>
            </div>
            <div className={styles.credItem}>
              <label>Last Updated:</label>
              <span>{new Date(credentials.lastUpdated).toLocaleString()}</span>
            </div>
          </div>

          <div className={styles.scopesSection}>
            <label>Scopes:</label>
            <div className={styles.scopesList}>
              {credentials.scopes.map(scope => (
                <span key={scope} className={styles.scope}>{scope}</span>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.noCredentials}>
          <div className={styles.noCredsIcon}>🔒</div>
          <h3>No OAuth Credentials Configured</h3>
          <p>Set up Google OAuth credentials to enable authentication and Google Drive integration.</p>
          <button 
            onClick={() => setShowForm(true)}
            className={styles.setupBtn}
          >
            🔧 Setup OAuth Credentials
          </button>
        </div>
      )}

      {/* Configuration Form */}
      {showForm && (
        <div className={styles.formSection}>
          <h3>{credentials ? 'Update' : 'Setup'} OAuth Credentials</h3>
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.formGroup}>
              <label htmlFor="clientId">Google Client ID *</label>
              <input
                type="text"
                id="clientId"
                value={formData.clientId}
                onChange={(e) => setFormData(prev => ({ ...prev, clientId: e.target.value }))}
                className={errors.clientId ? styles.error : ''}
                placeholder="123456789012-abcdefghijklmnopqrstuvwxyz123456.apps.googleusercontent.com"
              />
              {errors.clientId && <span className={styles.errorText}>{errors.clientId}</span>}
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="clientSecret">Google Client Secret *</label>
              <input
                type="password"
                id="clientSecret"
                value={formData.clientSecret}
                onChange={(e) => setFormData(prev => ({ ...prev, clientSecret: e.target.value }))}
                className={errors.clientSecret ? styles.error : ''}
                placeholder={credentials ? 'Enter new secret to update' : 'Enter client secret'}
              />
              {errors.clientSecret && <span className={styles.errorText}>{errors.clientSecret}</span>}
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="redirectUri">Redirect URI *</label>
              <input
                type="url"
                id="redirectUri"
                value={formData.redirectUri}
                onChange={(e) => setFormData(prev => ({ ...prev, redirectUri: e.target.value }))}
                className={errors.redirectUri ? styles.error : ''}
                placeholder={process.env.REACT_APP_API_URL ? `${process.env.REACT_APP_API_URL.replace(/\/$/, '')}/auth/google/callback` : 'http://localhost:5000/auth/google/callback'}
              />
              {errors.redirectUri && <span className={styles.errorText}>{errors.redirectUri}</span>}
            </div>

            <div className={styles.formGroup}>
              <label>Required Scopes</label>
              <div className={styles.scopesForm}>
                {[
                  { value: 'profile', label: 'Profile Information' },
                  { value: 'email', label: 'Email Address' },
                  { value: 'https://www.googleapis.com/auth/drive.file', label: 'Google Drive File Access' }
                ].map(scope => (
                  <label key={scope.value} className={styles.scopeLabel}>
                    <input
                      type="checkbox"
                      checked={formData.scopes.includes(scope.value)}
                      onChange={(e) => handleScopeChange(scope.value, e.target.checked)}
                    />
                    {scope.label}
                  </label>
                ))}
              </div>
            </div>

            <div className={styles.formActions}>
              <button 
                type="button" 
                onClick={() => setShowForm(false)}
                className={styles.cancelBtn}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={saving}
                className={styles.saveBtn}
              >
                {saving ? 'Saving...' : (credentials ? 'Update' : 'Setup')} Credentials
              </button>
            </div>
          </form>
        </div>
      )}

      <div className={styles.helpSection}>
        <h4>💡 Setup Instructions</h4>
        <ol>
          <li>Go to the <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer">Google Cloud Console</a></li>
          <li>Create a new OAuth 2.0 Client ID or use an existing one</li>
          <li>Add your domain to authorized origins</li>
          <li>Add the redirect URI to authorized redirect URIs</li>
          <li>Copy the Client ID and Client Secret to the form above</li>
          <li>Save and validate the credentials</li>
        </ol>
      </div>
    </div>
  );
};

export default OAuthSettings;