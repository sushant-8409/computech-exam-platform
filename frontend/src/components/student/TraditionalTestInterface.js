import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../App';
import { toast } from 'react-toastify';
import axios from 'axios';
import Swal from 'sweetalert2';
import styles from './TraditionalTestInterface.module.css';
import QRCode from 'react-qr-code';
import { createRoot } from 'react-dom/client';

// Make React components available globally for QR code rendering in modals
if (typeof window !== 'undefined') {
  window.React = React;
  window.ReactDOM = { createRoot };
}

// Optimized components
const TimerDisplay = React.memo(({ timeLeft, isWarning }) => {
  // Handle NaN or invalid values
  const safeTimeLeft = isNaN(timeLeft) || timeLeft < 0 ? 0 : Math.floor(timeLeft);
  const minutes = Math.floor(safeTimeLeft / 60);
  const seconds = safeTimeLeft % 60;
  
  return (
    <div className={`${styles.timer} ${isWarning ? styles.timerWarning : ''}`}>
      <span className={styles.timerIcon}>⏰</span>
      <span className={styles.timerText}>
        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      </span>
    </div>
  );
});

const MonitoringStatus = React.memo(({ violations, maxViolations, isMonitoring }) => (
  <div className={styles.monitoringStatus}>
    <div className={`${styles.monitoringIndicator} ${isMonitoring ? styles.active : ''}`}>
      <span className={styles.monitoringIcon}>📹</span>
      <span>Monitoring {isMonitoring ? 'Active' : 'Inactive'}</span>
    </div>
    <div className={styles.violationCounter}>
      <span className={styles.violationIcon}>⚠️</span>
      <span>Violations: {violations.length}/{maxViolations}</span>
    </div>
  </div>
));

const AnswerSheetUploader = React.memo(({ 
  answerSheetUrl, 
  onUpload, 
  isUploading, 
  isRequired,
  testId,
  onFilePickerOpen,
  onFilePickerClose,
  onCameraOpen,
  onCameraClose,
  // Mobile upload props
  handleMobileUploadRequest,
  mobileUploadRequested,
  mobileUploadDetected,
  mobileUploadCount,
  mobileUploadExpiry,
  mobileUploadUrl,
  showQRCode
}) => {
  const fileInputRef = useRef(null);
  const [selectedPages, setSelectedPages] = useState([]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  
  // Camera states
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const cameraRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  
  const handleFileSelect = useCallback((event) => {
    // File picker is closing
    if (onFilePickerClose) onFilePickerClose();
    
    const files = Array.from(event.target.files);
    
    // Validate file types - only JPG allowed
    const invalidFiles = files.filter(file => 
      !file.type.includes('jpeg') && !file.type.includes('jpg')
    );
    
    if (invalidFiles.length > 0) {
      alert('Only JPG/JPEG files are allowed for answer sheet upload!');
      return;
    }
    
    // Validate file sizes (10MB max per file)
    const oversizedFiles = files.filter(file => file.size > 10 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      alert('Each file must be less than 10MB!');
      return;
    }
    
    // Add new pages to existing ones
    const newPages = files.map((file, index) => ({
      id: Date.now() + index,
      file: file,
      name: file.name,
      preview: URL.createObjectURL(file)
    }));
    
    setSelectedPages(prev => [...prev, ...newPages]);
    
    // Clear the input for future selections
    event.target.value = '';
  }, [onFilePickerClose]);

  const handleAddPage = useCallback(() => {
    // File picker is opening
    if (onFilePickerOpen) onFilePickerOpen();
    fileInputRef.current?.click();
  }, [onFilePickerOpen]);

  const handleRemovePage = useCallback((pageId) => {
    setSelectedPages(prev => prev.filter(page => page.id !== pageId));
  }, []);

  const handleSubmitPages = useCallback(() => {
    if (selectedPages.length === 0) {
      alert('Please add at least one page before submitting!');
      return;
    }
    
    const files = selectedPages.map(page => page.file);
    setIsSubmitted(true);
    onUpload(files);
  }, [selectedPages, onUpload]);

  const handleReset = useCallback(() => {
    setSelectedPages([]);
    setIsSubmitted(false);
    // Clean up preview URLs
    selectedPages.forEach(page => {
      if (page.preview) {
        URL.revokeObjectURL(page.preview);
      }
    });
  }, [selectedPages]);

  // Camera functionality
  const isAndroid = /android/i.test(navigator.userAgent);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isMobile = isAndroid || isIOS;

  const getCameraConstraints = () => {
    if (isAndroid) {
      return {
        video: {
          facingMode: { ideal: 'environment' }, // Back camera for documents
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          focusMode: { ideal: 'continuous' }
        }
      };
    } else if (isIOS) {
      return {
        video: {
          facingMode: 'environment', // Back camera
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };
    } else {
      return {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };
    }
  };

  const startCamera = async () => {
    try {
      const constraints = getCameraConstraints();
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (cameraRef.current) {
        cameraRef.current.srcObject = stream;
        cameraRef.current.play();
        streamRef.current = stream;
        setIsCameraActive(true);
      }
    } catch (error) {
      console.error('Camera access error:', error);
      toast.error('Could not access camera. Please use file upload instead.');
      setShowCameraModal(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (!cameraRef.current || !canvasRef.current) return;

    const video = cameraRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `captured-page-${Date.now()}.jpg`, { type: 'image/jpeg' });
        const newPage = {
          id: Date.now(),
          file: file,
          name: file.name,
          preview: URL.createObjectURL(file),
          isCaptured: true
        };
        
        setSelectedPages(prev => [...prev, newPage]);
        
        // Show animated "Page captured" feedback
        const pageNumber = selectedPages.length + 1;
        toast.success(`📄 Page ${pageNumber} captured!`, {
          position: 'top-center',
          autoClose: 2000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          className: styles.captureToast
        });
      }
    }, 'image/jpeg', 0.8);
  };

  const handleCameraClick = () => {
    // Call the monitoring pause function from parent
    if (onCameraOpen) onCameraOpen();
    
    setShowCameraModal(true);
    setTimeout(() => startCamera(), 100);
  };

  const closeCameraModal = () => {
    stopCamera();
    setShowCameraModal(false);
    
    // Call the monitoring resume function from parent
    if (onCameraClose) onCameraClose();
  };

  return (
    <div className={styles.answerUploader}>
      <div className={styles.uploaderContent}>
        <h3>📄 Answer Sheet Upload {isRequired && <span className={styles.required}>*</span>}</h3>
        
        {/* Mobile Upload Detection Indicator */}
        {mobileUploadDetected && (
          <div className={styles.mobileUploadAlert}>
            <div className={styles.alertIcon}>📱</div>
            <div className={styles.alertContent}>
              <strong>Mobile Upload Detected!</strong>
              <p>
                {mobileUploadCount} file(s) uploaded via mobile. Ready to submit!
              </p>
            </div>
          </div>
        )}
        
        <div className={styles.uploadArea}>
        {answerSheetUrl && isSubmitted ? (
          <div className={styles.uploadSuccess}>
            <span className={styles.successIcon}>✅</span>
            <span>Answer sheet uploaded successfully!</span>
            <button 
              onClick={handleReset}
              className={styles.replaceBtn}
              disabled={isUploading || mobileUploadDetected}
            >
              {mobileUploadDetected ? 'Mobile Upload Complete' : 'Upload New Set'}
            </button>
          </div>
        ) : (
          <div className={styles.uploadPrompt}>
            <div className={styles.pageManager}>
              <div className={styles.pageList}>
                {selectedPages.map((page, index) => (
                  <div key={page.id} className={styles.pageItem}>
                    <div className={styles.pagePreview}>
                      <img src={page.preview} alt={`Page ${index + 1}`} />
                    </div>
                    <div className={styles.pageInfo}>
                      <span className={styles.pageNumber}>Page {index + 1}</span>
                      <span className={styles.fileName}>{page.name}</span>
                    </div>
                    <button 
                      onClick={() => handleRemovePage(page.id)}
                      className={styles.removePageBtn}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              
              <div className={styles.pageActions}>
                {!isSubmitted && (
                  <>
                    <button 
                      onClick={handleAddPage}
                      className={styles.addPageBtn}
                      disabled={isUploading || mobileUploadDetected}
                    >
                      {selectedPages.length === 0 ? (
                        <>
                          <span className={styles.uploadIcon}>📁</span>
                          Add From Files
                        </>
                      ) : (
                        <>
                          <span className={styles.uploadIcon}>➕</span>
                          Add Page {selectedPages.length + 1}
                        </>
                      )}
                    </button>
                    
                    {isMobile && (
                      <button 
                        onClick={handleCameraClick}
                        className={styles.cameraBtn}
                        disabled={isUploading || mobileUploadDetected}
                      >
                        <span className={styles.uploadIcon}>📷</span>
                        {mobileUploadDetected ? 'Upload Complete' : isAndroid ? 'Use Back Camera' : 'Take Photo'}
                      </button>
                    )}
                    
                    {!isMobile && (
                      <button 
                        onClick={handleMobileUploadRequest}
                        className={`${styles.mobileUploadBtn} ${mobileUploadRequested ? styles.linkSent : ''}`}
                        disabled={isUploading || mobileUploadRequested || mobileUploadDetected}
                        title={mobileUploadDetected ? "Mobile upload already completed" : "Get mobile upload link via email or QR code"}
                      >
                        <span className={styles.uploadIcon}>
                          {mobileUploadDetected ? '✅' : mobileUploadRequested ? '✅' : '📱'}
                        </span>
                        {mobileUploadDetected ? 'Upload Complete!' : mobileUploadRequested ? 'Link Sent!' : 'Mobile Upload (Email + QR)'}
                      </button>
                    )}
                  </>
                )}
                
                {selectedPages.length > 0 && !isSubmitted && (
                  <button 
                    onClick={handleSubmitPages}
                    className={styles.submitPagesBtn}
                    disabled={isUploading || mobileUploadDetected}
                  >
                    {mobileUploadDetected ? (
                      <>
                        <span className={styles.uploadIcon}>📱</span>
                        Mobile Upload Complete
                      </>
                    ) : isUploading ? (
                      <>
                        <span className={styles.spinner}></span>
                        Converting to PDF...
                      </>
                    ) : (
                      <>
                        <span className={styles.uploadIcon}>📄</span>
                        Submit {selectedPages.length} Page{selectedPages.length > 1 ? 's' : ''}
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
            
            <p className={styles.uploadHint}>
              Upload JPG/JPEG images as pages. Images will be merged into a PDF in the order shown. (Max 10MB per image)
            </p>
            
            {mobileUploadRequested && mobileUploadExpiry && (
              <div className={styles.mobileUploadStatus}>
                <div className={styles.statusIcon}>📱</div>
                <div className={styles.statusText}>
                  <strong>Mobile upload link sent to your email!</strong>
                  <br />
                  <small>Link expires at {mobileUploadExpiry.toLocaleTimeString()}</small>
                  <br />
                  <small>Use your mobile device's back camera to capture answer sheets</small>
                  
                  {/* QR Code Display */}
                  {showQRCode && mobileUploadUrl && new Date() < mobileUploadExpiry && (
                    <div style={{ 
                      marginTop: '1rem', 
                      textAlign: 'center',
                      padding: '1rem',
                      backgroundColor: '#f8f9fa',
                      borderRadius: '8px',
                      border: '1px solid #dee2e6'
                    }}>
                      <div style={{ marginBottom: '0.5rem', fontSize: '14px', fontWeight: 'bold', color: '#495057' }}>
                        📱 Scan QR Code with Mobile Camera
                      </div>
                      <div style={{ 
                        display: 'inline-block', 
                        padding: '8px', 
                        backgroundColor: 'white', 
                        borderRadius: '6px',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                      }}>
                        <QRCode
                          value={mobileUploadUrl}
                          size={150}
                          style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                          viewBox="0 0 256 256"
                        />
                      </div>
                      <div style={{ 
                        fontSize: '11px', 
                        color: '#6c757d', 
                        marginTop: '0.5rem'
                      }}>
                        Expires in {Math.max(0, Math.ceil((mobileUploadExpiry - new Date()) / 60000))} minutes
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        
        <input
          ref={fileInputRef}
          type="file"
          accept=".jpg,.jpeg"
          multiple
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />

        {/* Camera Modal */}
        {showCameraModal && (
          <div className={styles.cameraModal}>
            <div className={styles.cameraModalContent}>
              <div className={styles.cameraHeader}>
                <h4>📷 Capture Answer Sheet Page</h4>
                <button 
                  onClick={closeCameraModal}
                  className={styles.closeCameraBtn}
                >
                  ✕
                </button>
              </div>
              
              <div className={styles.cameraContainer}>
                <video 
                  ref={cameraRef}
                  className={styles.cameraVideo}
                  autoPlay
                  playsInline
                  muted
                />
                <canvas 
                  ref={canvasRef}
                  style={{ display: 'none' }}
                />
              </div>
              
              <div className={styles.cameraControls}>
                <button 
                  onClick={capturePhoto}
                  className={styles.captureBtn}
                  disabled={!isCameraActive}
                >
                  📸 Capture Photo
                </button>
                <button 
                  onClick={closeCameraModal}
                  className={styles.cancelBtn}
                >
                  Cancel
                </button>
              </div>
              
              <p className={styles.cameraHint}>
                Position your answer sheet within the frame and tap capture
              </p>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
});

const TraditionalTestInterface = () => {
  const { testId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Check if this is a resume session
  const isResumeSession = searchParams.get('resume') === 'true';
  
  // Core state
  const [test, setTest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [testStarted, setTestStarted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  
  // Timer state
  const [timeLeft, setTimeLeft] = useState(0);
  const [timeTaken, setTimeTaken] = useState(0);
  const timerRef = useRef(null);
  const testStartTimeRef = useRef(null);
  
  // Answer sheet upload state
  const [answerSheetUrl, setAnswerSheetUrl] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isFilePickerOpen, setIsFilePickerOpen] = useState(false);
  
  // Mobile upload states
  const [mobileUploadRequested, setMobileUploadRequested] = useState(false);
  const [mobileUploadExpiry, setMobileUploadExpiry] = useState(null);
  const [mobileUploadUrl, setMobileUploadUrl] = useState(null);
  const [showQRCode, setShowQRCode] = useState(false);
  
  // Mobile upload detection states
  const [mobileUploadDetected, setMobileUploadDetected] = useState(false);
  const [mobileUploadCount, setMobileUploadCount] = useState(0);
  const [lastUploadCheck, setLastUploadCheck] = useState(null);
  
  // Monitoring state
  const [violations, setViolations] = useState([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [suspiciousActivities, setSuspiciousActivities] = useState([]);
  const [monitoringImages, setMonitoringImages] = useState([]);
  const [monitoringSessionId, setMonitoringSessionId] = useState(null);
  
  // Refs for monitoring
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const monitoringIntervalRef = useRef(null);
  const submissionLockRef = useRef(false);
  
  // PDF viewer state
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfError, setPdfError] = useState(null);
  const [isBetterViewer, setIsBetterViewer] = useState(false);
  const [pdfScale, setPdfScale] = useState(1);
  const [pdfLoading, setPdfLoading] = useState(false);
  
  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(false);
  
  // Additional refs
  const pdfViewerRef = useRef(null);
  const lastFocusTime = useRef(Date.now());

  // Memoized values
  const maxViolations = useMemo(() => 
    test?.proctoringSettings?.maxViolations || 10, [test]);
  
  const isTimeWarning = useMemo(() => 
    timeLeft <= 300, [timeLeft]); // 5 minutes warning
  
  const canSubmit = useMemo(() => {
    if (!test) return false;
    
    // If paper submission is required, must have answer sheet
    if (test.paperSubmissionRequired && !answerSheetUrl) return false;
    
    // If test has started and not submitted
    return testStarted && !isSubmitted && !isSubmitting;
  }, [test, testStarted, isSubmitted, isSubmitting, answerSheetUrl]);

  // Fetch file URL from backend
  const fetchFileUrl = useCallback(async (type, key) => {
    try {
      const { data } = await axios.get(`/api/files/${type}/${key}`);
      return data.url;
    } catch (error) {
      console.error('Failed to fetch file URL:', error);
      throw error;
    }
  }, []);

  // Better viewer functions
  const enterBetterViewer = useCallback(() => {
    if (isSubmitted) return;
    setIsBetterViewer(true);
    document.body.style.overflow = 'hidden';
    Swal.fire({
      title: '📺 Better Viewer Activated',
      text: 'Press ESC or click ✕ to exit.',
      icon: 'success',
      timer: 2000,
      showConfirmButton: false
    });
  }, [isSubmitted]);

  const exitBetterViewer = useCallback(() => {
    setIsBetterViewer(false);
    document.body.style.overflow = 'auto';
    Swal.fire({
      title: '📱 Exited Better Viewer',
      icon: 'info',
      timer: 1500,
      showConfirmButton: false
    });
  }, []);

  const handlePdfZoom = useCallback((direction) => {
    setPdfScale(prev => {
      const newScale = direction === 'in' ? Math.min(prev + 0.25, 3) : Math.max(prev - 0.25, 0.5);
      
      // Handle scrolling behavior based on zoom level
      setTimeout(() => {
        const betterViewerContent = document.querySelector(`.${styles.betterViewerContent}`);
        if (betterViewerContent) {
          // Enable horizontal scrolling when zoomed above 100%
          if (newScale > 1) {
            betterViewerContent.style.overflowX = 'auto';
            betterViewerContent.style.overflowY = 'auto';
            betterViewerContent.style.justifyContent = 'flex-start';
            betterViewerContent.style.alignItems = 'flex-start';
          } else {
            betterViewerContent.style.overflowX = 'hidden';
            betterViewerContent.style.overflowY = 'auto';
            betterViewerContent.style.justifyContent = 'center';
            betterViewerContent.style.alignItems = 'center';
          }
        }
      }, 50);
      
      return newScale;
    });
  }, []);

  // Touch / Pinch handling for mobile pinch-to-zoom
  useEffect(() => {
    let initialDistance = null;
    let lastScale = pdfScale;

    const el = document.querySelector(`.${styles.betterViewerContent}`);
    if (!el) return;

    const getDistance = (touches) => {
      const [a, b] = touches;
      const dx = a.clientX - b.clientX;
      const dy = a.clientY - b.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const touchStart = (e) => {
      if (e.touches && e.touches.length === 2) {
        initialDistance = getDistance(e.touches);
        lastScale = pdfScale;
      }
    };

    const touchMove = (e) => {
      if (e.touches && e.touches.length === 2 && initialDistance) {
        const dist = getDistance(e.touches);
        const ratio = dist / initialDistance;
        let newScale = Math.max(0.5, Math.min(3, lastScale * ratio));
        // Snap to 0.25 increments for consistency
        newScale = Math.round(newScale * 4) / 4;
        if (newScale !== pdfScale) {
          setPdfScale(newScale);
          // adjust scrolling behavior
          const betterViewerContent = el;
          if (betterViewerContent) {
            if (newScale > 1) {
              betterViewerContent.style.overflowX = 'auto';
              betterViewerContent.style.overflowY = 'auto';
              betterViewerContent.style.justifyContent = 'flex-start';
              betterViewerContent.style.alignItems = 'flex-start';
            } else {
              betterViewerContent.style.overflowX = 'hidden';
              betterViewerContent.style.overflowY = 'auto';
              betterViewerContent.style.justifyContent = 'center';
              betterViewerContent.style.alignItems = 'center';
            }
          }
        }
        e.preventDefault();
      }
    };

    const touchEnd = (e) => {
      if (!e.touches || e.touches.length < 2) {
        initialDistance = null;
        lastScale = pdfScale;
      }
    };

    el.addEventListener('touchstart', touchStart, { passive: false });
    el.addEventListener('touchmove', touchMove, { passive: false });
    el.addEventListener('touchend', touchEnd);

    return () => {
      el.removeEventListener('touchstart', touchStart);
      el.removeEventListener('touchmove', touchMove);
      el.removeEventListener('touchend', touchEnd);
    };
  }, [pdfScale]);

  // Enhanced embed URL function
  const enhanceEmbedUrl = useCallback((url) => {
    if (!url) return '';
    
    // If it's already a Google Drive preview URL, return as is
    if (url.includes('preview')) return url;
    
    // Extract file ID and create preview URL
    let fileId = url;
    if (url.includes('drive.google.com') || url.includes('/d/')) {
      const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (match) {
        fileId = match[1];
      }
    }
    
    return `https://drive.google.com/file/d/${fileId}/preview`;
  }, []);

  // Initialize camera monitoring
  const initializeMonitoring = useCallback(async () => {
    if (!test?.cameraMonitoring?.enabled) return;
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: 640, 
          height: 480,
          facingMode: 'user' 
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setIsMonitoring(true);
        
        // Start monitoring interval
        monitoringIntervalRef.current = setInterval(() => {
          captureMonitoringImage();
        }, test.cameraMonitoring.captureInterval || 30000); // Default 30 seconds
      }
    } catch (err) {
      console.error('Camera initialization failed:', err);
      
      if (test.cameraMonitoring.requireCameraAccess) {
        toast.error('Camera access is required for this test');
        navigate('/student');
        return;
      }
      
      toast.warn('Camera monitoring unavailable, continuing without monitoring');
    }
  }, [test, navigate]);

  // Capture monitoring image
  const captureMonitoringImage = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !isMonitoring) return;
    
    try {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const ctx = canvas.getContext('2d');
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Apply brightness and contrast adjustments for better image quality
      ctx.filter = 'brightness(1.1) contrast(1.2)';
      ctx.drawImage(video, 0, 0);
      ctx.filter = 'none'; // Reset filter
      
      // Use higher quality (0.9) for monitoring images
      const imageData = canvas.toDataURL('image/jpeg', 0.9);
      const timestamp = new Date().toISOString();
      
      // Store locally for immediate UI feedback
      setMonitoringImages(prev => [...prev, {
        timestamp,
        imageData,
        type: 'monitoring'
      }]);
      
      // Upload to server for permanent storage and violation detection
      try {
        console.log('📤 Uploading monitoring image to server...');
        
        // Convert base64 to blob
        const blob = await fetch(imageData).then(r => r.blob());
        const formData = new FormData();
        formData.append('monitoringImage', blob, `monitoring_${Date.now()}.jpg`);
        formData.append('timestamp', timestamp);
        formData.append('testId', testId);
        formData.append('purpose', 'monitoring');
        formData.append('testType', 'traditional');
        formData.append('saveToGoogleDrive', 'true');

        const token = localStorage.getItem('token');
        const response = await axios.post('/api/student/monitoring/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
            Authorization: `Bearer ${token}`
          }
        });
        
        console.log('✅ Monitoring image uploaded successfully:', response.data);
      } catch (uploadError) {
        console.error('❌ Failed to upload monitoring image:', uploadError);
        // Don't block the monitoring flow if upload fails
      }
      
    } catch (err) {
      console.error('Image capture failed:', err);
    }
  }, [isMonitoring, testId]);

  // Handle violations
  const handleViolation = useCallback(async (type, details) => {
    const violation = {
      type,
      timestamp: new Date().toISOString(),
      details: details || `${type} violation detected`,
      testType: 'traditional',
      ...details
    };
    
    // Send violation to server for permanent recording
    if (monitoringSessionId) {
      try {
        const token = localStorage.getItem('token');
        await axios.post('/api/student/monitoring/violation', {
          sessionId: monitoringSessionId,
          type,
          details: violation.details,
          severity: 'medium'
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        console.log('✅ Violation recorded on server:', violation);
      } catch (error) {
        console.error('❌ Failed to record violation on server:', error);
        // Continue with local recording even if server fails
      }
    } else {
      console.warn('⚠️ No monitoring session ID - violation not sent to server');
    }
    
    setViolations(prev => {
      const newViolations = [...prev, violation];
      
      // Check if max violations exceeded
      if (newViolations.length >= maxViolations) {
        toast.error(`Maximum violations (${maxViolations}) exceeded. Test will be auto-submitted.`);
        
        // Auto-submit after a short delay
        setTimeout(() => {
          handleSubmit(true, 'max_violations_exceeded');
        }, 2000);
      } else {
        toast.warn(`Security violation: ${type}. ${maxViolations - newViolations.length} warnings remaining.`);
      }
      
      return newViolations;
    });
  }, [maxViolations, testId, monitoringSessionId]);

  // Camera functions for answer sheet capture
  const handleCameraClick = useCallback(() => {
    // Stop monitoring temporarily when using back camera
    if (isMonitoring && monitoringIntervalRef.current) {
      clearInterval(monitoringIntervalRef.current);
      monitoringIntervalRef.current = null;
      console.log('📸 Monitoring paused for camera capture');
    }
    
    // Also stop the monitoring camera stream to free up resources
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
      console.log('📹 Monitoring camera stream stopped');
    }
  }, [isMonitoring]);

  const handleCameraClose = useCallback(async () => {
    // Restart monitoring after camera usage
    if (isMonitoring && test?.cameraMonitoring?.enabled && !monitoringIntervalRef.current) {
      try {
        // Reinitialize monitoring camera stream
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 480 }
          } 
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          console.log('📹 Monitoring camera stream restarted');
        }
        
        // Resume interval capture
        monitoringIntervalRef.current = setInterval(() => {
          captureMonitoringImage();
        }, test.cameraMonitoring.captureInterval || 30000);
        console.log('📸 Monitoring resumed after camera capture');
        
      } catch (err) {
        console.error('Failed to restart monitoring camera:', err);
        toast.warn('Camera monitoring could not be resumed');
      }
    }
  }, [isMonitoring, test, captureMonitoringImage]);

  // Monitor page visibility and focus
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && testStarted && !isSubmitted && !isFilePickerOpen) {
        handleViolation('tab_switch', 'Student switched away from test tab');
      }
    };
    
    const handleBlur = () => {
      if (testStarted && !isSubmitted && !isUploading && !isFilePickerOpen) {
        // Track focus loss for monitoring but don't count as violation
        console.log('Focus lost from test window at:', new Date().toISOString());
        // Optional: Add to monitoring data instead of violations
        // handleViolation('focus_lost', 'Student lost focus from test window');
      }
    };
    
    const handleKeyDown = (e) => {
      if (testStarted && !isSubmitted) {
        // Prevent common cheat key combinations
        if (
          (e.ctrlKey && (e.key === 'c' || e.key === 'v' || e.key === 'a')) ||
          e.key === 'F12' ||
          (e.ctrlKey && e.shiftKey && e.key === 'I') ||
          (e.ctrlKey && e.key === 'u')
        ) {
          e.preventDefault();
          handleViolation('prohibited_keys', `Attempted to use prohibited key combination: ${e.key}`);
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [testStarted, isSubmitted, isUploading, handleViolation]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Upload answer sheet
  const uploadAnswerSheet = useCallback(async (files) => {
    if (!files || files.length === 0) return;
    
    setIsUploading(true);
    
    try {
      // Convert files array if it's not already an array
      const fileArray = Array.isArray(files) ? files : [files];
      
      // If single file and it's PDF, upload directly
      if (fileArray.length === 1 && fileArray[0].type === 'application/pdf') {
        const formData = new FormData();
        formData.append('answerSheet', fileArray[0]);
        formData.append('testId', testId);
        formData.append('studentId', user._id);
        
        const token = localStorage.getItem('token');
        const response = await axios.post('/api/student/upload-answer-sheet', formData, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        });
        
        if (response.data.success) {
          setAnswerSheetUrl(response.data.url);
          toast.success('Answer sheet uploaded successfully!');
        } else {
          throw new Error(response.data.message || 'Upload failed');
        }
        return;
      }
      
      // For JPG files, we need to convert them to images and create PDF
      const convertImagesToPDF = async (imageFiles) => {
        return new Promise((resolve, reject) => {
          try {
            // Create a canvas to process images
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Create PDF-like data structure
            const images = [];
            let loadedCount = 0;
            
            imageFiles.forEach((file, index) => {
              const img = new Image();
              img.onload = () => {
                // Store image data
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                
                images[index] = {
                  data: canvas.toDataURL('image/jpeg', 0.8),
                  width: img.width,
                  height: img.height
                };
                
                loadedCount++;
                if (loadedCount === imageFiles.length) {
                  // All images loaded, create combined blob
                  createPDFBlob(images).then(resolve).catch(reject);
                }
              };
              
              img.onerror = () => reject(new Error(`Failed to load image: ${file.name}`));
              img.src = URL.createObjectURL(file);
            });
          } catch (error) {
            reject(error);
          }
        });
      };
      
      const createPDFBlob = async (images) => {
        // Create a simple PDF-like structure by combining images
        // For now, we'll create a multipart form with all images
        // The server will handle the PDF conversion
        const formData = new FormData();
        
        // Add all files
        fileArray.forEach((file, index) => {
          formData.append(`answerImage_${index}`, file);
        });
        
        formData.append('testId', testId);
        formData.append('studentId', user._id);
        formData.append('imageCount', fileArray.length.toString());
        
        return formData;
      };
      
      // Create FormData with images
      const formData = new FormData();
      fileArray.forEach((file, index) => {
        formData.append(`answerImage_${index}`, file);
      });
      formData.append('testId', testId);
      formData.append('studentId', user._id);
      formData.append('imageCount', fileArray.length.toString());
      
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/student/upload-answer-images', formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      
      if (response.data.success) {
        const url = response.data.viewUrl || response.data.url;
        setAnswerSheetUrl(url);
        toast.success('Answer sheet created and uploaded successfully!');
        console.log('✅ Answer sheet URL set:', url);
      } else {
        throw new Error(response.data.message || 'Upload failed');
      }
      
    } catch (err) {
      console.error('Upload error:', err);
      toast.error(err.response?.data?.message || 'Failed to upload answer sheet');
    } finally {
      setIsUploading(false);
    }
  }, [testId, user._id]);

  // Submit test
  const handleSubmit = useCallback(async (isAutoSubmit = false, reason = '') => {
    if (submissionLockRef.current) return;
    
    if (!isAutoSubmit && !canSubmit) {
      if (test?.paperSubmissionRequired && !answerSheetUrl) {
        toast.error('Please upload your answer sheet before submitting');
        return;
      }
    }
    
    if (!isAutoSubmit) {
      const result = await Swal.fire({
        title: 'End Test?',
        html: `
          <p>Are you sure you want to end your test?</p>
          <p><strong>You cannot make changes after ending the test.</strong></p>
          ${test?.paperSubmissionRequired ? '<p>✅ Answer sheet uploaded</p>' : ''}
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Yes, End Test',
        cancelButtonText: 'Continue Test'
      });
      
      if (!result.isConfirmed) return;
    }
    
    submissionLockRef.current = true;
    setIsSubmitting(true);
    stopTimer();
    
    try {
      const token = localStorage.getItem('token');
      const payload = {
        answerSheetUrl,
        violations,
        timeTaken,
        monitoringImages: monitoringImages.slice(0, 10) // Limit to last 10 images
      };
      
      console.log('🔍 Exit test payload:', {
        violationsCount: violations.length,
        monitoringImagesCount: monitoringImages.length,
        timeTaken,
        hasAnswerSheet: !!answerSheetUrl
      });
      
      const response = await axios.post(`/api/student/exit-test/${testId}`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setIsSubmitted(true);
        
        // Stop monitoring
        setIsMonitoring(false);
        if (monitoringIntervalRef.current) {
          clearInterval(monitoringIntervalRef.current);
        }
        
        if (videoRef.current?.srcObject) {
          const tracks = videoRef.current.srcObject.getTracks();
          tracks.forEach(track => track.stop());
        }
        
        // End monitoring session
        if (monitoringSessionId) {
          try {
            await axios.post('/api/student/monitoring/end', {
              sessionId: monitoringSessionId
            }, {
              headers: { Authorization: `Bearer ${token}` }
            });
            console.log('✅ Monitoring session ended');
          } catch (endError) {
            console.error('❌ Failed to end monitoring session:', endError);
            // Don't block submission if monitoring cleanup fails
          }
        }
        
        toast.success('Test ended successfully!');
        
        setTimeout(() => {
          navigate('/student', { 
            state: { 
              resultId: response.data.resultId,
              message: 'Test ended successfully!'
            }
          });
        }, 2000);
        
      } else {
        throw new Error(response.data.message || 'Submission failed');
      }
    } catch (err) {
      console.error('Submit error:', err);
      toast.error(err.response?.data?.message || 'Failed to end test');
      submissionLockRef.current = false;
    } finally {
      setIsSubmitting(false);
    }
  }, [
    canSubmit, 
    test, 
    answerSheetUrl, 
    testId, 
    violations, 
    suspiciousActivities, 
    monitoringImages, 
    timeTaken, 
    stopTimer, 
    navigate
  ]);

  // Exit test
  const handleExitTest = useCallback(async () => {
    if (isSubmitted) return;
    
    const result = await Swal.fire({
      title: 'Exit Test?',
      html: `
        <p>Are you sure you want to exit the test?</p>
        <p><strong>Your progress will be saved but you cannot restart this test unless admin approval.</strong></p>
        ${!answerSheetUrl ? '<p style="color: #f59e0b;">⚠️ You have not uploaded an answer sheet</p>' : ''}
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, Exit Test',
      cancelButtonText: 'Stay in Test'
    });
    
    if (!result.isConfirmed) return;
    
    setIsSubmitting(true);
    submissionLockRef.current = true;
    stopTimer();
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`/api/student/exit-test/${testId}`, {
        violations,
        answerSheetUrl,
        timeTaken,
        monitoringImages: monitoringImages.slice(0, 5) // Limited for exit
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        toast.success('Test exited successfully');
        navigate('/student');
      } else {
        throw new Error(response.data.message || 'Exit failed');
      }
    } catch (err) {
      console.error('Exit error:', err);
      toast.error(err.response?.data?.message || 'Failed to exit test');
      submissionLockRef.current = false;
      setIsSubmitting(false);
    }
  }, [
    isSubmitted, 
    answerSheetUrl, 
    testId, 
    violations, 
    timeTaken, 
    monitoringImages, 
    stopTimer, 
    navigate
  ]);

  // Mobile upload request function
  const handleMobileUploadRequest = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/mobile-upload/request', {
        email: user?.email,
        testId: testId,
        uploadType: 'answer-sheet',
        expiryMinutes: 10
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        const uploadToken = response.data.token;
        const mobileUrl = `${window.location.origin}/mobile-upload/${uploadToken}`;
        
        setMobileUploadRequested(true);
        setMobileUploadExpiry(new Date(Date.now() + 10 * 60 * 1000)); // 10 minutes from now
        setMobileUploadUrl(mobileUrl);
        setShowQRCode(true);

        await Swal.fire({
          title: '📱 Mobile Upload Ready!',
          html: `
            <div style="text-align: left; margin: 1rem 0;">
              <p><strong>✅ Upload link has been sent to:</strong></p>
              <p style="background: #f0f9ff; padding: 8px; border-radius: 4px; font-family: monospace;">${user?.email || 'your registered email'}</p>
              <br>
              <p><strong>📱 Or scan the QR code below:</strong></p>
              <div style="text-align: center; margin: 1rem 0;">
                <div id="qr-code-container" style="display: inline-block; padding: 16px; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);"></div>
              </div>
              <br>
              <p><strong>⏱️ Link expires in 10 minutes</strong></p>
              <p style="font-size: 14px; color: #666;">Use your mobile device's camera to scan the QR code or check your email for the upload link.</p>
            </div>
          `,
          icon: 'success',
          confirmButtonText: 'Got it!',
          confirmButtonColor: '#10b981',
          width: 500,
          didOpen: () => {
            // Render QR code in the modal
            const qrContainer = document.getElementById('qr-code-container');
            if (qrContainer) {
              const root = createRoot(qrContainer);
              root.render(React.createElement(QRCode, {
                value: mobileUrl,
                size: 200,
                level: 'M'
              }));
            }
          }
        });
        
        console.log('Mobile upload link sent:', response.data.token);
      } else {
        throw new Error(response.data.error || 'Failed to send mobile link');
      }
    } catch (error) {
      console.error('Mobile upload request failed:', error);
      toast.error(error.response?.data?.error || 'Failed to send mobile upload link');
    }
  }, [testId, user]);

  // Check mobile upload status periodically
  const checkMobileUploadStatus = useCallback(async () => {
    if (!testId || isSubmitted) return;
    
    try {
      const response = await axios.get(`/api/mobile-upload/status/${testId}`);
      if (response.data.success && response.data.hasUploads) {
        const { uploadCount, latestUpload } = response.data;
        
        // Only show notification if this is a new upload we haven't seen
        if (uploadCount > mobileUploadCount) {
          setMobileUploadDetected(true);
          setMobileUploadCount(uploadCount);
          setLastUploadCheck(new Date());
          
          // Show notification about mobile upload
          toast.success(
            `📱 Mobile Upload Detected! ${uploadCount} file(s) uploaded. ` +
            `You can now submit your test when ready.`,
            {
              duration: 8000,
              position: 'top-center',
              style: {
                background: '#10b981',
                color: 'white',
                fontSize: '16px',
                fontWeight: '600',
                borderRadius: '12px',
                padding: '16px 24px',
                boxShadow: '0 10px 25px rgba(16, 185, 129, 0.3)'
              }
            }
          );
        }
      }
    } catch (error) {
      console.error('Error checking mobile upload status:', error);
    }
  }, [testId, isSubmitted, mobileUploadCount]);

  // Set up periodic mobile upload checking
  useEffect(() => {
    if (!testStarted || isSubmitted) return;
    
    // Check immediately
    checkMobileUploadStatus();
    
    // Check every 30 seconds during test
    const interval = setInterval(() => {
      checkMobileUploadStatus();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [testStarted, isSubmitted, checkMobileUploadStatus]);

  // Start test
  const handleStartTest = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`/api/student/start-test/${testId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setTestStarted(true);
        
        // Start timer directly
        const testDuration = test?.duration || test?.timeLimit || 60;
        setTimeLeft(testDuration * 60);
        testStartTimeRef.current = Date.now();
        
        timerRef.current = setInterval(() => {
          const now = Date.now();
          const elapsed = Math.floor((now - testStartTimeRef.current) / 1000);
          const remaining = Math.max(0, (testDuration * 60) - elapsed);
          
          setTimeLeft(remaining);
          setTimeTaken(elapsed);
          
          if (remaining <= 0) {
            handleSubmit(true, 'time_limit');
          }
        }, 1000);
        
        // Initialize monitoring directly
        if (test?.cameraMonitoring?.enabled) {
          try {
            // Create monitoring session first
            const sessionResponse = await axios.post('/api/student/monitoring/start', {
              testId,
              settings: {
                captureInterval: test.cameraMonitoring.captureInterval || 30000,
                testType: 'traditional'
              }
            }, {
              headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            
            if (sessionResponse.data.success) {
              setMonitoringSessionId(sessionResponse.data.sessionId);
              console.log('✅ Monitoring session created:', sessionResponse.data.sessionId);
            }
            
            const stream = await navigator.mediaDevices.getUserMedia({ 
              video: { 
                width: 640, 
                height: 480,
                facingMode: 'user' 
              } 
            });
            
            if (videoRef.current) {
              videoRef.current.srcObject = stream;
              videoRef.current.play();
              setIsMonitoring(true);
              
              monitoringIntervalRef.current = setInterval(() => {
                if (videoRef.current && canvasRef.current) {
                  try {
                    const canvas = canvasRef.current;
                    const video = videoRef.current;
                    const ctx = canvas.getContext('2d');
                    
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    ctx.drawImage(video, 0, 0);
                    
                    const imageData = canvas.toDataURL('image/jpeg', 0.7);
                    const timestamp = new Date().toISOString();
                    
                    setMonitoringImages(prev => [...prev, {
                      timestamp,
                      imageData,
                      type: 'monitoring'
                    }]);
                  } catch (err) {
                    console.error('Image capture failed:', err);
                  }
                }
              }, test.cameraMonitoring.captureInterval || 30000);
            }
          } catch (err) {
            console.error('Camera access failed:', err);
            toast.warn('Camera monitoring unavailable, continuing without monitoring');
          }
        }
        
        toast.success('Test started successfully!');
      } else {
        throw new Error(response.data.message || 'Failed to start test');
      }
    } catch (err) {
      console.error('Start test error:', err);
      toast.error(err.response?.data?.message || 'Failed to start test');
    }
  }, [testId, test, handleSubmit]);

  // Load test data - Fixed to prevent infinite loops
  useEffect(() => {
    const loadTest = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`/api/student/test/${testId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (response.data.success) {
          const testData = response.data.test;
          setTest(testData);
          
          // Handle resume session
          if (isResumeSession && response.data.canResume && response.data.existingResult) {
            const existingResult = response.data.existingResult;
            
            setTestStarted(true);
            setTimeTaken(existingResult.timeTaken || 0);
            
            if (existingResult.answerSheetUrl) {
              setAnswerSheetUrl(existingResult.answerSheetUrl);
            }
            
            toast.success('Test resumed from where you left off');
            
            // Start timer for resumed session
            const testDuration = testData.duration || testData.timeLimit || 60;
            const elapsedTime = existingResult.timeTaken || 0;
            const remaining = Math.max(0, (testDuration * 60) - elapsedTime);
            setTimeLeft(remaining);
            
            testStartTimeRef.current = Date.now() - (elapsedTime * 1000);
            
            timerRef.current = setInterval(() => {
              const now = Date.now();
              const elapsed = Math.floor((now - testStartTimeRef.current) / 1000);
              const remaining = Math.max(0, (testDuration * 60) - elapsed);
              
              setTimeLeft(remaining);
              setTimeTaken(elapsed);
              
              if (remaining <= 0) {
                handleSubmit(true, 'time_limit');
              }
            }, 1000);
            
            // Initialize monitoring for resumed session
            if (testData?.cameraMonitoring?.enabled) {
              try {
                const stream = await navigator.mediaDevices.getUserMedia({ 
                  video: { 
                    width: 640, 
                    height: 480,
                    facingMode: 'user' 
                  } 
                });
                
                if (videoRef.current) {
                  videoRef.current.srcObject = stream;
                  videoRef.current.play();
                  setIsMonitoring(true);
                  
                  monitoringIntervalRef.current = setInterval(() => {
                    if (videoRef.current && canvasRef.current && isMonitoring) {
                      try {
                        const canvas = canvasRef.current;
                        const video = videoRef.current;
                        const ctx = canvas.getContext('2d');
                        
                        canvas.width = video.videoWidth;
                        canvas.height = video.videoHeight;
                        ctx.drawImage(video, 0, 0);
                        
                        const imageData = canvas.toDataURL('image/jpeg', 0.7);
                        const timestamp = new Date().toISOString();
                        
                        setMonitoringImages(prev => [...prev, {
                          timestamp,
                          imageData,
                          type: 'monitoring'
                        }]);
                      } catch (err) {
                        console.error('Image capture failed:', err);
                      }
                    }
                  }, testData.cameraMonitoring.captureInterval || 30000);
                }
              } catch (err) {
                console.error('Camera access failed:', err);
                toast.warn('Camera monitoring unavailable, continuing without monitoring');
              }
            }
          }
          
          // Load signed PDF URL if available
          if (testData.questionPaperURL) {
            try {
              const pdfResponse = await axios.get(`/api/student/test/${testId}/question-paper`, {
                headers: { Authorization: `Bearer ${token}` }
              });
              
              if (pdfResponse.data.success) {
                setPdfUrl(pdfResponse.data.signedUrl);
              }
            } catch (pdfErr) {
              console.error('PDF load error:', pdfErr);
              setPdfError('Failed to load question paper');
            }
          }
          
        } else {
          throw new Error(response.data.message || 'Failed to load test');
        }
      } catch (err) {
        console.error('Load test error:', err);
        toast.error(err.response?.data?.message || 'Failed to load test');
        navigate('/student');
      } finally {
        setLoading(false);
      }
    };
    
    // Only load test when testId changes, not when other dependencies change
    if (testId) {
      loadTest();
    }
  }, [testId]); // Removed isResumeSession and navigate to prevent infinite loops

  // Cleanup on unmount - Fixed dependencies
  useEffect(() => {
    return () => {
      // Clear timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      // Clear monitoring interval
      if (monitoringIntervalRef.current) {
        clearInterval(monitoringIntervalRef.current);
      }
      
      // Stop video stream
      if (videoRef.current?.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, []); // No dependencies needed for cleanup

  // Keyboard event handlers for better viewer and monitoring
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Prevent common cheating shortcuts
      if ((e.ctrlKey && ['u', 'i', 'j', 'shift+j', 'c', 'v', 'a', 's', 'p'].includes(e.key.toLowerCase())) ||
          e.key === 'F12' || 
          (e.ctrlKey && e.shiftKey && ['i', 'j', 'c'].includes(e.key.toLowerCase()))) {
        e.preventDefault();
        
        // Inline violation handling to avoid dependency
        setViolations(prev => [...prev, {
          type: 'Prohibited Key Combination',
          timestamp: new Date().toISOString(),
          details: { key: e.key, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey }
        }]);
        
        return;
      }

      // Better viewer controls
      if (e.key === 'Escape' && isBetterViewer) {
        setIsBetterViewer(false);
        return;
      }

      // PDF zoom controls in better viewer
      if (isBetterViewer && e.ctrlKey && e.key === '0') {
        e.preventDefault();
        setPdfScale(1);
        
        // Reset scrolling behavior for 100% zoom
        setTimeout(() => {
          const betterViewerContent = document.querySelector(`.${styles.betterViewerContent}`);
          if (betterViewerContent) {
            betterViewerContent.style.overflowX = 'hidden';
            betterViewerContent.style.overflowY = 'auto';
            betterViewerContent.style.justifyContent = 'center';
            betterViewerContent.style.alignItems = 'center';
          }
        }, 50);
        return;
      }

      if (isBetterViewer && e.ctrlKey && (e.key === '+' || e.key === '=' || e.key === '-')) {
        e.preventDefault();
        let newScale;
        if (e.key === '+' || e.key === '=') {
          setPdfScale(prev => {
            newScale = Math.min(prev + 0.25, 3);
            return newScale;
          });
        } else {
          setPdfScale(prev => {
            newScale = Math.max(prev - 0.25, 0.5);
            return newScale;
          });
        }
        
        // Handle scrolling behavior based on zoom level
        setTimeout(() => {
          const betterViewerContent = document.querySelector(`.${styles.betterViewerContent}`);
          if (betterViewerContent) {
            if (newScale > 1) {
              betterViewerContent.style.overflowX = 'auto';
              betterViewerContent.style.overflowY = 'auto';
              betterViewerContent.style.justifyContent = 'flex-start';
              betterViewerContent.style.alignItems = 'flex-start';
            } else {
              betterViewerContent.style.overflowX = 'hidden';
              betterViewerContent.style.overflowY = 'auto';
              betterViewerContent.style.justifyContent = 'center';
              betterViewerContent.style.alignItems = 'center';
            }
          }
        }, 50);
        return;
      }
    };

    if (testStarted && !isSubmitted) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [testStarted, isSubmitted, isBetterViewer]); // Removed function dependencies

  // Fullscreen monitoring
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isCurrentlyFullscreen);
      setShowFullscreenPrompt(!isCurrentlyFullscreen && testStarted && !isBetterViewer && !isSubmitted);

      if (!isCurrentlyFullscreen && testStarted && !isSubmitting && !isBetterViewer && !isSubmitted) {
        // Inline violation handling to avoid dependency
        setViolations(prev => [...prev, {
          type: 'Exited Fullscreen',
          timestamp: new Date().toISOString(),
          details: { timestamp: new Date().toISOString() }
        }]);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [testStarted, isSubmitting, isBetterViewer, isSubmitted]); // Removed function dependency

  // Visibility change monitoring
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!testStarted || isSubmitted || isBetterViewer || isFilePickerOpen) return;

      if (document.visibilityState === 'hidden') {
        const timeSinceLastFocus = Date.now() - lastFocusTime.current;
        if (timeSinceLastFocus > 1000) {
          // Inline violation handling to avoid dependency
          setViolations(prev => [...prev, {
            type: 'Tab Switch / Window Switch',
            timestamp: new Date().toISOString(),
            details: { 
              timestamp: new Date().toISOString(),
              timeSinceLastFocus 
            }
          }]);
        }
      } else {
        lastFocusTime.current = Date.now();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [testStarted, isSubmitted, isBetterViewer, isFilePickerOpen]); // Added isFilePickerOpen dependency

  // Better viewer scroll management
  useEffect(() => {
    if (isBetterViewer) {
      const betterViewerContent = document.querySelector(`.${styles.betterViewerContent}`);
      if (betterViewerContent) {
        // Manage scrolling behavior based on current zoom level
        if (pdfScale > 1) {
          betterViewerContent.style.overflowX = 'auto';
          betterViewerContent.style.overflowY = 'auto';
          betterViewerContent.style.justifyContent = 'flex-start';
          betterViewerContent.style.alignItems = 'flex-start';
        } else {
          betterViewerContent.style.overflowX = 'hidden';
          betterViewerContent.style.overflowY = 'auto';
          betterViewerContent.style.justifyContent = 'center';
          betterViewerContent.style.alignItems = 'center';
        }
      }
    }
  }, [isBetterViewer, pdfScale]);

  // Fullscreen enforcement functions
  const enterFullscreen = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
        setShowFullscreenPrompt(false);
        toast.success('✅ Fullscreen mode activated');
      }
    } catch (error) {
      console.warn('Failed to enter fullscreen:', error);
      toast.error('⚠️ Fullscreen mode required for this test');
    }
  };

  const handleFullscreenEnforce = () => {
    if (!document.fullscreenElement && testStarted && !isSubmitted) {
      setTimeout(() => {
        if (!document.fullscreenElement) {
          setShowFullscreenPrompt(true);
        }
      }, 2000); // Show prompt after 2 seconds if still not in fullscreen
    }
  };

  // Auto-enforce fullscreen on test start if required
  useEffect(() => {
    if (testStarted && test?.proctoringSettings?.requireFullscreen && !document.fullscreenElement && !isSubmitted) {
      handleFullscreenEnforce();
    }
  }, [testStarted, test?.proctoringSettings?.requireFullscreen, isSubmitted]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Cleanup monitoring when component unmounts
      if (monitoringIntervalRef.current) {
        clearInterval(monitoringIntervalRef.current);
      }
      
      if (videoRef.current?.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach(track => track.stop());
      }
      
      // End monitoring session if active
      if (monitoringSessionId) {
        const token = localStorage.getItem('token');
        if (token) {
          axios.post('/api/student/monitoring/end', {
            sessionId: monitoringSessionId
          }, {
            headers: { Authorization: `Bearer ${token}` }
          }).catch(error => {
            console.error('❌ Failed to cleanup monitoring session on unmount:', error);
          });
        }
      }
    };
  }, [monitoringSessionId]);

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Loading test...</p>
        </div>
      </div>
    );
  }

  // Render submitted state
  if (isSubmitted) {
    return (
      <div className={styles.container}>
        <div className={styles.submitted}>
          <h2>✅ Test Submitted Successfully!</h2>
          <p>Your test has been submitted and is being processed.</p>
          <p>You will be redirected to your dashboard shortly.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.testInfo}>
          <h1>{test?.title || 'Traditional Test'}</h1>
          <div className={styles.testMeta}>
            <span>📚 {test?.subject}</span>
            <span>🎯 {test?.totalMarks} marks</span>
            <span>⏱️ {test?.duration} minutes</span>
          </div>
        </div>
        
        <div className={styles.controls}>
          {testStarted && (
            <TimerDisplay timeLeft={timeLeft} isWarning={isTimeWarning} />
          )}
          
          {test?.cameraMonitoring?.enabled && (
            <MonitoringStatus 
              violations={violations} 
              maxViolations={maxViolations}
              isMonitoring={isMonitoring} 
            />
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className={styles.main}>
        {!testStarted ? (
          // Test start screen
          <div className={styles.startScreen}>
            <div className={styles.instructions}>
              <h2>📋 Test Instructions</h2>
              <div className={styles.instructionsList}>
                <div className={styles.instruction}>
                  <span className={styles.instructionIcon}>⏰</span>
                  <span>You have {test?.duration} minutes to complete this test</span>
                </div>
                <div className={styles.instruction}>
                  <span className={styles.instructionIcon}>📄</span>
                  <span>Download and solve the question paper</span>
                </div>
                {test?.paperSubmissionRequired && (
                  <div className={styles.instruction}>
                    <span className={styles.instructionIcon}>📤</span>
                    <span>Upload your answer sheet before submitting</span>
                  </div>
                )}
                {test?.cameraMonitoring?.enabled && (
                  <div className={styles.instruction}>
                    <span className={styles.instructionIcon}>📹</span>
                    <span>Camera monitoring is enabled for this test</span>
                  </div>
                )}
                <div className={styles.instruction}>
                  <span className={styles.instructionIcon}>⚠️</span>
                  <span>Do not switch tabs or use prohibited keys</span>
                </div>
              </div>
              
              {test?.instructions && (
                <div className={styles.customInstructions}>
                  <h3>Additional Instructions:</h3>
                  <p>{test.instructions}</p>
                </div>
              )}
            </div>
            
            <button 
              onClick={handleStartTest}
              className={styles.startButton}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Starting...' : 'Start Test'}
            </button>
          </div>
        ) : (
          // Test interface
          <div className={styles.testInterface}>
            {/* Left Panel - Question Paper */}
            <div className={`${styles.leftPanel} ${isBetterViewer ? styles.hidden : ''}`}>
              <div className={styles.questionPaper}>
                <div className={styles.questionPaperHeader}>
                  <h3>📄 Question Paper</h3>
                  {pdfUrl && (
                    <button
                      onClick={enterBetterViewer}
                      className={styles.betterViewerButton}
                      title="Open Better Viewer"
                    >
                      🔍 Better Viewer
                    </button>
                  )}
                </div>
                
                {pdfUrl ? (
                  <div className={styles.pdfContainer}>
                    <iframe
                      ref={pdfViewerRef}
                      src={enhanceEmbedUrl(pdfUrl)}
                      className={styles.pdfViewer}
                      title="Question Paper"
                      onError={() => setPdfError('Failed to load PDF')}
                      onLoad={() => setPdfError(null)}
                    />
                  </div>
                ) : pdfError ? (
                  <div className={styles.pdfError}>
                    <span>❌ {pdfError}</span>
                  </div>
                ) : (
                  <div className={styles.pdfLoading}>
                    <div className={styles.spinner}></div>
                    <span>Loading question paper...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Right Panel - Answer Sheet Upload */}
            <div className={styles.rightPanel}>
              <AnswerSheetUploader
                answerSheetUrl={answerSheetUrl}
                onUpload={uploadAnswerSheet}
                isUploading={isUploading}
                isRequired={test?.paperSubmissionRequired}
                testId={testId}
                onFilePickerOpen={() => setIsFilePickerOpen(true)}
                onFilePickerClose={() => setIsFilePickerOpen(false)}
                onCameraOpen={handleCameraClick}
                onCameraClose={handleCameraClose}
                handleMobileUploadRequest={handleMobileUploadRequest}
                mobileUploadRequested={mobileUploadRequested}
                mobileUploadDetected={mobileUploadDetected}
                mobileUploadCount={mobileUploadCount}
                mobileUploadExpiry={mobileUploadExpiry}
                mobileUploadUrl={mobileUploadUrl}
                showQRCode={showQRCode}
              />
              
              {/* Test Actions */}
              <div className={styles.testActions}>
                <button
                  onClick={handleSubmit}
                  className={`${styles.submitButton} ${!canSubmit ? styles.disabled : ''}`}
                  disabled={!canSubmit || isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <span className={styles.spinner}></span>
                      Ending Test...
                    </>
                  ) : (
                    'End Test'
                  )}
                </button>
              </div>
            </div>
            
            {/* Better Viewer Overlay */}
            {isBetterViewer && pdfUrl && (
              <div className={styles.betterViewerOverlay}>
                {/* Close Button */}
                <button
                  className={styles.betterViewerClose}
                  onClick={exitBetterViewer}
                  title="Exit Better Viewer (ESC)"
                >
                  ✕
                </button>

                {/* Timer in Better Viewer */}
                <div className={styles.betterViewerTimer}>
                  <TimerDisplay 
                    timeLeft={timeLeft}
                    isWarning={isTimeWarning}
                  />
                </div>

                {/* Zoom Controls */}
                <div className={styles.betterViewerZoom}>
                  <button
                    className={styles.zoomBtn}
                    onClick={() => handlePdfZoom('out')}
                    disabled={pdfScale <= 0.5}
                    title="Zoom Out (Ctrl+-)"
                  >
                    🔍➖
                  </button>

                  <span className={styles.zoomDisplay}>
                    {Math.round(pdfScale * 100)}%
                  </span>

                  <button
                    className={styles.zoomBtn}
                    onClick={() => handlePdfZoom('in')}
                    disabled={pdfScale >= 3}
                    title="Zoom In (Ctrl++)"
                  >
                    🔍➕
                  </button>

                  <button
                    className={styles.zoomBtn}
                    onClick={() => {
                      setPdfScale(1.25);
                      // Handle scrolling for 125% zoom
                      setTimeout(() => {
                        const betterViewerContent = document.querySelector(`.${styles.betterViewerContent}`);
                        if (betterViewerContent) {
                          betterViewerContent.style.overflowX = 'auto';
                          betterViewerContent.style.overflowY = 'auto';
                          betterViewerContent.style.justifyContent = 'flex-start';
                          betterViewerContent.style.alignItems = 'flex-start';
                        }
                      }, 50);
                    }}
                    title="Reset Zoom (Ctrl+0)"
                  >
                    🎯
                  </button>
                </div>

                {/* PDF Content */}
                <div className={styles.betterViewerContent}>
                  <div
                    className={styles.pdfContainerBetter}
                    style={{
                      transform: `scale(${pdfScale})`,
                      transformOrigin: 'top center',
                      transition: 'transform 0.3s ease'
                    }}
                  >
                    <div className={styles.popoutBlockerContainer}>
                      <iframe
                        ref={pdfViewerRef}
                        src={enhanceEmbedUrl(pdfUrl)}
                        title="Question Paper Better Viewer"
                        className={styles.pdfViewerBetter}
                        width="100%"
                        height="100%"
                        sandbox="allow-same-origin allow-scripts"
                        scrolling="yes"
                        onError={() => setPdfError('Failed to load PDF in better viewer')}
                        onLoad={() => setPdfError(null)}
                      />
                      {/* Overlay to prevent popout buttons */}
                      <div className={styles.popoutBlockerOverlay}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Fullscreen Enforcement Prompt */}
      {showFullscreenPrompt && test?.proctoringSettings?.requireFullscreen && (
        <div className={styles.fullscreenOverlay}>
          <div className={styles.fullscreenPrompt}>
            <div className={styles.fullscreenIcon}>⛔</div>
            <h3>Fullscreen Mode Required</h3>
            <p>This test requires fullscreen mode for security purposes.</p>
            <p>Please click the button below to continue in fullscreen mode.</p>
            <div className={styles.fullscreenActions}>
              <button 
                onClick={enterFullscreen}
                className={styles.fullscreenButton}
              >
                📺 Enter Fullscreen
              </button>
            </div>
            <div className={styles.fullscreenWarning}>
              <small>⚠️ Exiting fullscreen mode will be recorded as a violation</small>
            </div>
          </div>
        </div>
      )}

      {/* Hidden monitoring elements */}
      {test?.cameraMonitoring?.enabled && (
        <div className={styles.monitoringElements}>
          <video ref={videoRef} style={{ display: 'none' }} />
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>
      )}
    </div>
  );
};

export default TraditionalTestInterface;
