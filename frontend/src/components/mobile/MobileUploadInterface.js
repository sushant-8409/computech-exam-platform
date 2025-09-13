import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import styles from './MobileUploadInterface.module.css';

const MobileUploadInterface = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  
  const [uploadRequest, setUploadRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState({ minutes: 0, seconds: 0, expired: false });
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    if (token) {
      loadUploadInfo();
      
      // Start timer
      const timer = setInterval(() => {
        updateTimeRemaining();
      }, 1000);
      
      return () => clearInterval(timer);
    }
  }, [token]);

  const loadUploadInfo = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/mobile-upload/info/${token}`);
      
      if (response.data.success) {
        setUploadRequest(response.data.data);
        setTimeRemaining(response.data.data.timeRemaining);
        
        // Check if already uploaded
        if (response.data.data.status === 'uploaded') {
          toast.success('This upload has already been completed!');
        }
      } else {
        setError(response.data.error);
        if (response.data.expired) {
          toast.error('Upload link has expired');
        }
      }
    } catch (error) {
      console.error('Error loading upload info:', error);
      if (error.response?.status === 404 || error.response?.status === 410) {
        setError('Invalid or expired upload link');
        toast.error('Upload link is invalid or has expired');
      } else {
        setError('Failed to load upload information');
        toast.error('Failed to load upload information');
      }
    } finally {
      setLoading(false);
    }
  };

  const updateTimeRemaining = async () => {
    if (!token) return;
    
    try {
      const response = await axios.get(`/api/mobile-upload/status/${token}`);
      if (response.data.success) {
        const remaining = response.data.data.timeRemaining;
        setTimeRemaining(remaining);
        
        if (remaining.expired) {
          toast.error('Upload link has expired');
          setError('Upload link has expired');
        }
      }
    } catch (error) {
      if (error.response?.status === 404 || error.response?.status === 410) {
        setError('Upload link has expired');
        setTimeRemaining({ minutes: 0, seconds: 0, expired: true });
      }
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  const validateAndSetFile = (file) => {
    // Check file type
    const allowedTypes = uploadRequest?.uploadContext?.allowedTypes || ['pdf', 'jpg', 'jpeg', 'png'];
    const fileExtension = file.name.split('.').pop().toLowerCase();
    
    if (!allowedTypes.includes(fileExtension)) {
      toast.error(`File type ${fileExtension} not allowed. Allowed types: ${allowedTypes.join(', ')}`);
      return;
    }
    
    // Check file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large. Maximum size is 10MB.');
      return;
    }
    
    setSelectedFile(file);
    
    // Create preview for images
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setShowPreview(true);
    } else {
      setPreviewUrl(null);
      setShowPreview(false);
    }
    
    toast.success(`File selected: ${file.name}`);
  };

  const handleCameraCapture = () => {
    cameraInputRef.current?.click();
  };

  const handleFileUpload = async () => {
    if (!selectedFile || uploading) return;
    
    if (timeRemaining.expired) {
      toast.error('Upload link has expired');
      return;
    }
    
    if (uploadRequest?.status === 'uploaded') {
      toast.error('File has already been uploaded for this request');
      return;
    }
    
    try {
      setUploading(true);
      setUploadProgress(0);
      
      const formData = new FormData();
      formData.append('file', selectedFile);
      
      const response = await axios.post(`/api/mobile-upload/upload/${token}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(progress);
        }
      });
      
      if (response.data.success) {
        toast.success('File uploaded successfully!');
        
        // Update upload request status
        setUploadRequest(prev => ({
          ...prev,
          status: 'uploaded',
          uploadedFiles: [...(prev.uploadedFiles || []), {
            filename: response.data.data.fileName,
            size: response.data.data.fileSize,
            uploadedAt: response.data.data.uploadedAt
          }]
        }));
        
        // Clear file selection
        setSelectedFile(null);
        setPreviewUrl(null);
        setShowPreview(false);
        
        // Reset file inputs
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (cameraInputRef.current) cameraInputRef.current.value = '';
        
      } else {
        toast.error(response.data.error || 'Upload failed');
      }
      
    } catch (error) {
      console.error('Upload error:', error);
      const errorMessage = error.response?.data?.error || 'Upload failed';
      toast.error(errorMessage);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setShowPreview(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatTime = (minutes, seconds) => {
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Loading upload information...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <div className={styles.errorIcon}>❌</div>
          <h2>Upload Not Available</h2>
          <p>{error}</p>
          <button 
            className={styles.backButton}
            onClick={() => navigate('/')}
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const isExpired = timeRemaining.expired;
  const isUploaded = uploadRequest?.status === 'uploaded';

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>📱 Mobile Upload</h1>
        <p>{uploadRequest?.uploadContext?.testName}</p>
      </div>

      <div className={styles.timeBar}>
        <div className={`${styles.timeIndicator} ${isExpired ? styles.expired : ''}`}>
          <span className={styles.timeIcon}>⏰</span>
          <span className={styles.timeText}>
            {isExpired ? 'Expired' : `${formatTime(timeRemaining.minutes, timeRemaining.seconds)} remaining`}
          </span>
        </div>
      </div>

      {isUploaded && (
        <div className={styles.successSection}>
          <div className={styles.successIcon}>✅</div>
          <h2>Upload Complete!</h2>
          <p>Your file has been uploaded successfully.</p>
          <div className={styles.uploadedFile}>
            <strong>Uploaded:</strong> {uploadRequest.uploadedFiles[0]?.filename}
            <br />
            <strong>Size:</strong> {formatFileSize(uploadRequest.uploadedFiles[0]?.size)}
          </div>
        </div>
      )}

      {!isUploaded && !isExpired && (
        <>
          <div className={styles.infoSection}>
            <h3>📋 Upload Details</h3>
            <div className={styles.infoGrid}>
              <div className={styles.infoItem}>
                <strong>Subject:</strong> {uploadRequest?.uploadContext?.subject}
              </div>
              <div className={styles.infoItem}>
                <strong>Type:</strong> {uploadRequest?.uploadType?.replace('-', ' ').toUpperCase()}
              </div>
              <div className={styles.infoItem}>
                <strong>Allowed Types:</strong> {uploadRequest?.uploadContext?.allowedTypes?.join(', ').toUpperCase()}
              </div>
              <div className={styles.infoItem}>
                <strong>Max Size:</strong> 10 MB
              </div>
            </div>
          </div>

          <div className={styles.instructionsSection}>
            <h3>📝 Instructions</h3>
            <p>{uploadRequest?.uploadContext?.instructions}</p>
          </div>

          <div className={styles.uploadSection}>
            <h3>📤 Select File</h3>
            
            <div className={styles.uploadOptions}>
              <button 
                className={styles.cameraButton}
                onClick={handleCameraCapture}
                disabled={uploading}
              >
                📷 Take Photo
              </button>
              
              <button 
                className={styles.fileButton}
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                📁 Choose File
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept={uploadRequest?.uploadContext?.allowedTypes?.map(type => `.${type}`).join(',')}
              onChange={handleFileSelect}
              className={styles.hiddenInput}
            />
            
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              className={styles.hiddenInput}
            />

            {selectedFile && (
              <div className={styles.filePreview}>
                <div className={styles.fileInfo}>
                  <div className={styles.fileName}>
                    📄 {selectedFile.name}
                  </div>
                  <div className={styles.fileSize}>
                    {formatFileSize(selectedFile.size)}
                  </div>
                  <button 
                    className={styles.removeButton}
                    onClick={removeFile}
                    disabled={uploading}
                  >
                    ❌
                  </button>
                </div>

                {showPreview && previewUrl && (
                  <div className={styles.imagePreview}>
                    <img 
                      src={previewUrl} 
                      alt="Preview" 
                      className={styles.previewImage}
                    />
                  </div>
                )}

                <button 
                  className={styles.uploadButton}
                  onClick={handleFileUpload}
                  disabled={uploading || isExpired}
                >
                  {uploading ? `Uploading... ${uploadProgress}%` : '📤 Upload File'}
                </button>

                {uploading && (
                  <div className={styles.progressBar}>
                    <div 
                      className={styles.progressFill}
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      <div className={styles.footer}>
        <p>CompuTech Exam Platform</p>
        <p>Secure Mobile Upload</p>
      </div>
    </div>
  );
};

export default MobileUploadInterface;