import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../App';
import { toast } from 'react-toastify';
import LoadingSpinner from '../LoadingSpinner';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { useWebWorkerTimer } from '../../hooks/useWebWorkerTimer'; // Optimized timer hook
import TimerDisplay from '../common/TimerDisplay'; // Optimized timer display
import { useDevToolsProtection } from '../../hooks/useDevToolsProtection'; // Security protection
import PaperUpload from './PaperUpload';
import PaperUploadTimer from './PaperUploadTimer';
import styles from './TestInterface.module.css';
import offlineHandler from '../../utils/offlineHandler';
import axios from 'axios';
import Swal from 'sweetalert2';
import { confirmDelete, confirmAction, successAlert, errorAlert } from '../../utils/SweetAlerts';
import { enhanceEmbedUrl } from '../../utils/googleDriveUtils';
import TestMonitoringSystem from '../../utils/TestMonitoringSystem';
import QRCode from 'react-qr-code';
const TestInterface = () => {
  const { testId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Check if this is a resume session
  const isResumeSession = searchParams.get('resume') === 'true';
  
  // Core test state
  const [test, setTest] = useState(null);
  const [answers, setAnswers] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [testStarted, setTestStarted] = useState(false);

  // Get max violations from test settings or default to 10
  const maxViolations = test?.proctoringSettings?.maxViolations || 10;
  
  // Security protection for exam environment - Use test's maxViolations setting
  useDevToolsProtection({
    strictMode: test?.proctoringSettings?.strictMode || true,
    maxViolations: maxViolations,
    onViolation: (type, count) => {
      console.warn(`Exam Security Violation: ${type} (${count}/${maxViolations})`);
      
      // Use enhanced violation handler
      handleViolation(type, { count, maxViolations, timestamp: new Date().toISOString() });
      
      // Report security violation to server (legacy support)
      if (user && testId) {
        axios.post('/api/security-violation', {
          studentId: user._id,
          testId: testId,
          violationType: type,
          violationCount: count,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          screenResolution: `${window.screen.width}x${window.screen.height}`
        }).catch(err => console.error('Failed to report security violation:', err));
      }
    }
  });
  
  // Optimized timer hook
  const timer = useWebWorkerTimer(testId);
  
  const [offlineAnswers, setOfflineAnswers] = useState({});
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [pendingSave, setPendingSave] = useState(false);
  const { isOnline, queueRequest } = useOnlineStatus();
  const mountedRef = useRef(true);
  const [autoSubmit, setAutoSubmit] = useState(false);
  const [autoSubmitReason, setAutoSubmitReason] = useState('');
  const violationTimeoutRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false); // Flag to disable violations during file upload
  const [answerSheetUrl, setAnswerSheetUrl] = useState(null);
  const autoSaveRef = useRef(null);
  const pdfViewerRef = useRef(null);
  const testStartTimeRef = useRef(null);
  const testEndTimeRef = useRef(null);
  const submissionLockRef = useRef(false); // Submission lock to prevent multiple submissions
  const [timeTaken, setTimeTaken] = useState(0);
  const [googleDriveConnected, setGoogleDriveConnected] = useState(false);
  const [checkingGoogleDrive, setCheckingGoogleDrive] = useState(false);

  // Capture browser info once
  const [browserInfo] = useState({
    userAgent: navigator.userAgent,
    screenResolution: `${window.screen.width}x${window.screen.height}`,
    viewport: `${window.innerWidth}x${window.innerHeight}`
  });

  // Core test state

  // Enhanced file upload state with camera support
  const [answerFile, setAnswerFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Camera and multiple images state
  const [capturedImages, setCapturedImages] = useState([]);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const cameraRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  
  // Monitoring state
  const [monitoringActive, setMonitoringActive] = useState(false);
  const [monitoringImages, setMonitoringImages] = useState([]);
  const [suspiciousActivities, setSuspiciousActivities] = useState([]);
  const [cameraMonitoringEnabled, setCameraMonitoringEnabled] = useState(false);
  const [showVideoPreview, setShowVideoPreview] = useState(false);
  const [cameraMinimized, setCameraMinimized] = useState(false);
  const [debugLogs, setDebugLogs] = useState([]);
  const [showDebugPanel, setShowDebugPanel] = useState(true);
  const monitoringIntervalRef = useRef(null);
  const lastCaptureTimeRef = useRef(0);
  const streamRef = useRef(null);
  const cameraInitializingRef = useRef(false);
  
  // Enhanced monitoring state for TestMonitoringSystem
  const [totalViolations, setTotalViolations] = useState(0);
  const [monitoringSessionId, setMonitoringSessionId] = useState(null);
  // Use existing video and canvas refs for monitoring
  const videoMonitoringRef = videoRef;
  const canvasMonitoringRef = canvasRef;
  
  // Toast tracking to prevent excessive notifications
  const [cameraActiveToastShown, setCameraActiveToastShown] = useState(false);
  const [monitoringStartedToastShown, setMonitoringStartedToastShown] = useState(false);
  const [cameraPermissionToastShown, setCameraPermissionToastShown] = useState(false);
  const [cameraErrorToastShown, setCameraErrorToastShown] = useState(false);
  const [googleDriveToastShown, setGoogleDriveToastShown] = useState(false);

  // Eye tracking ref for ML detection
  const eyeTrackingRef = useRef({
    previousFrame: null,
    movementHistory: []
  });

  // Debug logging function - shows messages on screen instead of console
  const addDebugLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const log = { message, type, timestamp, id: Date.now() };
    setDebugLogs(prev => [...prev.slice(-4), log]); // Keep only last 5 logs
  };

  // Mobile upload QR code state
  const [mobileUploadUrl, setMobileUploadUrl] = useState(null);
  const [showQRCode, setShowQRCode] = useState(false);
  const [qrCodeExpiry, setQrCodeExpiry] = useState(null);
  
  // Mobile upload detection state
  const [mobileUploadDetected, setMobileUploadDetected] = useState(false);
  const [mobileUploadCount, setMobileUploadCount] = useState(0);
  const [lastUploadCheck, setLastUploadCheck] = useState(null);

  // Device detection
  const isMobileDevice = useCallback(() => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }, []);

  const getOptimalCameraConstraints = useCallback(() => {
    const mobile = isMobileDevice();
    return {
      video: {
        width: mobile ? { ideal: 640 } : { ideal: 1280 },
        height: mobile ? { ideal: 480 } : { ideal: 720 },
        facingMode: mobile ? 'user' : 'user', // Front camera for both
        frameRate: { ideal: 15, max: 30 }
      },
      audio: false
    };
  }, [isMobileDevice]);

  // Proctoring state
  const [violations, setViolations] = useState([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [warningShown, setWarningShown] = useState(false);
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(false);
  const [focusLostCount, setFocusLostCount] = useState(0);
  const [lastFocusTime, setLastFocusTime] = useState(Date.now());
  const [fiveMinuteWarningShown, setFiveMinuteWarningShown] = useState(false);
  const [showCriticalTimeWarning, setShowCriticalTimeWarning] = useState(false);

  // PDF and viewer state
  const [pdfError, setPdfError] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfUrl, setPdfUrl] = useState('');
  const [isBetterViewer, setIsBetterViewer] = useState(false);
  const [pdfScale, setPdfScale] = useState(1);

  // Paper upload modal state
  const [showPaperUploadModal, setShowPaperUploadModal] = useState(false);
  const [paperUploadTimeRemaining, setPaperUploadTimeRemaining] = useState(0);
  const [paperUploadPages, setPaperUploadPages] = useState([]);
  const [currentPageNumber, setCurrentPageNumber] = useState(1);
  const paperUploadTimerRef = useRef(null);

  // Paper upload state
  const [showPaperUploadTimer, setShowPaperUploadTimer] = useState(false);
  const [paperUploadComplete, setPaperUploadComplete] = useState(false);
  const [uploadMethod, setUploadMethod] = useState('camera'); // 'camera' or 'file'
  const [uploadedPages, setUploadedPages] = useState([]); // For ordered page management
  const [pageOrderMode, setPageOrderMode] = useState(false); // Enable drag-drop reordering
  // Optimized time taken tracker (separate from main timer)
  useEffect(() => {
    if (!testStarted) return;
    
    const startTime = Date.now();
    const interval = setInterval(() => {
      setTimeTaken(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    
    return () => clearInterval(interval);
  }, [testStarted]);
  
  // Check for mobile uploads periodically during test
  useEffect(() => {
    if (!testStarted || isSubmitted) return;
    
    // Initial check
    checkMobileUploadStatus();
    
    // Set up periodic checking every 30 seconds
    const uploadCheckInterval = setInterval(() => {
      checkMobileUploadStatus();
    }, 30000);
    
    return () => clearInterval(uploadCheckInterval);
  }, [testStarted, isSubmitted, checkMobileUploadStatus]);
  
  // Sync offline answers when coming back online
  const syncOfflineAnswers = useCallback(async () => {
    if (!isOnline || Object.keys(offlineAnswers).length === 0) return;

    try {
      setPendingSave(true);
      
      // Merge offline answers with current answers
      const mergedAnswers = { ...answers, ...offlineAnswers };
      setAnswers(mergedAnswers);
      
      // Save to localStorage
      localStorage.setItem(`test-answers-${testId}`, JSON.stringify(mergedAnswers));
      
      // Clear offline answers
      setOfflineAnswers({});
      setLastSyncTime(Date.now());
      
      toast.success('📱 Offline answers synced successfully!');
      console.log('✅ Offline answers synced');
    } catch (error) {
      console.error('❌ Failed to sync offline answers:', error);
      toast.error('Failed to sync offline answers');
    } finally {
      setPendingSave(false);
    }
  }, [isOnline, offlineAnswers, answers, testId]);
  
  // Check Google Drive connection status
  const checkGoogleDriveStatus = useCallback(async () => {
    setCheckingGoogleDrive(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/student/google-drive-status', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setGoogleDriveConnected(response.data.connected || false);
      return response.data.connected || false;
    } catch (error) {
      console.error('Error checking Google Drive status:', error);
      setGoogleDriveConnected(false);
      return false;
    } finally {
      setCheckingGoogleDrive(false);
    }
  }, []);

  // Request mobile upload link for answer sheet
  const requestMobileUploadLink = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/mobile-upload/request', {
        email: user.email,
        testId: testId,
        uploadType: 'answer-sheet',
        expiryMinutes: 10
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        const uploadToken = response.data.token;
        const mobileUrl = `${window.location.origin}/mobile-upload/${uploadToken}`;
        
        // Set mobile upload state for QR code
        setMobileUploadUrl(mobileUrl);
        setShowQRCode(true);
        setQrCodeExpiry(new Date(Date.now() + 10 * 60 * 1000)); // 10 minutes from now

        await Swal.fire({
          title: '📱 Mobile Upload Ready!',
          html: `
            <div style="text-align: left; margin: 1rem 0;">
              <p><strong>✅ Upload link has been sent to:</strong></p>
              <p style="background: #f0f9ff; padding: 8px; border-radius: 4px; font-family: monospace;">${user.email}</p>
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
          width: '500px',
          didOpen: () => {
            // Render QR code in the modal
            const qrContainer = document.getElementById('qr-code-container');
            if (qrContainer) {
              import('react-dom/client').then(({ createRoot }) => {
                const root = createRoot(qrContainer);
                root.render(React.createElement(QRCode, {
                  value: mobileUrl,
                  size: 200,
                  style: { height: "auto", maxWidth: "100%", width: "100%" },
                  viewBox: "0 0 256 256"
                }));
              });
            }
          }
        });
      }
    } catch (error) {
      console.error('Error requesting mobile upload link:', error);
      toast.error('Failed to send mobile upload link. Please try again.');
    }
  }, [user.email, testId]);

  // Check for mobile uploads periodically
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
                background: '#10B981',
                color: 'white',
                padding: '16px',
                borderRadius: '8px',
                fontSize: '14px'
              }
            }
          );
        }
      }
    } catch (error) {
      console.error('Error checking mobile upload status:', error);
    }
  }, [testId, isSubmitted, mobileUploadCount]);

  // Show Google Drive warning before starting test
  const showGoogleDriveWarning = async () => {
    const result = await Swal.fire({
      title: '⚠️ Google Drive Not Connected',
      html: `
        <div style="text-align: left; margin: 1rem 0;">
          <p><strong>Your Google Drive is not connected!</strong></p>
          <br>
          <p>Without Google Drive connection:</p>
          <ul style="margin: 0.5rem 0; padding-left: 1.5rem;">
            <li>❌ Answer sheet upload may fail</li>
            <li>❌ Your test submission might not be saved</li>
            <li>❌ You may lose your work</li>
          </ul>
          <br>
          <p><strong>What would you like to do?</strong></p>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: '📁 Connect Google Drive',
      cancelButtonText: '⚡ Continue Without Connection',
      confirmButtonColor: '#4285f4',
      cancelButtonColor: '#dc3545',
      reverseButtons: true,
      allowOutsideClick: false
    });

    if (result.isConfirmed) {
      // Open OAuth in new window and wait for completion
      return new Promise((resolve) => {
  // Build backend OAuth URL explicitly so SPA router doesn't intercept
  const token = localStorage.getItem('token');
  const DEFAULT_LOCAL_API = 'http://localhost:5000';
  const DEFAULT_PROD_API = 'https://auctutor.app';
  const backendUrl = process.env.REACT_APP_API_URL || (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? DEFAULT_PROD_API : DEFAULT_LOCAL_API);
  const oauthUrl = `${backendUrl}/auth/google${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  const oauthWindow = window.open(oauthUrl, 'googleOAuth', 'width=500,height=600');
        
        // Check periodically if the window is closed
        const checkClosed = setInterval(() => {
          if (oauthWindow.closed) {
            clearInterval(checkClosed);
            // Re-check Google Drive status after OAuth
            setTimeout(async () => {
              const isConnected = await checkGoogleDriveStatus();
              if (isConnected && !googleDriveToastShown) {
                toast.success('✅ Google Drive connected successfully!', { toastId: 'google-drive-success' });
                setGoogleDriveToastShown(true);
                resolve(true); // Allow test to start
              } else if (!isConnected) {
                toast.warning('⚠️ Google Drive connection failed. Proceeding without connection.', { toastId: 'google-drive-warning' });
                resolve(true); // Still allow test to start
              } else {
                resolve(true); // Already shown toast, just resolve
              }
            }, 1000);
          }
        }, 1000);
        
        // Timeout after 5 minutes
        setTimeout(() => {
          if (!oauthWindow.closed) {
            oauthWindow.close();
            clearInterval(checkClosed);
            toast.warning('⚠️ OAuth timeout. Proceeding without Google Drive.');
            resolve(true);
          }
        }, 300000);
      });
    } else {
      // Continue without Google Drive (risky)
      toast.warning('⚠️ Proceeding without Google Drive - Upload may fail!', {
        autoClose: 8000
      });
      return true; // Allow test to start
    }
  };

  // Cleanup function - moved early to fix hoisting issue
  const cleanup = () => {
    console.log('🧹 Cleaning up TestInterface...');
    
    // Stop Web Worker timer
    if (timer.isRunning) {
      timer.stopTimer();
    }

    // Clear timeouts
    if (violationTimeoutRef.current) {
      clearTimeout(violationTimeoutRef.current);
      violationTimeoutRef.current = null;
    }
    
    if (autoSaveRef.current) {
      clearTimeout(autoSaveRef.current);
      autoSaveRef.current = null;
    }

    // Save current state before cleanup
    if (testStarted && timer.timeRemaining > 0 && !isSubmitted) {
      localStorage.setItem(`test-remaining-${testId}`, timer.timeRemaining.toString());
      localStorage.setItem(`test-last-save-${testId}`, Date.now().toString());
    }

    // Remove event listeners
    document.removeEventListener('visibilitychange', handleVisibilityChange, true);
    document.removeEventListener('contextmenu', handleRightClick, true);
    document.removeEventListener('keydown', handleKeyDown, true);
    document.removeEventListener('fullscreenchange', handleFullscreenChange, true);
    window.removeEventListener('blur', handleWindowFocus, true);
    document.removeEventListener('mouseleave', handleMouseLeave);

    // Restore body overflow
    document.body.style.overflow = 'auto';

    // Exit fullscreen if in fullscreen mode
    if (document.exitFullscreen && document.fullscreenElement) {
      document.exitFullscreen().catch(err => console.log('Exit fullscreen error:', err));
    }
  };

  // Enhanced monitoring functions for TestMonitoringSystem
  const startEnhancedMonitoring = useCallback(async () => {
    try {
      const sessionId = await TestMonitoringSystem.startMonitoring(testId, {
        studentId: user._id,
        testType: 'traditional',
        videoElement: videoMonitoringRef.current,
        canvasElement: canvasMonitoringRef.current
      });
      
      setMonitoringSessionId(sessionId);
      setMonitoringActive(true);
      
      console.log('📹 Enhanced monitoring started for traditional test');
      toast.success('🔒 Monitoring system activated', {
        position: 'top-right',
        autoClose: 3000
      });
    } catch (error) {
      console.error('Failed to start enhanced monitoring:', error);
      toast.error('Failed to start monitoring system');
    }
  }, [testId, user]);

  // End enhanced monitoring function - moved early to fix hoisting issue
  const endEnhancedMonitoring = useCallback(async () => {
    try {
      if (monitoringSessionId) {
        await TestMonitoringSystem.endMonitoring();
        console.log('📹 Enhanced monitoring ended');
      }
    } catch (error) {
      console.error('Error ending enhanced monitoring:', error);
    }
  }, [monitoringSessionId]);

  // Handle submit function - moved early to fix hoisting issue
  const handleSubmit = useCallback(async (isAutoSubmit = false, autoSubmitReason = null) => {
    console.log('🚀 handleSubmit called', {
      isAutoSubmit,
      autoSubmitReason,
      isSubmitting,
      isSubmitted,
      submissionLock: submissionLockRef.current,
      test: test?.paperSubmissionRequired,
      answerSheetUrl
    });

    if (isSubmitting || isSubmitted || submissionLockRef.current) {
      console.log('❌ Submit blocked by conditions');
      return;
    }

    // Check paper submission requirement for manual submission
    if (!isAutoSubmit && test?.paperSubmissionRequired && !answerSheetUrl) {
      toast.error('📄 Paper submission is required for this test. Please upload your answer sheet first.', {
        autoClose: 5000
      });
      return;
    }

    // Skip confirmation for auto-submit
    if (!isAutoSubmit) {
      const result = await Swal.fire({
        title: 'Submit Test?',
        html: `
        <p>Are you sure you want to submit your test?</p>
        <p><strong>You cannot make changes after submission.</strong></p>
        ${!isOnline ? '<p style="color: #f59e0b;">⚠️ You are offline - submission will be queued</p>' : ''}
        ${test?.paperSubmissionRequired ? '<p style="color: #10b981;">✅ Answer sheet uploaded</p>' : ''}
      `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Yes, Submit',
        cancelButtonText: 'Review Again'
      });

      if (!result.isConfirmed) return;
    }

    submissionLockRef.current = true;
    setIsSubmitting(true);

    try {
      // Merge any offline answers before submission
      const finalAnswers = { ...answers, ...offlineAnswers };
      
      const payload = {
        answers: finalAnswers,
        answerSheetUrl,
        violations,
        autoSubmit: isAutoSubmit,
        autoSubmitReason,
        timeTaken,
        browserInfo,
        offlineAnswers: Object.keys(offlineAnswers).length > 0 ? offlineAnswers : null,
        // Include monitoring and proctoring data
        monitoringData: {
          monitoringImages: monitoringImages.map(img => ({
            data: img.data,
            timestamp: img.timestamp,
            type: img.type || 'monitoring',
            testId: img.testId,
            studentId: img.studentId
          })),
          suspiciousActivities: suspiciousActivities.map(activity => ({
            timestamp: activity.timestamp,
            type: activity.type,
            confidence: activity.confidence,
            description: activity.description,
            severity: activity.severity || 'medium'
          })),
          cameraMonitoring: test?.cameraMonitoring?.enabled || false,
          testStartTime: testStartTimeRef.current,
          testEndTime: new Date().toISOString()
        }
      };

      const makeSubmitRequest = async () => {
        const token = localStorage.getItem('token');
        const response = await axios.post(
          `/api/student/test/${testId}/submit`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        return response;
      };

      const response = await queueRequest(makeSubmitRequest, {
        description: 'Submit test'
      });

      if (response.data.success) {
        // Check if paper submission is required
        if (test?.paperSubmissionRequired && !isAutoSubmit) {
          // Show paper upload timer instead of completion message
          setShowPaperUploadTimer(true);
        } else {
          setIsSubmitted(true);
        }
        
        // End enhanced monitoring before cleanup
        await endEnhancedMonitoring();
        
        // Clear offline data
        setOfflineAnswers({});
        localStorage.removeItem(`test-answers-${testId}`);
        localStorage.removeItem(`test-violations-${testId}`);

        if (!test?.paperSubmissionRequired || isAutoSubmit) {
          await Swal.fire({
            title: 'Test Submitted!',
            text: isAutoSubmit
              ? `Test auto-submitted due to: ${autoSubmitReason}`
              : 'Your test has been submitted successfully!',
            icon: 'success',
            confirmButtonColor: '#10b981',
            timer: 3000,
            timerProgressBar: true
          });
        }

        cleanup();
        navigate('/student', { state: { resultId: response.data.resultId } });
      } else {
        throw new Error(response.data.message || 'Submission failed');
      }
    } catch (err) {
      console.error('Submit error:', err);
      await Swal.fire({
        title: 'Submission Failed',
        text: `Submission error: ${err.message}`,
        icon: 'error',
        confirmButtonColor: '#dc2626'
      });
      submissionLockRef.current = false;
    } finally {
      setIsSubmitting(false);
    }
  }, [
    isSubmitting,
    isSubmitted,
    test,
    answerSheetUrl,
    isOnline,
    answers,
    offlineAnswers,
    violations,
    timeTaken,
    browserInfo,
    testId,
    queueRequest,
    setShowPaperUploadTimer,
    setIsSubmitted,
    cleanup,
    navigate,
    monitoringImages,
    suspiciousActivities,
    testStartTimeRef,
    endEnhancedMonitoring
  ]);

  const handleViolation = useCallback(async (type, details = {}) => {
    try {
      const newViolationCount = totalViolations + 1;
      setTotalViolations(newViolationCount);
      
      // Record violation with TestMonitoringSystem
      await TestMonitoringSystem.recordViolation({
        type,
        details: {
          ...details,
          timestamp: new Date().toISOString(),
          totalViolations: newViolationCount
        }
      });
      
      // Show user warning
      toast.warning(`⚠️ Security Violation: ${type} (${newViolationCount}/10)`, {
        position: 'top-center',
        autoClose: 4000
      });
      
      console.log(`🚨 Violation recorded: ${type}, Total: ${newViolationCount}`);
      
      // Auto-submit if max violations reached
      if (newViolationCount >= 10) {
        handleSubmit(true, `Maximum violations reached: ${type}`);
      }
    } catch (error) {
      console.error('Error handling violation:', error);
    }
  }, [totalViolations, handleSubmit]);

  // Handle auto-submit function - moved early to fix hoisting issue
  const handleAutoSubmit = useCallback(async (reason) => {
    if (!test || isSubmitting || isSubmitted || submissionLockRef.current) return;

    console.log(`🔒 Auto-submit triggered: ${reason}`);
    submissionLockRef.current = true;

    const reasons = {
      time_limit: '⏰ Time limit reached',
      violations: '⚠️ Maximum violations exceeded',
      window_focus: '🪟 Window focus lost too many times',
      tab_switch: '🔄 Too many tab switches detected',
      fullscreen_exit: '📺 Exited fullscreen too many times',
      paper_upload_timeout: '📄 Paper upload time expired',
      paper_uploaded: '📄 Paper uploaded successfully',
      exited_without_upload: '🚪 Exited without uploading'
    };

    const reasonText = reasons[reason] || reason;

    // For time limit, submit immediately without countdown
    if (reason === 'time_limit') {
      console.log('⏰ Time limit reached - submitting immediately');
      toast.error('⏰ Time limit reached! Submitting test automatically...', { autoClose: 2000 });
      
      // Submit immediately for time limit
      setTimeout(() => {
        handleSubmit(true, reasonText);
      }, 1000);
      return;
    }

    // Show countdown with SweetAlert2 for other violations
    let timerInterval;
    const { isConfirmed } = await Swal.fire({
      title: 'Auto-Submit Warning!',
      html: `
        <div style="text-align: center;">
          <p><strong>${reasonText}</strong></p>
          <p>Test will be submitted automatically in:</p>
          <p style="font-size: 2rem; color: #dc2626; margin: 1rem 0;">
            <span id="countdown">5</span> seconds
          </p>
          <p style="font-size: 0.9rem; color: #6b7280;">
            Click "Submit Now" to submit immediately
          </p>
          <p style="font-size: 0.8rem; color: #6b7280; margin-top: 1rem;">
            Note: Test will be submitted with or without answer sheet upload
          </p>
        </div>
      `,
      icon: 'warning',
      showCancelButton: false,
      confirmButtonText: 'Submit Now',
      confirmButtonColor: '#dc2626',
      allowOutsideClick: false,
      allowEscapeKey: false,
      timer: 5000,
      timerProgressBar: true,
      didOpen: () => {
        const countdownElement = Swal.getHtmlContainer().querySelector('#countdown');
        let countdown = 5;
        timerInterval = setInterval(() => {
          countdown--;
          if (countdownElement) {
            countdownElement.textContent = countdown;
          }
          if (countdown <= 0) {
            clearInterval(timerInterval);
          }
        }, 1000);
      },
      willClose: () => {
        clearInterval(timerInterval);
      }
    });

    // Submit the test (works with or without answer sheet upload)
    await handleSubmit(true, reason);
  }, [test, isSubmitting, isSubmitted, handleSubmit]); // Added handleSubmit to dependencies
  
  
   useEffect(() => {
    console.log('🌐 Initializing offline handler for test interface...');
    const cleanup = offlineHandler.init();
    
    // Check Google Drive status when component loads
    checkGoogleDriveStatus();
    
    return () => {
      if (cleanup) cleanup();
    };
  }, [checkGoogleDriveStatus]);
  useEffect(() => {
    if (isOnline && pendingSave) {
      console.log('🔄 Back online - syncing offline answers...');
      syncOfflineAnswers();
    }
  }, [isOnline, pendingSave, syncOfflineAnswers]);

  // Enhanced violation detection
  const recordViolation = useCallback((type, details, severity = 'medium') => {
    if (isSubmitted || submissionLockRef.current) return; // Don't record violations after submission
    if (isUploadingFiles) {
      console.log(`📎 Skipping violation "${type}" during file upload`);
      return; // Don't record violations during file upload
    }

    const violation = {
      type,
      timestamp: new Date().toISOString(),
      details,
      severity,
      sessionTime: testStartTimeRef.current ? Date.now() - testStartTimeRef.current : 0
    };

    setViolations(prev => {
      const newViolations = [...prev, violation];
      console.log(`🚨 Violation recorded: ${type} (${newViolations.length}/5)`);

      localStorage.setItem(`test-violations-${testId}`, JSON.stringify(newViolations));

      if (newViolations.length >= 5 && !submissionLockRef.current) {
        toast.error('🚨 MAXIMUM VIOLATIONS REACHED! Test will be auto-submitted in 5 seconds!', {
          autoClose: false,
          toastId: 'max-violations'
        });

        // Set submission lock immediately to prevent multiple auto-submissions
        submissionLockRef.current = true;
        setTimeout(() => {
          handleAutoSubmit('violations');
        }, 5000);
      } else if (!submissionLockRef.current) {
        const remaining = 5 - newViolations.length;
        toast.error(`🚨 VIOLATION ${newViolations.length}/5: ${type}! ${remaining} warnings remaining.`, {
          autoClose: 4000,
          toastId: `violation-${newViolations.length}`
        });
      }

      return newViolations;
    });
  }, [testId, isSubmitted, isUploadingFiles]);
  // When fetching PDF URL:
  // When needing to display a file:
  const fetchFileUrl = async (type, key) => {
    const { data } = await axios.get(`/api/files/${type}/${key}`);
    return data.url;
  };


  // Enhanced visibility change handler
  const handleVisibilityChange = useCallback(() => {
    if (!testStarted || !test || isSubmitting || !mountedRef.current || isSubmitted) return;

    if (document.visibilityState === 'hidden') {
      const timeSinceLastFocus = Date.now() - lastFocusTime;

      if (timeSinceLastFocus > 1000) {
        recordViolation(
          'Tab Switch / Window Switch',
          `Student switched away from exam window for ${Math.round(timeSinceLastFocus / 1000)} seconds`,
          'high'
        );
      }
    } else if (document.visibilityState === 'visible') {
      setLastFocusTime(Date.now());
    }
  }, [testStarted, test, isSubmitting, lastFocusTime, recordViolation, isSubmitted]);

  const handleRightClick = useCallback((e) => {
    if (!testStarted || isSubmitted) return;
    e.preventDefault();
    recordViolation('Right Click Detected', 'Student attempted to right-click', 'low');
    toast.warning('⚠️ Right-click is disabled during the exam');
  }, [testStarted, recordViolation, isSubmitted]);

  const handleKeyDown = useCallback((e) => {
    if (!testStarted || !test || isSubmitted) return;

    if (e.key === 'Escape' && isBetterViewer) {
      exitBetterViewer();
      return;
    }

    if (isBetterViewer && e.ctrlKey && e.key === '0') {
      setPdfScale(1);
      e.preventDefault();
      return;
    }

    if (isBetterViewer && e.ctrlKey && (e.key === '+' || e.key === '=' || e.key === '-')) {
      if (e.key === '+' || e.key === '=') {
        setPdfScale(prev => Math.min(prev + 0.25, 3));
      } else if (e.key === '-') {
        setPdfScale(prev => Math.max(prev - 0.25, 0.5));
      }
      e.preventDefault();
      return;
    }

    const blockedKeys = [
      'F12', 'F5', 'F1', 'F3', 'F6', 'F7', 'F9', 'F10', 'F11'
    ];

    const blockedCombinations = [
      { ctrl: true, key: 'c' }, { ctrl: true, key: 'v' }, { ctrl: true, key: 'a' },
      { ctrl: true, key: 's' }, { ctrl: true, key: 'p' }, { ctrl: true, key: 'u' },
      { ctrl: true, key: 'r' }, { ctrl: true, key: 'w' }, { ctrl: true, key: 't' },
      { ctrl: true, key: 'n' }, { ctrl: true, key: 'h' },
      { ctrl: true, shift: true, key: 'i' }, { ctrl: true, shift: true, key: 'j' },
      { ctrl: true, shift: true, key: 'c' }, { ctrl: true, shift: true, key: 'd' },
      { ctrl: true, shift: true, key: 'delete' },
      { alt: true, key: 'Tab' }, { alt: true, key: 'F4' },
    ];

    if (blockedKeys.includes(e.key)) {
      e.preventDefault();
      recordViolation('Blocked Key Press', `Attempted to press ${e.key}`, 'medium');
      toast.warning(`⚠️ ${e.key} is disabled during the exam`);
      return;
    }

    for (const combo of blockedCombinations) {
      const ctrlMatch = combo.ctrl ? e.ctrlKey : !e.ctrlKey;
      const shiftMatch = combo.shift ? e.shiftKey : !e.shiftKey;
      const altMatch = combo.alt ? e.altKey : !e.altKey;
      const keyMatch = combo.key.toLowerCase() === e.key.toLowerCase();

      if (ctrlMatch && shiftMatch && altMatch && keyMatch) {
        e.preventDefault();
        recordViolation('Blocked Shortcut', `Attempted to use ${combo.ctrl ? 'Ctrl+' : ''}${combo.shift ? 'Shift+' : ''}${combo.alt ? 'Alt+' : ''}${combo.key}`, 'medium');
        toast.warning('⚠️ This keyboard shortcut is disabled during the exam');
        return;
      }
    }
  }, [testStarted, test, isBetterViewer, recordViolation, isSubmitted]);
  useEffect(() => {
    // Handler: when page becomes hidden or visible
    const handleVisibility = () => {
      if (document.hidden) {
        recordViolation('Tab Switch', 'Student switched tabs', 'high');
      }
    };

    // Handler: window loses focus
    const handleBlur = () => {
      // Don't record window blur as violation anymore
      console.log('👀 Window lost focus');
    };

    // Handler: fullscreen change
    const handleFullscreen = () => {
      if (!document.fullscreenElement) {
        recordViolation('Fullscreen Exit', 'Exited fullscreen', 'high');
      }
    };

    // Handler: context menu (right-click)
    const handleContextMenu = e => {
      e.preventDefault();
      recordViolation('Right Click', 'Attempted right-click', 'low');
    };

    // Handler: copy or paste
    const handleCopyPaste = e => {
      const type = e.type === 'copy' ? 'Copy' : 'Paste';
      recordViolation(type, `Attempted to ${type.toLowerCase()} text`, 'medium');
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('fullscreenchange', handleFullscreen);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('copy', handleCopyPaste);
    document.addEventListener('paste', handleCopyPaste);

    // Clean up on unmount
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('fullscreenchange', handleFullscreen);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('copy', handleCopyPaste);
      document.removeEventListener('paste', handleCopyPaste);
    };
  }, [recordViolation]);

  const handleWindowFocus = useCallback(() => {
    if (!testStarted || !test || isSubmitting || isSubmitted) return;

    if (!document.hasFocus()) {
      setFocusLostCount(prev => {
        const newCount = prev + 1;
        if (newCount > 2) {
          recordViolation('Excessive Focus Loss', `Window focus lost ${newCount} times`, 'high');
        }
        return newCount;
      });
    }
  }, [testStarted, test, isSubmitting, recordViolation, isSubmitted]);

  // Format time helper function
  const formatTime = useCallback((seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Paper upload timer function
  const startPaperUploadTimer = useCallback((timeLimit) => {
    paperUploadTimerRef.current = setInterval(() => {
      setPaperUploadTimeRemaining(prev => {
        const newTime = prev - 1;
        
        if (newTime <= 0) {
          clearInterval(paperUploadTimerRef.current);
          // Auto-submit when paper upload time expires
          console.log('⏰ Paper upload time expired - Auto-submitting test immediately');
          
          toast.error('⏰ Paper upload time expired! Auto-submitting test...', {
            autoClose: 3000
          });
          
          setShowPaperUploadModal(false);
          setShowPaperUploadTimer(false);
          
          setTimeout(() => {
            handleAutoSubmit('paper_upload_timeout');
          }, 1000);
          return 0;
        }
        
        // Warning at 2 minutes remaining
        if (newTime === 120) {
          toast.warning('⚠️ Only 2 minutes left to upload your answer sheet! Test will auto-submit when time expires.', {
            autoClose: 5000
          });
        }
        
        // Warning at 30 seconds remaining
        if (newTime === 30) {
          toast.error('🚨 30 seconds left! Test will auto-submit very soon!', {
            autoClose: 5000
          });
        }
        
        return newTime;
      });
    }, 1000);
  }, [handleAutoSubmit]);

  const handleMouseLeave = useCallback(() => {
    if (!testStarted || !test || isSubmitting || isBetterViewer || isSubmitted) return;
    recordViolation('Mouse Left Window', 'Mouse pointer left the browser window', 'low');
  }, [testStarted, test, isSubmitting, isBetterViewer, recordViolation, isSubmitted]);

  const handleFullscreenChange = useCallback(() => {
    const isCurrentlyFullscreen = !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );

    setIsFullscreen(isCurrentlyFullscreen);
    setShowFullscreenPrompt(!isCurrentlyFullscreen && testStarted && !isBetterViewer && !isSubmitted);

    if (!isCurrentlyFullscreen && testStarted && !isSubmitting && !isBetterViewer && !isSubmitted) {
      recordViolation('Fullscreen Exit', 'Student exited fullscreen mode', 'high');
      if (!warningShown) {
        toast.warning('⚠️ Please stay in fullscreen mode during the exam');
        setWarningShown(true);
        setTimeout(() => setWarningShown(false), 5000);
      }
    }
  }, [testStarted, isSubmitting, warningShown, isBetterViewer, recordViolation, isSubmitted]);
  
  // Paper upload timer handlers
  const handlePaperUploadComplete = useCallback((success, uploadUrl = null) => {
    setShowPaperUploadTimer(false);
    
    if (success && uploadUrl) {
      setAnswerSheetUrl(uploadUrl);
      
      // Clear paper upload timer
      if (paperUploadTimerRef.current) {
        clearInterval(paperUploadTimerRef.current);
      }
      
      // Auto-submit immediately if test time has expired
      if (autoSubmit) {
        console.log('📄 Paper uploaded successfully - Auto-submitting test immediately');
        
        toast.success('📄 Answer sheet uploaded! Test is being submitted automatically...', {
          autoClose: 3000
        });
        
        // Submit the test with the uploaded paper
        setTimeout(() => {
          handleAutoSubmit(autoSubmitReason || 'paper_uploaded_after_time_expiry');
        }, 1500);
        
        return;
      }
      
      // Regular upload completion for tests with time remaining
      setPaperUploadComplete(success);
      setIsSubmitted(true);
      
      Swal.fire({
        title: 'Upload Complete!',
        text: 'Your answer sheet has been uploaded successfully!',
        icon: 'success',
        confirmButtonColor: '#10b981',
        timer: 3000,
        timerProgressBar: true
      });
    } else {
      // Handle failed upload or skip
      setPaperUploadComplete(false);
      setIsSubmitted(true);
      
      if (autoSubmit) {
        // Auto-submit even if upload failed when time expired
        console.log('📄 Paper upload failed - Auto-submitting test without paper');
        setTimeout(() => {
          handleAutoSubmit('paper_upload_failed_after_time_expiry');
        }, 1000);
        return;
      }
      
      Swal.fire({
        title: 'Test Submitted',
        text: 'Your test has been submitted. Paper upload was not completed.',
        icon: 'info',
        confirmButtonColor: '#3b82f6',
        timer: 3000,
        timerProgressBar: true
      });
    }
    
    // Navigate after delay (only for non-auto-submit cases)
    if (!autoSubmit) {
      setTimeout(() => {
        cleanup();
        navigate('/student');
      }, 3500);
    }
  }, [autoSubmit, autoSubmitReason, handleAutoSubmit, cleanup, navigate, paperUploadTimerRef]);

  const handlePaperUploadSkip = useCallback(() => {
    setShowPaperUploadTimer(false);
    
    // Clear paper upload timer
    if (paperUploadTimerRef.current) {
      clearInterval(paperUploadTimerRef.current);
    }
    
    // Auto-submit immediately if test time has expired
    if (autoSubmit) {
      console.log('📄 Paper upload skipped - Auto-submitting test immediately');
      
      toast.info('📄 Paper upload skipped. Test is being submitted...', {
        autoClose: 3000
      });
      
      setTimeout(() => {
        handleAutoSubmit(autoSubmitReason || 'paper_upload_skipped_after_time_expiry');
      }, 1000);
      
      return;
    }
    
    // Regular skip handling for tests with time remaining
    setIsSubmitted(true);
    
    Swal.fire({
      title: 'Test Submitted',
      text: 'Your test has been submitted without paper upload.',
      icon: 'info',
      confirmButtonColor: '#3b82f6',
      timer: 3000,
      timerProgressBar: true
    });
    
    setTimeout(() => {
      cleanup();
      navigate('/student');
    }, 3500);
  }, [autoSubmit, autoSubmitReason, handleAutoSubmit, cleanup, navigate, paperUploadTimerRef]);




  // Better Viewer functions
  const enterBetterViewer = () => {
    if (isSubmitted) return;
    setIsBetterViewer(true);
    toast.success('📺 Better Viewer Mode Activated. Press ESC or click ✕ to exit.');
  };

  const exitBetterViewer = () => {
    setIsBetterViewer(false);
    document.body.style.overflow = 'auto';
    toast.info('📱 Exited Better Viewer Mode');
  };

  const handlePdfZoom = (direction) => {
    setPdfScale(prev => {
      const newScale = direction === 'in' ? Math.min(prev + 0.25, 3) : Math.max(prev - 0.25, 0.5);
      return newScale;
    });
  };

  // Initialize test
  useEffect(() => {
    if (!mountedRef.current) return;

    fetchTest();

    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [testId]);

  // Check if test was already submitted
  useEffect(() => {
    const checkSubmissionStatus = async () => {
      try {
        const response = await axios.get(`/api/student/submission-status/${testId}`);
        if (response.data.success && response.data.submitted) {
          setIsSubmitted(true);
          submissionLockRef.current = true;
          toast.info('This test has already been submitted.');
          setTimeout(() => navigate('/student'), 3000);
        }
      } catch (error) {
        console.log('No existing submission found - test can proceed');
      }
    };

    if (testId) {
      checkSubmissionStatus();
    }
  }, [testId, navigate]);

  // Setup optimized timer when test starts
  useEffect(() => {
    if (test && !testStarted && !loading && !isSubmitted) {
      const startTestSequence = async () => {
        try {
          // Check if camera access is required
          if (test?.cameraMonitoring?.requireCameraAccess && !cameraPermissionToastShown) {
            toast.info('📷 Camera access is required for this exam. Checking permissions...', {
              autoClose: 3000
            });
            
            try {
              // Test camera access
              const stream = await navigator.mediaDevices.getUserMedia({ video: true });
              stream.getTracks().forEach(track => track.stop()); // Stop the test stream
              toast.success('✅ Camera access granted');
              setCameraPermissionToastShown(true);
            } catch (cameraError) {
              console.error('Camera access denied:', cameraError);
              toast.error('❌ Camera access is required for this exam. Please allow camera permissions and refresh the page.', {
                autoClose: false
              });
              setCameraPermissionToastShown(true);
              setError('Camera access is required for this exam');
              return;
            }
          }
          
          setTestStarted(true);
          setLastFocusTime(Date.now());

          const initializeTimer = async () => {
            try {
              // Check Google Drive connection before starting test
              const isGoogleDriveConnected = await checkGoogleDriveStatus();
              
              if (!isGoogleDriveConnected) {
                const shouldContinue = await showGoogleDriveWarning();
                if (!shouldContinue) {
                  return;
                }
              }

              const token = localStorage.getItem('token');
              const { data } = await axios.post(`/api/student/test/${testId}/start`, {}, {
                headers: { Authorization: `Bearer ${token}` }
              });

              if (data.success) {
            const { remainingSeconds, startTime } = data;

            testEndTimeRef.current = Date.now() + remainingSeconds * 1000;
            testStartTimeRef.current = startTime;

            if (remainingSeconds <= 0) {
              toast.error('⏰ Test time has already expired!');
              handleAutoSubmit('time_limit');
              return;
            }

            // Start the optimized Web Worker timer
            const timerStarted = timer.startTimer({
              duration: remainingSeconds,
              startTime: Date.now(),
              endTime: Date.now() + (remainingSeconds * 1000),
              testId
            });

            if (timerStarted) {
              toast.info(`🚀 Test started! Time remaining: ${formatTime(remainingSeconds)}`);
              
              // Set up timer callbacks
              timer.onTimerFinished(() => {
                if (!submissionLockRef.current && testStarted && !isSubmitted) {
                  console.log('⏰ Timer finished - checking paper upload requirements');
                  
                  // Check if paper upload is required after test completion
                  if (test?.paperSubmissionRequired && !answerSheetUrl) {
                    // Immediately transition to upload phase with 15-minute countdown
                    console.log('📄 Test time ended - transitioning to paper upload phase');
                    setShowPaperUploadModal(true);
                    setShowPaperUploadTimer(true);
                    const uploadTimeLimit = (test?.paperUploadTimeLimit || 15) * 60; // Convert minutes to seconds
                    setPaperUploadTimeRemaining(uploadTimeLimit);
                    
                    // Start paper upload timer
                    startPaperUploadTimer(uploadTimeLimit);
                    
                    // Show notification
                    toast.info(`📄 Test time ended! You have ${test?.paperUploadTimeLimit || 15} minutes to upload your answer sheet. Test will auto-submit when paper is uploaded.`, {
                      autoClose: 8000
                    });
                    
                    // Set auto-submit flag for when paper is uploaded
                    setAutoSubmit(true);
                    setAutoSubmitReason('time_expired_pending_upload');
                  } else {
                    // Auto-submit if no paper upload required
                    console.log('⏰ Timer expired - Auto-submitting test');
                    
                    // Show notification
                    toast.success('⏰ Time expired! Test automatically submitted.', {
                      autoClose: 3000
                    });
                    
                    // Auto-submit the test
                    setTimeout(() => {
                      handleAutoSubmit('time_expired');
                    }, 1000);
                  }
                }
              });

              timer.onTimerUpdate((data) => {
                // Only show warnings if test has actually started and has reasonable time remaining
                if (!testStarted || data.timeRemaining > 3600) return; // Don't show warnings if more than 1 hour remaining
                
                // 5-minute warning with red flash
                if (data.timeRemaining === 300 && !fiveMinuteWarningShown) { // 5 minutes = 300 seconds
                  setFiveMinuteWarningShown(true);
                  setShowCriticalTimeWarning(true);
                  
                  // Red flash effect
                  document.body.style.animation = 'redFlash 0.3s ease-in-out 3';
                  
                  // Define the red flash animation if not already defined
                  if (!document.getElementById('redFlashStyle')) {
                    const style = document.createElement('style');
                    style.id = 'redFlashStyle';
                    style.textContent = `
                      @keyframes redFlash {
                        0% { background-color: transparent; }
                        50% { background-color: rgba(220, 38, 38, 0.2); }
                        100% { background-color: transparent; }
                      }
                      .critical-time-indicator {
                        position: fixed;
                        top: 20px;
                        right: 20px;
                        background: linear-gradient(45deg, #ff4444, #aa0000);
                        color: white;
                        padding: 10px 15px;
                        border-radius: 8px;
                        font-weight: bold;
                        z-index: 9999;
                        animation: pulse 2s infinite;
                        box-shadow: 0 4px 12px rgba(255, 68, 68, 0.3);
                      }
                      @keyframes pulse {
                        0% { transform: scale(1); opacity: 1; }
                        50% { transform: scale(1.05); opacity: 0.8; }
                        100% { transform: scale(1); opacity: 1; }
                      }
                    `;
                    document.head.appendChild(style);
                  }
                  
                  // Remove flash animation after it completes
                  setTimeout(() => {
                    document.body.style.animation = '';
                  }, 1000);
                  
                  // Show warning toast
                  toast.error('⏰ WARNING: Only 5 minutes remaining!', {
                    autoClose: 8000,
                    toastId: 'five-minute-warning'
                  });
                }

                // Show critical time warning for time remaining under 5 minutes
                if (data.timeRemaining <= 300 && data.timeRemaining > 0) {
                  setShowCriticalTimeWarning(true);
                } else {
                  setShowCriticalTimeWarning(false);
                }

                // Periodic save every 30 seconds
                if (data.timeRemaining > 0 && data.timeRemaining % 30 === 0) {
                  localStorage.setItem(`test-remaining-${testId}`, data.timeRemaining.toString());
                  localStorage.setItem(`test-last-save-${testId}`, Date.now().toString());
                }
              });

              timer.onTimerSync((syncData) => {
                if (Math.abs(syncData.drift) > 2) {
                  toast.info('🔄 Timer synchronized with server', { 
                    toastId: 'timer-sync', 
                    autoClose: 2000 
                  });
                }
              });

            } else {
              throw new Error('Failed to start optimized timer');
            }
            
            // Start enhanced monitoring after timer is successfully initialized
            await startEnhancedMonitoring();
            
          } else {
            throw new Error(data.message || 'Failed to start test session.');
          }
        } catch (err) {
          console.error("Failed to start test session:", err);
          toast.error(err.response?.data?.message || "Could not start the test. Redirecting...");
          navigate('/student');
        }
      };

      initializeTimer();
      
      } catch (error) {
        console.error('Error in test start sequence:', error);
        setError(error.message || 'Failed to start test');
      }
    };
    
    startTestSequence();

      // Handle test restoration from localStorage
      const savedStartTime = localStorage.getItem(`test-start-time-${testId}`);
      const savedDuration = localStorage.getItem(`test-duration-${testId}`);
      const savedTestId = localStorage.getItem(`current-test-id`);

      if (savedStartTime && savedDuration && savedTestId === testId) {
        const startTime = parseInt(savedStartTime);
        const duration = parseInt(savedDuration);
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const remaining = Math.max(0, (duration * 60) - elapsed);

        testStartTimeRef.current = startTime;

        if (remaining <= 0) {
          toast.error('⏰ Test time has expired!');
          handleAutoSubmit('time_limit');
          return;
        } else {
          // Restore timer with remaining time
          timer.startTimer({
            duration: remaining,
            startTime: Date.now(),
            endTime: Date.now() + (remaining * 1000),
            testId
          });
          
          // Add the same timer callbacks for restored timer
          timer.onTimerUpdate((data) => {
            // 5-minute warning with red flash
            if (data.timeRemaining === 300 && !fiveMinuteWarningShown) { // 5 minutes = 300 seconds
              setFiveMinuteWarningShown(true);
              
              // Red flash effect
              document.body.style.animation = 'redFlash 0.3s ease-in-out 3';
              
              // Define the red flash animation if not already defined
              if (!document.getElementById('redFlashStyle')) {
                const style = document.createElement('style');
                style.id = 'redFlashStyle';
                style.textContent = `
                  @keyframes redFlash {
                    0% { background-color: transparent; }
                    50% { background-color: rgba(220, 38, 38, 0.2); }
                    100% { background-color: transparent; }
                  }
                `;
                document.head.appendChild(style);
              }
              
              // Remove flash animation after it completes
              setTimeout(() => {
                document.body.style.animation = '';
              }, 1000);
              
              // Show warning toast
              toast.error('⏰ WARNING: Only 5 minutes remaining!', {
                autoClose: 8000,
                toastId: 'five-minute-warning'
              });
            }

            // Periodic save every 30 seconds
            if (data.timeRemaining > 0 && data.timeRemaining % 30 === 0) {
              localStorage.setItem(`test-remaining-${testId}`, data.timeRemaining.toString());
              localStorage.setItem(`test-last-save-${testId}`, Date.now().toString());
            }
          });

          timer.onTimerSync((syncData) => {
            if (Math.abs(syncData.drift) > 2) {
              toast.info('🔄 Timer synchronized with server', { 
                toastId: 'timer-sync', 
                autoClose: 2000 
              });
            }
          });
          
          toast.info(`⏰ Test session restored. Time remaining: ${formatTime(remaining)}`);
        }
      } else {
        // Store initial test session data
        localStorage.setItem(`test-start-time-${testId}`, Date.now().toString());
        localStorage.setItem(`test-duration-${testId}`, test.duration.toString());
        localStorage.setItem(`current-test-id`, testId);
      }

      // Fetch signed PDF URL
      if (test.questionPaperURL) {
        fetchSignedPdfUrl();
      }
      
      // Add initial debug log
      setTimeout(() => {
        addDebugLog('🚀 Test interface loaded, starting proctoring setup...', 'info');
      }, 100);
      
      setupProctoring();

      // Restore violations
      const savedViolations = localStorage.getItem(`test-violations-${testId}`);
      if (savedViolations) {
        try {
          const parsedViolations = JSON.parse(savedViolations);
          setViolations(parsedViolations);

          if (parsedViolations.length >= 3 && !submissionLockRef.current) {
            submissionLockRef.current = true;
            toast.error('Previous session had maximum violations. Auto-submitting...');
            setTimeout(() => handleAutoSubmit('violations'), 2000);
          }
        } catch (e) {
          console.warn('Failed to load saved violations');
        }
      }
    }
  }, [test, testStarted, loading, testId, handleAutoSubmit, isSubmitted, navigate, timer, fiveMinuteWarningShown]);

  // Server timer sync effect - syncs with backend every 2 minutes
  useEffect(() => {
    if (!testStarted || isSubmitting || isSubmitted || !timer.isRunning) {
      return;
    }

    const syncInterval = setInterval(async () => {
      try {
        console.log('� Syncing timer with server...');
        const token = localStorage.getItem('token');
        const { data } = await axios.get(
          `/api/student/test/${testId}/time`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (data.success) {
          const { remainingSeconds, serverTime } = data;
          
          // Sync the Web Worker timer with server time
          timer.syncTimer({ 
            remainingSeconds, 
            serverTime: serverTime || Date.now() 
          });
          
          console.log(`� Timer synced: ${remainingSeconds}s remaining`);
        }
      } catch (err) {
        console.warn('Timer sync failed:', err.response?.data?.message || err.message);
      }
    }, 120000); // Sync every 2 minutes

    return () => clearInterval(syncInterval);
  }, [testStarted, isSubmitting, isSubmitted, testId, timer]);

  // Auto-save answers
  useEffect(() => {
    if (!testStarted || Object.keys(answers).length === 0 || isSubmitted) return;

    if (autoSaveRef.current) {
      clearTimeout(autoSaveRef.current);
    }

    autoSaveRef.current = setTimeout(() => {
      localStorage.setItem(`test-answers-${testId}`, JSON.stringify(answers));
      console.log('💾 Answers auto-saved');
    }, 2000);

    return () => {
      if (autoSaveRef.current) {
        clearTimeout(autoSaveRef.current);
      }
    };
  }, [answers, testStarted, testId, isSubmitted]);

  // Timer cleanup and page unload handling
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (testStarted && !isSubmitting && timer.timeRemaining > 0 && !isSubmitted) {
        // Save current timer state
        localStorage.setItem(`test-remaining-${testId}`, timer.timeRemaining.toString());
        localStorage.setItem(`test-last-save-${testId}`, Date.now().toString());
        
        e.preventDefault();
        e.returnValue = 'Are you sure you want to refresh? Your test session will continue but refreshing may cause issues.';
        return e.returnValue;
      }
    };

    const handleUnload = () => {
      if (testStarted && timer.isRunning) {
        // Stop timer and save state
        timer.stopTimer();
        localStorage.setItem(`test-remaining-${testId}`, timer.timeRemaining.toString());
        localStorage.setItem(`test-last-save-${testId}`, Date.now().toString());
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('unload', handleUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('unload', handleUnload);
    };
  }, [testStarted, isSubmitting, testId, isSubmitted, timer]);

  // Handle escape key for better viewer
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isBetterViewer) {
        exitBetterViewer();
      }
    };

    if (isBetterViewer) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isBetterViewer]);
  
  // Enhanced answer change handler with offline support
  const handleAnswerChange = (questionIndex, value) => {
    if (isSubmitted) return;

    if (isOnline) {
      // Online: Update normally
      setAnswers(prev => ({
        ...prev,
        [questionIndex]: value
      }));
      toast.success('💾 Answer saved', { autoClose: 1000, toastId: 'save-indicator' });
    } else {
      // Offline: Store in offline answers
      setOfflineAnswers(prev => ({
        ...prev,
        [questionIndex]: value
      }));
      
      // Also update local state for immediate UI feedback
      setAnswers(prev => ({
        ...prev,
        [questionIndex]: value
      }));
      
      setPendingSave(true);
      toast.warning('📱 Answer saved offline - will sync when online', { 
        autoClose: 2000, 
        toastId: 'offline-save-indicator' 
      });
    }
  };
  const fetchTest = async () => {
    try {
      setLoading(true);
      console.log('🔍 Fetching test details for:', testId);

      const makeRequest = async () => {
        const response = await axios.get(`/api/student/test/${testId}`);
        return response;
      };

      const response = await queueRequest(makeRequest, {
        description: 'Fetch test details'
      });

      if (response.data.success) {
        setTest(response.data.test);
        
        // Check if this is a resumable test
        if (response.data.canResume && response.data.existingResult) {
          const existingResult = response.data.existingResult;
          
          console.log('🔄 Test can be resumed from existing result:', existingResult);
          
          // If resume parameter is in URL, automatically resume
          if (isResumeSession) {
            console.log('🔄 Auto-resuming test from URL parameter');
            setAnswers(existingResult.answers || {});
            setTimeTaken(existingResult.timeTaken || 0);
            toast.success('✅ Test resumed from where you left off');
            console.log('🔄 Restored answers:', existingResult.answers);
            console.log('🔄 Restored time taken:', existingResult.timeTaken);
          } else {
            // Show resume confirmation
            const shouldResume = await new Promise((resolve) => {
              toast.info(
                <div>
                  <p><strong>Resume Test?</strong></p>
                  <p>You have a test in progress. Would you like to continue?</p>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <button 
                      onClick={() => resolve(true)}
                      style={{ 
                        padding: '4px 8px', 
                        background: '#10b981', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '4px' 
                      }}
                    >
                      ✅ Resume
                    </button>
                    <button 
                      onClick={() => resolve(false)}
                      style={{ 
                        padding: '4px 8px', 
                        background: '#6b7280', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '4px' 
                      }}
                    >
                      🔄 Start Fresh
                    </button>
                  </div>
                </div>,
                {
                  autoClose: false,
                  closeOnClick: false,
                  draggable: false
                }
              );
            });
            
            if (shouldResume) {
              // Restore previous answers and time
              setAnswers(existingResult.answers || {});
              setTimeTaken(existingResult.timeTaken || 0);
              
              toast.success('✅ Test resumed from where you left off');
              console.log('🔄 Restored answers:', existingResult.answers);
              console.log('🔄 Restored time taken:', existingResult.timeTaken);
            } else {
              toast.info('🔄 Starting test fresh as requested');
            }
          }
        }
        
        // Don't set PDF URL directly - we'll fetch the signed URL
        // setPdfUrl(response.data.test.questionPaperURL);
      }
    } catch (error) {
      console.error('❌ Error fetching test:', error);
      setError(error.response?.data?.message || 'Failed to load test');
      
      if (!isOnline) {
        toast.error('Failed to load test - you appear to be offline');
      } else {
        toast.error('Failed to load test. Redirecting to dashboard...');
        setTimeout(() => navigate('/student'), 3000);
      }
    } finally {
      setLoading(false);
    }
  };

  const getFileKeyFromUrl = (url) => {
    try {
      console.log('🔍 Extracting file key from URL:', url);
      
      // If it's a Google Drive URL, extract the file ID
      if (url.includes('drive.google.com') || url.includes('/d/')) {
        const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (match) {
          console.log('📁 Extracted file ID:', match[1]);
          return match[1];
        }
      }
      
      // If it's already a file ID (no slashes, just alphanumeric)
      if (/^[a-zA-Z0-9-_]+$/.test(url) && !url.includes('/')) {
        console.log('📁 Using direct file ID:', url);
        return url;
      }
      
      // Try to extract from other URL patterns
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');
      const fileKey = pathParts.pop();
      console.log('📁 Extracted file key from path:', fileKey);
      return fileKey;
    } catch (error) {
      console.error('❌ Error extracting file key:', error);
      // Return the original URL if extraction fails
      return url;
    }
  };
  const setupProctoring = () => {
    addDebugLog('🔧 Setting up proctoring system...', 'info');
    document.addEventListener('visibilitychange', handleVisibilityChange, true);
    document.addEventListener('contextmenu', handleRightClick, true);
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('fullscreenchange', handleFullscreenChange, true);

    window.addEventListener('blur', handleWindowFocus, true);
    window.addEventListener('focus', () => {
      setLastFocusTime(Date.now());
      addDebugLog('🔍 Window regained focus', 'info');
    }, true);

    document.addEventListener('mouseleave', handleMouseLeave);

    addDebugLog('📹 Starting automatic camera initialization...', 'info');
    // Initialize camera monitoring automatically
    setTimeout(() => {
      initializeCameraMonitoring();
    }, 1000); // Small delay to ensure everything is ready

    console.log('🔒 Enhanced proctoring system activated');

    setTimeout(() => {
      if (!document.fullscreenElement && !isBetterViewer && !isSubmitted) {
        setShowFullscreenPrompt(true);
      }
    }, 2000);
  };

  // Initialize camera monitoring automatically
  const initializeCameraMonitoring = async () => {
    try {
      addDebugLog('� Starting camera initialization...', 'info');
      addDebugLog(`📹 Video element available: ${!!videoRef.current}`, 'info');
      addDebugLog(`📹 MediaDevices available: ${!!navigator.mediaDevices}`, 'info');
      
      setCameraMonitoringEnabled(true);
      
      // Wait a bit to ensure video element is ready
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      addDebugLog('📹 Requesting camera permission...', 'info');
      
      // Check if user has granted camera permission
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: {
          width: { ideal: 320 },
          height: { ideal: 240 },
          facingMode: 'user'
        },
        audio: false 
      });
      
      addDebugLog('✅ Camera stream obtained successfully', 'success');
      addDebugLog(`📹 Stream tracks: ${stream.getTracks().length}`, 'info');
      
      // Store stream reference first
      streamRef.current = stream;
      
      // Video element should always be available now due to our hidden element
      if (!videoRef.current) {
        addDebugLog('❌ Video element not found! This should not happen.', 'error');
        throw new Error('Video element not available');
      }
      
      addDebugLog('📹 Setting video source...', 'info');
      videoRef.current.srcObject = stream;
        
        // Wait for video to be ready with improved timeout handling
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            addDebugLog('⏰ Video load timeout - proceeding anyway', 'warning');
            resolve(); // Resolve instead of reject to continue
          }, 10000); // Increased timeout to 10 seconds
          
          const handleCanPlay = () => {
            clearTimeout(timeout);
            addDebugLog('✅ Video element ready to play', 'success');
            resolve();
          };
          
          const handleLoadedData = () => {
            clearTimeout(timeout);
            addDebugLog('✅ Video data loaded successfully', 'success');
            resolve();
          };
          
          // Check if video is already ready
          if (videoRef.current.readyState >= 2) { // HAVE_CURRENT_DATA or higher
            clearTimeout(timeout);
            addDebugLog('✅ Video already ready', 'success');
            resolve();
          } else {
            // Listen for multiple events to catch video readiness
            videoRef.current.addEventListener('canplay', handleCanPlay, { once: true });
            videoRef.current.addEventListener('loadeddata', handleLoadedData, { once: true });
            
            // Force load attempt
            videoRef.current.load();
          }
        });
        
        setIsCameraActive(true);
        setShowVideoPreview(true);
        setCameraMonitoringEnabled(true); // Always enable monitoring
        
        // Enhanced camera active notification with single toast
        if (!cameraActiveToastShown) {
          toast.success('✅ Camera activated for monitoring', {
            autoClose: 3000
          });
          setCameraActiveToastShown(true);
        }
        
        addDebugLog('✅ Camera monitoring fully initialized', 'success');
        
        // Start monitoring after camera is ready with improved delay
        setTimeout(() => {
          if (isCameraActive) { // Double-check camera is still active
            addDebugLog('🔍 Starting image capture monitoring...', 'info');
            startMonitoring();
          }
        }, 1000); // Reduced delay for faster startup
        
    } catch (error) {
      addDebugLog(`❌ Camera initialization failed: ${error.message}`, 'error');
      
      setCameraMonitoringEnabled(false);
      setShowVideoPreview(false);
      
      // If it's a permission error, show a helpful message
      if (error.name === 'NotAllowedError') {
        addDebugLog('❌ Camera permission denied by user', 'error');
      } else if (error.name === 'NotFoundError') {
        addDebugLog('❌ No camera device found', 'error');
      } else if (error.name === 'NotReadableError') {
        addDebugLog('❌ Camera already in use by another application', 'error');
      }
    }
  };

  const requestFullscreen = () => {
    if (isSubmitted) return;

    const elem = document.documentElement;

    try {
      let promise;

      if (elem.requestFullscreen) {
        promise = elem.requestFullscreen();
      } else if (elem.webkitRequestFullscreen) {
        promise = elem.webkitRequestFullscreen();
      } else if (elem.mozRequestFullScreen) {
        promise = elem.mozRequestFullScreen();
      } else if (elem.msRequestFullscreen) {
        promise = elem.msRequestFullscreen();
      }

      if (promise && promise.then) {
        promise.then(() => {
          console.log('✅ Fullscreen activated successfully');
          setIsFullscreen(true);
          setShowFullscreenPrompt(false);
          toast.success('✅ Fullscreen mode activated');
        }).catch(err => {
          console.warn('⚠️ Fullscreen request failed:', err);
          setIsFullscreen(false);
          if (err.name !== 'TypeError') {
            toast.warning('⚠️ Fullscreen not available. Please press F11 manually.');
          }
        });
      }
    } catch (error) {
      console.warn('Fullscreen not supported:', error);
      toast.info('💡 Press F11 to enter fullscreen mode manually');
    }
  };

  const exitFullscreen = () => {
    try {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    } catch (error) {
      console.warn('Exit fullscreen failed:', error);
    }
  };

  const handleFileSelect = (e) => {
    if (isSubmitted) return;

    const file = e.target.files[0];
    if (!file) return;

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only PDF, JPG, and PNG files are allowed');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setAnswerFile(file);
    if (file.type.startsWith('image/')) {
      toast.success(`� Image selected: ${file.name} (will be converted to PDF)`, { autoClose: 4000 });
    } else {
      toast.success(`�📎 File selected: ${file.name}`);
    }
  };



  // inside TestInterface.js
  // In TestInterface.js
  const refreshPdfUrl = async () => {
    if (!test?.questionPaperURL) return;
    setPdfLoading(true);
    try {
      // Extract file key from the URL
      const fileKey = getFileKeyFromUrl(test.questionPaperURL);
      console.log('📁 Refreshing with file key:', fileKey);
      
      if (!fileKey) {
        throw new Error('Could not extract file key from URL');
      }
      
      const signedUrl = await fetchFileUrl('questionpaper', fileKey);
      setPdfUrl(signedUrl);
      toast.success('✅ Question paper refreshed');
    } catch (error) {
      console.error('❌ Failed to refresh question paper:', error);
      toast.error('❌ Failed to refresh question paper');
    } finally {
      setPdfLoading(false);
    }
  };

  // Function to fetch signed PDF URL on initial load
  const fetchSignedPdfUrl = async () => {
    if (!test?.questionPaperURL) return;
    setPdfLoading(true);
    try {
      console.log('🔍 Fetching signed PDF URL for:', test.questionPaperURL);
      
      // Extract file key from the URL
      const fileKey = getFileKeyFromUrl(test.questionPaperURL);
      console.log('📁 Using file key:', fileKey);
      
      if (!fileKey) {
        throw new Error('Could not extract file key from URL');
      }
      
      const signedUrl = await fetchFileUrl('questionpaper', fileKey);
      setPdfUrl(signedUrl);
      console.log('✅ Signed PDF URL obtained:', signedUrl);
    } catch (error) {
      console.error('❌ Failed to fetch signed PDF URL:', error);
      toast.error('Failed to load question paper. Please refresh.');
      
      // Fallback: try using the original URL directly
      console.log('🔄 Trying fallback with original URL...');
      try {
        setPdfUrl(test.questionPaperURL);
        console.log('⚠️ Using original URL as fallback');
      } catch (fallbackError) {
        console.error('❌ Fallback also failed:', fallbackError);
      }
    } finally {
      setPdfLoading(false);
    }
  };





  // Enhanced file upload with image to PDF conversion
  const handleFileUpload = useCallback(async (file) => {
    let uploadFile = file;

    // Convert images to PDF if necessary
    if (file.type.startsWith('image/')) {
      try {
        toast.info('🔄 Converting image to PDF...', { autoClose: 3000, toastId: 'image-convert' });
        uploadFile = await convertImageToPdf(file);
        toast.success('✅ Image converted to PDF successfully!', { autoClose: 2000 });
      } catch (error) {
        console.error('Image to PDF conversion failed:', error);
        toast.error('❌ Failed to convert image to PDF. Please try uploading a PDF directly.');
        throw new Error('Image conversion failed');
      }
    }

    const makeUploadRequest = async () => {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('answerSheet', uploadFile);

      const response = await axios.post(
        `/api/student/test/${testId}/upload`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            Authorization: `Bearer ${token}`
          },
          onUploadProgress: e => {
            const pct = Math.round((e.loaded / e.total) * 100);
            setUploadProgress(pct);
          }
        }
      );

      if (!response.data.success) {
        throw new Error(response.data.message || 'Upload failed');
      }

      // Handle multiple response formats from backend
      const uploadUrl = response.data.answerSheetUrl || 
                       response.data.url || 
                       response.data.webViewLink || 
                       response.data.viewUrl;

      if (!uploadUrl) {
        console.error('No URL in response:', response.data);
        throw new Error('Upload succeeded but no URL returned');
      }

      return uploadUrl;
    };

    return await queueRequest(makeUploadRequest, {
      description: 'Upload answer sheet'
    });
  }, [testId, queueRequest]);

  // Camera and monitoring functions
  const startCamera = useCallback(async () => {
    // Prevent starting camera if already active or currently initializing
    if (isCameraActive || cameraInitializingRef.current) {
      console.log('📹 Camera already active or initializing, skipping start');
      return;
    }
    
    cameraInitializingRef.current = true;
    
    try {
      const constraints = getOptimalCameraConstraints();
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Wait for video to load before playing
        videoRef.current.onloadedmetadata = () => {
          const playPromise = videoRef.current.play();
          if (playPromise !== undefined) {
            playPromise.catch(error => {
              console.warn('Video play interrupted:', error);
            });
          }
        };
        
        setIsCameraActive(true);
        cameraRef.current = stream;
        streamRef.current = stream; // Store stream reference for preview
        setShowVideoPreview(true); // Show preview automatically when camera starts
        console.log(`📹 Camera started - Device: ${isMobileDevice() ? 'Mobile' : 'Desktop'}`);
        
        // Only show toast once per session
        if (!cameraActiveToastShown) {
          toast.success(`📹 Camera monitoring active`, {
            autoClose: 2000
          });
          setCameraActiveToastShown(true);
        }
        
        // Reset initializing flag
        cameraInitializingRef.current = false;
      }
    } catch (error) {
      console.error('❌ Camera access failed:', error);
      setIsCameraActive(false);
      
      // Only show camera error toasts once per session
      if (!cameraErrorToastShown) {
        if (error.name === 'NotAllowedError') {
          toast.error('📹 Camera access denied. Please allow camera permissions for exam monitoring.', {
            autoClose: 5000
          });
        } else if (error.name === 'NotFoundError') {
          toast.error('📹 No camera found. Please connect a camera for exam monitoring.', {
            autoClose: 5000
          });
        } else {
          toast.error('📹 Camera setup failed. Monitoring may not work properly.', {
            autoClose: 5000
          });
        }
        setCameraErrorToastShown(true);
      }
      
      // Reset initializing flag
      cameraInitializingRef.current = false;
    }
  }, [getOptimalCameraConstraints, isMobileDevice, cameraActiveToastShown, cameraErrorToastShown, isCameraActive]);

  const stopMonitoring = useCallback(() => {
    if (monitoringIntervalRef.current) {
      clearInterval(monitoringIntervalRef.current);
      monitoringIntervalRef.current = null;
    }
    setMonitoringActive(false);
  }, []);

  const stopCamera = useCallback(() => {
    addDebugLog('🛑 Stopping camera...', 'info');
    
    // Stop all media tracks first
    if (cameraRef.current) {
      try {
        cameraRef.current.getTracks().forEach(track => {
          track.stop();
          addDebugLog(`📴 Stopped ${track.kind} track`, 'info');
        });
        cameraRef.current = null;
      } catch (error) {
        addDebugLog(`❌ Error stopping camera tracks: ${error.message}`, 'error');
      }
    }
    
    // Properly clean up video element
    if (videoRef.current) {
      try {
        // Pause video first to stop any pending play() operations
        videoRef.current.pause();
        
        // Remove the source object
        videoRef.current.srcObject = null;
        
        // Reset video element
        videoRef.current.currentTime = 0;
        
        addDebugLog('📺 Video element cleaned up', 'info');
      } catch (error) {
        addDebugLog(`❌ Error cleaning up video: ${error.message}`, 'error');
      }
    }
    
    // Don't deactivate camera during test - only minimize
    // setIsCameraActive(false); 
    setShowCameraModal(false);
    // setShowVideoPreview(false); // Keep preview visible
    // stopMonitoring(); // Don't stop monitoring during test
    
    // Reset initializing flag
    cameraInitializingRef.current = false;
    
    addDebugLog('✅ Camera stopped successfully', 'success');
  }, [stopMonitoring]);

  const captureImage = useCallback((purpose = 'answer') => {
    if (!videoRef.current || !canvasRef.current) {
      console.log('❌ Cannot capture image - video or canvas not available');
      return null;
    }

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const context = canvas.getContext('2d');

    // Check if video is loaded
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.log('❌ Cannot capture image - video not loaded');
      return null;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);

    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    const timestamp = new Date().toISOString();
    
    const capturedImage = {
      id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      data: imageData,
      timestamp,
      purpose, // 'answer' or 'monitoring'
      testId,
      studentId: user?._id,
      page: purpose === 'answer' ? capturedImages.length + 1 : null
    };

    if (purpose === 'answer') {
      setCapturedImages(prev => [...prev, capturedImage]);
      toast.success(`📸 Page ${capturedImages.length + 1} captured!`);
    } else if (purpose === 'monitoring') {
      console.log('📸 Monitoring image captured, adding to queue');
      setMonitoringImages(prev => [...prev, capturedImage]);
      // Don't call uploadMonitoringImage here to avoid recursion
    }

    return capturedImage;
  }, [capturedImages.length, testId, user?._id]);

  const removeImage = useCallback((imageId) => {
    setCapturedImages(prev => {
      const updated = prev.filter(img => img.id !== imageId);
      // Renumber pages
      return updated.map((img, index) => ({ ...img, page: index + 1 }));
    });
    toast.info('📸 Image removed');
  }, []);

  const uploadMonitoringImage = useCallback(async (imageData) => {
    try {
      const blob = await fetch(imageData.data).then(r => r.blob());
      const formData = new FormData();
      formData.append('monitoringImage', blob, `monitoring_${Date.now()}.jpg`);
      formData.append('timestamp', Date.now().toString()); // Use timestamp as string
      formData.append('testId', testId);
      formData.append('purpose', 'monitoring');
      formData.append('saveToGoogleDrive', 'true'); // Always save to Google Drive

      const token = localStorage.getItem('token');
      const response = await axios.post('/api/student/monitoring/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${token}`
        }
      });
      
      console.log('📸 Monitoring image uploaded successfully:', response.data);
      
      // Return the drive URL for local storage
      return response.data.fileUrl;
    } catch (error) {
      console.error('Failed to upload monitoring image:', error);
      throw error;
    }
  }, [testId]);

  // ML-based suspicious activity detection
  const detectSuspiciousActivity = useCallback(async (imageData) => {
    try {
      // Convert base64 to blob
      const response = await fetch(imageData);
      const blob = await response.blob();
      
      // Create ImageData for ML analysis
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      return new Promise((resolve) => {
        img.onload = async () => {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          
          const imageDataObj = ctx.getImageData(0, 0, canvas.width, canvas.height);
          
          // Perform ML-based detection
          const detectionResults = await performMLDetection(imageDataObj);
          
          if (detectionResults.suspicious) {
            // Flag suspicious activity
            setSuspiciousActivities(prev => [...prev, {
              timestamp: new Date().toISOString(),
              type: detectionResults.type,
              confidence: detectionResults.confidence,
              description: detectionResults.description,
              imageData: imageData, // Store for review
              severity: detectionResults.confidence > 0.8 ? 'high' : 'medium'
            }]);
            
            // Record violation
            recordViolation(
              detectionResults.type, 
              detectionResults.description, 
              detectionResults.confidence > 0.8 ? 'high' : 'medium'
            );
            
            // Send alert to admin
            try {
              await fetch('/api/monitoring/alert', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                  testId,
                  studentId: user?.email,
                  alertType: detectionResults.type,
                  confidence: detectionResults.confidence,
                  timestamp: new Date().toISOString(),
                  description: detectionResults.description
                })
              });
            } catch (error) {
              console.error('Failed to send admin alert:', error);
            }
            
            toast.warning(`⚠️ ${detectionResults.description}`, { autoClose: 3000 });
          }
          
          resolve(detectionResults);
        };
        
        img.onerror = () => {
          console.error('Failed to load image for ML detection');
          resolve({ suspicious: false, error: 'Image load failed' });
        };
        
        img.src = URL.createObjectURL(blob);
      });
    } catch (error) {
      console.error('ML detection failed:', error);
      return { suspicious: false, error: error.message };
    }
  }, [testId, user, recordViolation]);

  // ML Detection Algorithm
  const performMLDetection = useCallback(async (imageData) => {
    const { data, width, height } = imageData;
    
    try {
      // 1. Face Detection - Check for multiple faces
      const faceDetectionResult = await detectMultipleFaces(data, width, height);
      
      // 2. Eye Movement Detection - Check for unusual eye patterns
      const eyeMovementResult = await detectUnusualEyeMovement(data, width, height);
      
      // 3. Head Position Detection - Check for extreme head movements
      const headPositionResult = await detectHeadPosition(data, width, height);
      
      // 4. Object Detection - Check for prohibited items
      const objectDetectionResult = await detectProhibitedObjects(data, width, height);
      
      // 5. Lighting Analysis - Check for screen reflection patterns
      const lightingResult = await analyzeLightingPatterns(data, width, height);
      
      // Combine all detection results
      const results = [
        faceDetectionResult,
        eyeMovementResult,
        headPositionResult,
        objectDetectionResult,
        lightingResult
      ];
      
      // Find the highest confidence suspicious activity
      const suspiciousResults = results.filter(r => r.suspicious);
      
      if (suspiciousResults.length > 0) {
        const highestConfidence = suspiciousResults.reduce((max, current) => 
          current.confidence > max.confidence ? current : max
        );
        
        return {
          suspicious: true,
          type: highestConfidence.type,
          confidence: highestConfidence.confidence,
          description: highestConfidence.description,
          allDetections: suspiciousResults
        };
      }
      
      return { suspicious: false };
    } catch (error) {
      console.error('ML detection algorithm failed:', error);
      return { suspicious: false, error: error.message };
    }
  }, []);

  // Face Detection using image processing
  const detectMultipleFaces = useCallback(async (data, width, height) => {
    // Simple face detection using skin color detection and blob analysis
    let faceRegions = [];
    const skinColorThreshold = { r: [95, 255], g: [40, 255], b: [20, 255] };
    
    // Convert to skin mask
    const skinMask = new Uint8Array(width * height);
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Check if pixel matches skin color
      if (r >= skinColorThreshold.r[0] && r <= skinColorThreshold.r[1] &&
          g >= skinColorThreshold.g[0] && g <= skinColorThreshold.g[1] &&
          b >= skinColorThreshold.b[0] && b <= skinColorThreshold.b[1]) {
        skinMask[Math.floor(i / 4)] = 255;
      }
    }
    
    // Simple blob detection for face regions
    const minFaceSize = Math.min(width, height) * 0.05; // 5% of image
    const maxFaceSize = Math.min(width, height) * 0.4;  // 40% of image
    
    // Count connected components (simplified)
    let faceCount = 0;
    const visited = new Array(width * height).fill(false);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (skinMask[idx] && !visited[idx]) {
          const blobSize = floodFill(skinMask, visited, x, y, width, height);
          if (blobSize >= minFaceSize && blobSize <= maxFaceSize) {
            faceCount++;
          }
        }
      }
    }
    
    return {
      suspicious: faceCount > 1 || faceCount === 0,
      confidence: faceCount > 1 ? 0.8 : (faceCount === 0 ? 0.7 : 0),
      type: faceCount > 1 ? 'multiple_faces' : 'no_face_detected',
      description: faceCount > 1 ? 'Multiple people detected' : (faceCount === 0 ? 'No face detected' : 'Normal'),
      faceCount
    };
  }, []);

  // Flood fill helper for blob detection
  const floodFill = (mask, visited, startX, startY, width, height) => {
    const stack = [[startX, startY]];
    let size = 0;
    
    while (stack.length > 0) {
      const [x, y] = stack.pop();
      const idx = y * width + x;
      
      if (x < 0 || x >= width || y < 0 || y >= height || visited[idx] || !mask[idx]) {
        continue;
      }
      
      visited[idx] = true;
      size++;
      
      // Add neighbors
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    
    return size;
  };

  // Eye movement detection using optical flow
  const detectUnusualEyeMovement = useCallback(async (data, width, height) => {
    // Store previous frame for comparison
    if (!eyeTrackingRef.current.previousFrame) {
      eyeTrackingRef.current.previousFrame = new Uint8Array(data);
      return { suspicious: false, confidence: 0, type: 'eye_movement', description: 'Initializing eye tracking' };
    }
    
    // Calculate optical flow in eye regions (upper 1/3 of image)
    const eyeRegionHeight = Math.floor(height / 3);
    let totalMovement = 0;
    let movementCount = 0;
    
    for (let y = 0; y < eyeRegionHeight; y++) {
      for (let x = 0; x < width; x += 4) { // Sample every 4th pixel for performance
        const idx = (y * width + x) * 4;
        
        const currentGray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
        const previousGray = (eyeTrackingRef.current.previousFrame[idx] + 
                             eyeTrackingRef.current.previousFrame[idx + 1] + 
                             eyeTrackingRef.current.previousFrame[idx + 2]) / 3;
        
        const movement = Math.abs(currentGray - previousGray);
        totalMovement += movement;
        movementCount++;
      }
    }
    
    const averageMovement = totalMovement / movementCount;
    eyeTrackingRef.current.previousFrame = new Uint8Array(data);
    
    // Store movement history
    eyeTrackingRef.current.movementHistory.push(averageMovement);
    if (eyeTrackingRef.current.movementHistory.length > 10) {
      eyeTrackingRef.current.movementHistory.shift();
    }
    
    // Calculate movement variance
    const mean = eyeTrackingRef.current.movementHistory.reduce((a, b) => a + b, 0) / eyeTrackingRef.current.movementHistory.length;
    const variance = eyeTrackingRef.current.movementHistory.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / eyeTrackingRef.current.movementHistory.length;
    
    const isUnusualMovement = variance > 50 || averageMovement > 30;
    
    return {
      suspicious: isUnusualMovement,
      confidence: isUnusualMovement ? Math.min(variance / 100, 0.9) : 0,
      type: 'unusual_eye_movement',
      description: isUnusualMovement ? 'Unusual eye movement detected' : 'Normal eye movement',
      movement: averageMovement,
      variance
    };
  }, []);

  // Head position detection
  const detectHeadPosition = useCallback(async (data, width, height) => {
    // Analyze the distribution of skin-colored pixels to determine head position
    const centerX = width / 2;
    const centerY = height / 2;
    const regionSize = Math.min(width, height) * 0.3;
    
    let leftSkinPixels = 0, rightSkinPixels = 0;
    let topSkinPixels = 0, bottomSkinPixels = 0;
    
    for (let y = centerY - regionSize; y < centerY + regionSize; y++) {
      for (let x = centerX - regionSize; x < centerX + regionSize; x++) {
        if (x >= 0 && x < width && y >= 0 && y < height) {
          const idx = (y * width + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          
          // Simple skin detection
          if (r > 95 && g > 40 && b > 20 && r > g && r > b) {
            if (x < centerX) leftSkinPixels++;
            else rightSkinPixels++;
            
            if (y < centerY) topSkinPixels++;
            else bottomSkinPixels++;
          }
        }
      }
    }
    
    const horizontalRatio = leftSkinPixels / (rightSkinPixels + 1);
    const verticalRatio = topSkinPixels / (bottomSkinPixels + 1);
    
    const isLookingAway = horizontalRatio > 2 || horizontalRatio < 0.5 || 
                         verticalRatio > 2 || verticalRatio < 0.5;
    
    return {
      suspicious: isLookingAway,
      confidence: isLookingAway ? 0.7 : 0,
      type: 'head_position',
      description: isLookingAway ? 'Student looking away from camera' : 'Normal head position',
      horizontalRatio,
      verticalRatio
    };
  }, []);

  // Object detection for prohibited items
  const detectProhibitedObjects = useCallback(async (data, width, height) => {
    // Simple edge detection to find rectangular objects (phones, books, etc.)
    const edges = new Uint8Array(width * height);
    
    // Sobel edge detection
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        
        // Get surrounding pixels (grayscale)
        const tl = (data[(idx - width - 1) * 4] + data[(idx - width - 1) * 4 + 1] + data[(idx - width - 1) * 4 + 2]) / 3;
        const tm = (data[(idx - width) * 4] + data[(idx - width) * 4 + 1] + data[(idx - width) * 4 + 2]) / 3;
        const tr = (data[(idx - width + 1) * 4] + data[(idx - width + 1) * 4 + 1] + data[(idx - width + 1) * 4 + 2]) / 3;
        const ml = (data[(idx - 1) * 4] + data[(idx - 1) * 4 + 1] + data[(idx - 1) * 4 + 2]) / 3;
        const mr = (data[(idx + 1) * 4] + data[(idx + 1) * 4 + 1] + data[(idx + 1) * 4 + 2]) / 3;
        const bl = (data[(idx + width - 1) * 4] + data[(idx + width - 1) * 4 + 1] + data[(idx + width - 1) * 4 + 2]) / 3;
        const bm = (data[(idx + width) * 4] + data[(idx + width) * 4 + 1] + data[(idx + width) * 4 + 2]) / 3;
        const br = (data[(idx + width + 1) * 4] + data[(idx + width + 1) * 4 + 1] + data[(idx + width + 1) * 4 + 2]) / 3;
        
        const gx = (tr + 2 * mr + br) - (tl + 2 * ml + bl);
        const gy = (bl + 2 * bm + br) - (tl + 2 * tm + tr);
        const magnitude = Math.sqrt(gx * gx + gy * gy);
        
        edges[idx] = magnitude > 50 ? 255 : 0;
      }
    }
    
    // Count strong edges (potential objects)
    let edgeCount = 0;
    for (let i = 0; i < edges.length; i++) {
      if (edges[i]) edgeCount++;
    }
    
    const edgeRatio = edgeCount / (width * height);
    const suspiciousObjects = edgeRatio > 0.1; // More than 10% edges might indicate objects
    
    return {
      suspicious: suspiciousObjects,
      confidence: suspiciousObjects ? Math.min(edgeRatio * 5, 0.8) : 0,
      type: 'prohibited_objects',
      description: suspiciousObjects ? 'Potential prohibited objects detected' : 'No prohibited objects detected',
      edgeRatio
    };
  }, []);

  // Lighting pattern analysis
  const analyzeLightingPatterns = useCallback(async (data, width, height) => {
    // Analyze lighting patterns that might indicate screen reflection
    let brightRegions = 0;
    let totalBrightness = 0;
    
    for (let i = 0; i < data.length; i += 4) {
      const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
      totalBrightness += brightness;
      
      if (brightness > 200) { // Very bright pixels
        brightRegions++;
      }
    }
    
    const averageBrightness = totalBrightness / (data.length / 4);
    const brightRatio = brightRegions / (data.length / 4);
    
    // Suspicious if too many bright regions (screen reflection) or too dark (hiding)
    const suspiciousLighting = brightRatio > 0.3 || averageBrightness < 50;
    
    return {
      suspicious: suspiciousLighting,
      confidence: suspiciousLighting ? 0.6 : 0,
      type: 'lighting_anomaly',
      description: suspiciousLighting ? 
        (brightRatio > 0.3 ? 'Excessive screen reflection detected' : 'Poor lighting detected') : 
        'Normal lighting conditions',
      brightness: averageBrightness,
      brightRatio
    };
  }, []);

  // Monitoring system - runs continuously during test
  const startMonitoring = useCallback(() => {
    if (monitoringActive || !isCameraActive) {
      console.log('📸 Monitoring conditions not met:', { monitoringActive, isCameraActive });
      return;
    }
    
    setMonitoringActive(true);
    lastCaptureTimeRef.current = Date.now(); // Initialize capture time
    
    // Only show toast once per session
    if (!monitoringStartedToastShown) {
      toast.info('🔍 Camera monitoring active - Images captured automatically', { autoClose: 3000 });
      setMonitoringStartedToastShown(true);
    }
    
    console.log('📸 Starting monitoring system');
    
    const captureRandomly = async () => {
      if (!monitoringActive || !testStarted || isSubmitted) {
        console.log('📸 Stopping monitoring due to conditions:', { monitoringActive, testStarted, isSubmitted });
        return;
      }
      
      const now = Date.now();
      const timeSinceLastCapture = now - lastCaptureTimeRef.current;
      
      // Capture every 30-90 seconds (randomized)
      const captureInterval = 30000 + Math.random() * 60000; // 30 seconds to 1.5 minutes
      
      if (timeSinceLastCapture >= captureInterval) {
        console.log('📸 Taking monitoring photo...');
        
        try {
          // Direct camera capture without using captureImage to avoid recursion
          const video = videoRef.current;
          if (!video || video.readyState !== 4) {
            console.log('📸 Video not ready for monitoring capture');
            return;
          }

          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 480;
          
          context.drawImage(video, 0, 0);
          const imageData = canvas.toDataURL('image/jpeg', 0.8);
          
          console.log('📸 Monitoring image captured, uploading to Google Drive...');
          
          console.log('📸 Monitoring image captured, uploading to Google Drive...');
          
          // Upload to Google Drive via backend with proper error handling
          const blob = await fetch(imageData).then(r => r.blob());
          const formData = new FormData();
          formData.append('monitoringImage', blob, `monitoring_${Date.now()}.jpg`);
          formData.append('timestamp', Date.now().toString());
          formData.append('testId', testId);
          formData.append('purpose', 'monitoring');
          formData.append('saveToGoogleDrive', 'true');

          const token = localStorage.getItem('token');
          const response = await axios.post('/api/student/monitoring/upload', formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
              Authorization: `Bearer ${token}`
            }
          });
          
          console.log('📸 Monitoring image uploaded successfully:', response.data);
          lastCaptureTimeRef.current = now;
        } catch (error) {
          console.error('❌ Failed to capture monitoring image:', error);
        }
      }
      
      // Schedule next capture check
      if (monitoringActive && !isSubmitted) {
        setTimeout(captureRandomly, 10000); // Check every 10 seconds
      }
    };
    
    // Start the monitoring loop
    setTimeout(captureRandomly, 5000); // Start after 5 seconds
  }, [monitoringActive, isCameraActive, testStarted, isSubmitted, captureImage, monitoringStartedToastShown]);

  // Upload monitoring image to Google Drive
  const uploadMonitoringImageToDrive = useCallback(async (imageData) => {
    try {
      console.log('📤 Attempting to upload monitoring image...');
      
      // Convert base64 to blob
      const response = await fetch(imageData);
      const blob = await response.blob();
      
      // Create file with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `monitoring-${user?.email || 'student'}-${testId}-${timestamp}.jpg`;
      const file = new File([blob], filename, { type: 'image/jpeg' });
      
      console.log('📁 Created file:', filename, 'Size:', file.size);
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'monitoring');
      formData.append('testId', testId);
      formData.append('studentId', user?.email || user?.id || 'anonymous');
      formData.append('timestamp', timestamp);
      
      console.log('📋 FormData prepared, sending to API...');
      
      const uploadResponse = await fetch('/api/upload/monitoring-image', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });
      
      console.log('📡 Upload response status:', uploadResponse.status);
      
      const result = await uploadResponse.json();
      console.log('📋 Upload result:', result);
      
      if (result.success) {
        console.log('✅ Monitoring image uploaded to Drive:', result.fileUrl || result.webViewLink);
        return result.fileUrl || result.webViewLink;
      } else {
        throw new Error(result.message || 'Upload failed');
      }
    } catch (error) {
      console.error('❌ Failed to upload monitoring image:', error);
      throw error;
    }
  }, [testId, user]);

  // Convert multiple images to PDF
  const convertImagesToPdf = useCallback(async (images) => {
    if (images.length === 0) {
      throw new Error('No images to convert');
    }

    try {
      toast.info('🔄 Converting images to PDF...', { autoClose: 3000, toastId: 'images-convert' });
      
      // Dynamic import for jsPDF
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const pdfWidth = 210; // A4 width in mm
      const pdfHeight = 297; // A4 height in mm
      
      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        
        if (i > 0) {
          pdf.addPage();
        }
        
        // Create image element to get dimensions
        const img = await new Promise((resolve, reject) => {
          const imgElement = new Image();
          imgElement.onload = () => resolve(imgElement);
          imgElement.onerror = reject;
          imgElement.src = image.data;
        });
        
        // Calculate scale to fit image in A4 while maintaining aspect ratio
        const scaleX = pdfWidth / (img.width * 0.264583); // Convert pixels to mm
        const scaleY = pdfHeight / (img.height * 0.264583);
        const scale = Math.min(scaleX, scaleY);
        
        const scaledWidth = img.width * 0.264583 * scale;
        const scaledHeight = img.height * 0.264583 * scale;
        
        // Center the image on the page
        const xOffset = (pdfWidth - scaledWidth) / 2;
        const yOffset = (pdfHeight - scaledHeight) / 2;
        
        // Add page number
        pdf.setFontSize(10);
        pdf.text(`Page ${image.page}`, 10, 10);
        
        // Add image to PDF
        pdf.addImage(image.data, 'JPEG', xOffset, yOffset, scaledWidth, scaledHeight);
      }
      
      // Convert PDF to blob
      const pdfBlob = pdf.output('blob');
      
      // Create a new File object with the PDF blob
      const pdfFile = new File([pdfBlob], `answer_sheet_${Date.now()}.pdf`, {
        type: 'application/pdf',
        lastModified: Date.now()
      });
      
      toast.success('✅ Images converted to PDF successfully!', { autoClose: 2000 });
      return pdfFile;
    } catch (error) {
      console.error('Images to PDF conversion failed:', error);
      toast.error('❌ Failed to convert images to PDF');
      throw error;
    }
  }, []);

  // Enhanced file upload with camera images support
  const handleCameraUpload = useCallback(async () => {
    if (capturedImages.length === 0) {
      toast.error('No images captured. Please capture at least one image.');
      return;
    }

    try {
      setIsUploading(true);
      const pdfFile = await convertImagesToPdf(capturedImages);
      const url = await handleFileUpload(pdfFile);
      setAnswerSheetUrl(url);
      toast.success('📎 Answer sheet uploaded successfully!');
      setShowCameraModal(false);
    } catch (error) {
      console.error('Camera upload failed:', error);
      toast.error('❌ Failed to upload answer sheet');
    } finally {
      setIsUploading(false);
    }
  }, [capturedImages, convertImagesToPdf, handleFileUpload]);

  // Image compression utility
  const compressImage = useCallback(async (file) => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        try {
          // Calculate compressed dimensions (max 1920x1080)
          let { width, height } = img;
          const maxWidth = 1920;
          const maxHeight = 1080;
          
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width *= ratio;
            height *= ratio;
          }
          
          canvas.width = width;
          canvas.height = height;
          
          // Draw and compress
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to compress image'));
            }
          }, 'image/jpeg', 0.8);
        } catch (error) {
          reject(new Error(`Image compression failed: ${error.message}`));
        }
      };
      
      img.onerror = () => {
        reject(new Error(`Failed to load image: ${file.name}`));
      };
      
      img.src = URL.createObjectURL(file);
    });
  }, []);

  // Extract page number from filename
  const extractPageNumber = useCallback((filename) => {
    const matches = filename.match(/(\d+)/);
    return matches ? parseInt(matches[1]) : null;
  }, []);

  // Reorder pages (drag and drop)
  const reorderPages = useCallback((startIndex, endIndex) => {
    setUploadedPages(prev => {
      const result = Array.from(prev);
      const [removed] = result.splice(startIndex, 1);
      result.splice(endIndex, 0, removed);
      
      // Update page numbers
      return result.map((page, index) => ({
        ...page,
        pageNumber: index + 1
      }));
    });
  }, []);

  // Handle image file upload from input - optimized for device file selection
  const handleImageFileUpload = useCallback(async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    setIsUploadingFiles(true); // Disable violation recording during file upload
    setIsUploading(true);
    const uploadStartTime = Date.now();
    toast.info(`📤 Processing ${files.length} file(s)...`);

    const processedPages = [];
    
    for (const [index, file] of files.entries()) {
      try {
        const fileStartTime = Date.now();
        
        // Validate file type - only allow JPG/JPEG
        if (!file.type.includes('jpeg') && !file.type.includes('jpg')) {
          toast.error(`❌ File ${file.name} must be in JPG/JPEG format only`);
          continue;
        }

        // Validate file size (max 10MB per image)
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`❌ File ${file.name} is too large (max 10MB)`);
          continue;
        }

        // Convert file to base64 with compression
        const compressedImage = await compressImage(file);
        if (!compressedImage) {
          toast.error(`❌ Failed to compress ${file.name}`);
          continue;
        }
        
        const reader = new FileReader();
        const imageData = await new Promise((resolve, reject) => {
          reader.onload = (e) => {
            const result = e.target.result;
            if (result && result.startsWith('data:image/')) {
              resolve(result);
            } else {
              reject(new Error('Invalid image data format'));
            }
          };
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsDataURL(compressedImage);
        });

        const fileProcessTime = Date.now() - fileStartTime;
        
        // Create page object with enhanced metadata
        const pageData = {
          id: `file-${Date.now()}-${index}`,
          data: imageData,
          pageNumber: uploadedPages.length + processedPages.length + 1,
          timestamp: new Date().toISOString(),
          source: 'file-upload',
          filename: file.name,
          originalSize: file.size,
          compressedSize: compressedImage.size,
          processTime: fileProcessTime,
          width: null,
          height: null
        };

        // Check processing time - file upload should not trigger violations
        if (fileProcessTime < 60000) { // Less than 1 minute (60 seconds)
          console.log(`📁 File ${file.name} processed in ${fileProcessTime}ms - normal processing`);
        } else {
          console.log(`⚠️ File ${file.name} took ${fileProcessTime}ms to process - large file or slow device`);
          // Note: File upload processing time is not considered a violation
          // Users may have large files or slower devices during legitimate file selection
        }

        // Get image dimensions
        const img = new Image();
        img.onload = () => {
          pageData.width = img.width;
          pageData.height = img.height;
        };
        img.src = imageData;

        processedPages.push(pageData);
      } catch (fileError) {
        console.error(`Failed to process file ${file.name}:`, fileError);
        toast.error(`❌ Failed to process ${file.name}: ${fileError.message}`);
        // Continue with other files
      }
    }

    // Add pages to the upload queue with smart ordering
    setUploadedPages(prev => {
      const newPages = [...prev, ...processedPages];
      // Auto-sort by filename if they contain numbers
      return newPages.sort((a, b) => {
        const aNum = extractPageNumber(a.filename);
        const bNum = extractPageNumber(b.filename);
        if (aNum !== null && bNum !== null) {
          return aNum - bNum;
        }
        return a.timestamp.localeCompare(b.timestamp);
      });
    });
    
    const totalUploadTime = Date.now() - uploadStartTime;
    
    if (processedPages.length === 0) {
      toast.warning('⚠️ No files were successfully processed. Please check your file formats and try again.');
    } else {
      toast.success(`✅ ${processedPages.length} page(s) added in ${Math.round(totalUploadTime/1000)}s!`);
    }
    
    // Clear the input
    event.target.value = '';
    setIsUploading(false);
    setIsUploadingFiles(false); // Re-enable violation recording
  }, [uploadedPages, compressImage, extractPageNumber]);

  // Remove page
  const removePage = useCallback((pageId) => {
    setUploadedPages(prev => {
      const filtered = prev.filter(page => page.id !== pageId);
      // Update page numbers
      return filtered.map((page, index) => ({
        ...page,
        pageNumber: index + 1
      }));
    });
    toast.success('📄 Page removed');
  }, []);

  // Upload to Google Drive function - Moved before convertPagesToPdf to fix initialization order
  const uploadToGoogleDrive = useCallback(async (file) => {
    try {
      setIsUploadingFiles(true); // Suppress violations during file upload
      
      const formData = new FormData();
      formData.append('answerSheet', file); // Use correct field name
      
      const response = await fetch(`/api/student/test/${testId}/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Handle multiple response formats from backend
        const uploadUrl = result.answerSheetUrl || 
                         result.url || 
                         result.webViewLink || 
                         result.viewUrl;

        if (!uploadUrl) {
          console.error('No URL in response:', result);
          throw new Error('Upload succeeded but no URL returned');
        }

        return uploadUrl;
      } else {
        throw new Error(result.message || 'Upload failed');
      }
    } catch (error) {
      console.error('Google Drive upload error:', error);
      throw error;
    } finally {
      setIsUploadingFiles(false); // Re-enable violation detection
    }
  }, [testId]);

  // Convert pages to PDF and upload
  const convertPagesToPdf = useCallback(async () => {
    if (uploadedPages.length === 0) {
      toast.error('No images to convert. Please select JPG/JPEG files first.');
      return;
    }

    // Validate all pages have data
    const invalidPages = uploadedPages.filter(page => !page.data || !page.data.startsWith('data:image/'));
    if (invalidPages.length > 0) {
      toast.error(`Invalid image data found in ${invalidPages.length} file(s). Please re-select your files.`);
      return;
    }

    setIsUploading(true);
    toast.info(`📑 Converting ${uploadedPages.length} image(s) to PDF...`);

    try {
      // Dynamic import for jsPDF
      const { default: jsPDF } = await import('jspdf');
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      for (const [index, page] of uploadedPages.entries()) {
        if (index > 0) {
          pdf.addPage();
        }
        
        // Add image to PDF with error handling
        try {
          const img = new Image();
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = () => reject(new Error(`Failed to load image: ${page.filename}`));
            img.src = page.data;
          });
          
          // Calculate dimensions to fit page
          const imgRatio = img.width / img.height;
          const pageRatio = pageWidth / pageHeight;
          
          let imgWidth, imgHeight;
          if (imgRatio > pageRatio) {
            imgWidth = pageWidth - 20; // 10mm margin on each side
            imgHeight = imgWidth / imgRatio;
          } else {
            imgHeight = pageHeight - 20; // 10mm margin on top/bottom
            imgWidth = imgHeight * imgRatio;
          }
          
          const x = (pageWidth - imgWidth) / 2;
          const y = (pageHeight - imgHeight) / 2;
          
          pdf.addImage(page.data, 'JPEG', x, y, imgWidth, imgHeight);
          
          // Add page number and metadata
          pdf.setFontSize(8);
          pdf.text(`Page ${page.pageNumber} | ${page.filename}`, 10, pageHeight - 5);
          
          console.log(`✅ Added page ${index + 1}/${uploadedPages.length}: ${page.filename}`);
        } catch (imageError) {
          console.error(`Failed to process image ${page.filename}:`, imageError);
          throw new Error(`Failed to process image ${page.filename}: ${imageError.message}`);
        }
      }
      
      // Generate PDF blob
      const pdfBlob = pdf.output('blob');
      
      // Create file object
      const pdfFile = new File([pdfBlob], `answer-sheet-${Date.now()}.pdf`, {
        type: 'application/pdf'
      });
      
      toast.info('📤 Uploading PDF to Google Drive...');
      
      // Upload to Google Drive
      const uploadUrl = await uploadToGoogleDrive(pdfFile);
      
      if (uploadUrl && uploadUrl.length > 0) {
        setAnswerSheetUrl(uploadUrl);
        setPaperUploadComplete(true);
        toast.success('✅ Answer sheet uploaded successfully!');
        setShowPaperUploadModal(false);
        
        // Clear uploaded pages
        setUploadedPages([]);
        setPageOrderMode(false);
      } else {
        throw new Error('Upload failed - no URL returned');
      }
      
    } catch (error) {
      console.error('PDF conversion/upload failed:', error);
      toast.error(`❌ Failed to convert or upload PDF: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  }, [uploadedPages, uploadToGoogleDrive]);

  // Image to PDF conversion function
  const convertImageToPdf = useCallback(async (imageFile) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = async () => {
          try {
            // Dynamic import for jsPDF to reduce bundle size
            const { jsPDF } = await import('jspdf');
            
            // Create canvas to get image dimensions and data
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Set canvas size to image size
            canvas.width = img.width;
            canvas.height = img.height;
            
            // Draw image on canvas
            ctx.drawImage(img, 0, 0);
            
            // Calculate PDF dimensions (A4 size in mm)
            const pdfWidth = 210; // A4 width in mm
            const pdfHeight = 297; // A4 height in mm
            
            // Calculate scale to fit image in A4 while maintaining aspect ratio
            const scaleX = pdfWidth / (img.width * 0.264583); // Convert pixels to mm
            const scaleY = pdfHeight / (img.height * 0.264583);
            const scale = Math.min(scaleX, scaleY);
            
            const scaledWidth = img.width * 0.264583 * scale;
            const scaledHeight = img.height * 0.264583 * scale;
            
            // Center the image on the page
            const xOffset = (pdfWidth - scaledWidth) / 2;
            const yOffset = (pdfHeight - scaledHeight) / 2;
            
            // Create PDF
            const pdf = new jsPDF('p', 'mm', 'a4');
            
            // Add image to PDF
            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            pdf.addImage(imgData, 'JPEG', xOffset, yOffset, scaledWidth, scaledHeight);
            
            // Convert PDF to blob
            const pdfBlob = pdf.output('blob');
            
            // Create a new File object with the PDF blob
            const pdfFile = new File([pdfBlob], `${imageFile.name.split('.')[0]}_converted.pdf`, {
              type: 'application/pdf',
              lastModified: Date.now()
            });
            
            resolve(pdfFile);
          } catch (error) {
            reject(error);
          }
        };
        
        img.onerror = () => {
          reject(new Error('Failed to load image'));
        };
        
        img.src = event.target.result;
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
      
      reader.readAsDataURL(imageFile);
    });
  }, []);

  // Paper Upload Modal Functions
  const capturePaperPage = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) {
      toast.error('Camera not available');
      return;
    }

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const context = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);

    const imageData = canvas.toDataURL('image/jpeg', 0.9);
    const timestamp = new Date().toISOString();
    
    const paperPage = {
      id: `page_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      data: imageData,
      timestamp,
      pageNumber: currentPageNumber
    };

    setPaperUploadPages(prev => [...prev, paperPage]);
    setCurrentPageNumber(prev => prev + 1);
    
    toast.success(`📄 Page ${paperPage.pageNumber} captured!`, {
      autoClose: 2000
    });
  }, [currentPageNumber]);

  const removePaperPage = useCallback((pageId) => {
    setPaperUploadPages(prev => {
      const updated = prev.filter(page => page.id !== pageId);
      // Renumber pages
      return updated.map((page, index) => ({ ...page, pageNumber: index + 1 }));
    });
    
    // Update current page number
    setPaperUploadPages(prev => {
      setCurrentPageNumber(prev.length + 1);
      return prev;
    });
    
    toast.info('📄 Page removed');
  }, []);

  const submitPaperUpload = useCallback(async () => {
    if (paperUploadPages.length === 0) {
      toast.error('Please capture at least one page of your answer sheet');
      return;
    }

    try {
      setIsUploading(true);
      
      // Convert all captured pages to PDF
      const pdfFile = await convertImagesToPdf(paperUploadPages);
      
      // Upload the PDF
      const url = await handleFileUpload(pdfFile);
      setAnswerSheetUrl(url);
      setPaperUploadComplete(true);
      
      // Clear paper upload timer
      if (paperUploadTimerRef.current) {
        clearInterval(paperUploadTimerRef.current);
      }
      
      toast.success('✅ Answer sheet uploaded successfully!', {
        autoClose: 3000
      });
      
      // Auto-submit after successful upload - use autoSubmitReason if test time expired
      const submitReason = autoSubmit ? (autoSubmitReason || 'paper_uploaded_after_time_expiry') : 'paper_uploaded';
      
      setTimeout(() => {
        handleAutoSubmit(submitReason);
      }, 2000);
      
    } catch (error) {
      console.error('Paper upload failed:', error);
      toast.error('❌ Failed to upload answer sheet: ' + error.message);
      
      // If auto-submit is enabled (time expired), still submit even on upload failure
      if (autoSubmit) {
        setTimeout(() => {
          handleAutoSubmit('paper_upload_failed_after_time_expiry');
        }, 3000);
      }
    } finally {
      setIsUploading(false);
    }
  }, [paperUploadPages, convertImagesToPdf, handleFileUpload, handleAutoSubmit, autoSubmit, autoSubmitReason]);

  const exitWithoutUpload = useCallback(() => {
    if (paperUploadTimerRef.current) {
      clearInterval(paperUploadTimerRef.current);
    }
    
    // Use appropriate reason based on whether test time expired
    const submitReason = autoSubmit ? (autoSubmitReason || 'exited_without_upload_after_time_expiry') : 'exited_without_upload';
    handleAutoSubmit(submitReason);
  }, [handleAutoSubmit, autoSubmit, autoSubmitReason]);

  const uploadCapturedImages = useCallback(async () => {
    if (capturedImages.length === 0) {
      toast.error('No images captured. Please capture at least one image.');
      return;
    }

    try {
      setIsUploading(true);
      const pdfFile = await convertImagesToPdf(capturedImages);
      const url = await handleFileUpload(pdfFile);
      setAnswerSheetUrl(url);
      toast.success('📎 Answer sheet uploaded successfully!');
      setShowCameraModal(false);
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error('❌ Failed to upload answer sheet');
    } finally {
      setIsUploading(false);
    }
  }, [capturedImages, convertImagesToPdf, handleFileUpload]);

  const showEarlyPaperUpload = useCallback(() => {
    if (!test?.paperUploadAllowedDuringTest) {
      toast.error('Paper upload during test is not allowed');
      return;
    }
    
    setShowPaperUploadModal(true);
    // Set a longer time limit during test (full remaining time or 30 minutes, whichever is less)
    const remainingTime = timer.timeRemaining || 1800; // Default 30 minutes if timer not available
    const uploadTimeLimit = Math.min(remainingTime, 1800); // Max 30 minutes
    setPaperUploadTimeRemaining(uploadTimeLimit);
    startPaperUploadTimer(uploadTimeLimit);
    
    toast.info('📄 You can now upload your answer sheet page by page', {
      autoClose: 3000
    });
  }, [test, timer, startPaperUploadTimer]);

  // Enhanced submit with offline support
 
  // Enhanced auto-save with offline support
  useEffect(() => {
    if (!testStarted || (Object.keys(answers).length === 0 && Object.keys(offlineAnswers).length === 0) || isSubmitted) return;

    if (autoSaveRef.current) {
      clearTimeout(autoSaveRef.current);
    }

    autoSaveRef.current = setTimeout(() => {
      const allAnswers = { ...answers, ...offlineAnswers };
      localStorage.setItem(`test-answers-${testId}`, JSON.stringify(allAnswers));
      
      if (isOnline) {
        console.log('💾 Answers auto-saved (online)');
      } else {
        console.log('💾 Answers auto-saved (offline)');
        setPendingSave(true);
      }
    }, 2000);

    return () => {
      if (autoSaveRef.current) {
        clearTimeout(autoSaveRef.current);
      }
    };
  }, [answers, offlineAnswers, testStarted, testId, isSubmitted, isOnline]);


  // 1) Submit only the answer sheet
  const handleAnswerSheetSubmit = useCallback(async () => {
    if (isUploading) return;
    if (answerSheetUrl) {
      toast.info('✅ Answer sheet already uploaded');
      return;
    }
    if (uploadedPages.length === 0) {
      toast.error('Please select JPG/JPEG files first');
      return;
    }

    try {
      // Use the convertPagesToPdf function
      await convertPagesToPdf();
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('❌ ' + err.message);
    }
  }, [uploadedPages, answerSheetUrl, isUploading, convertPagesToPdf]);

  // 2) Exit test button handler
  const handleExitTest = useCallback(async () => {
    if (isSubmitted) return;

    try {
      // 1) Gentle warning if no answer sheet
      if (!answerSheetUrl) {
        const result = await Swal.fire({
          title: 'No Answer Sheet Uploaded',
          text: 'Are you sure you want to exit without uploading your answer sheet?',
          icon: 'warning',
          showCancelButton: true,
          confirmButtonColor: '#f59e0b',
          cancelButtonColor: '#6b7280',
          confirmButtonText: 'Exit Anyway',
          cancelButtonText: 'Cancel'
        });

        if (!result.isConfirmed) return;
      }

      // 2) Final exit confirmation
      const finalConfirm = await Swal.fire({
        title: 'Exit Test?',
        html: `
        <p>Your progress will be saved but you cannot restart this test.</p>
        <p><strong>Are you sure you want to continue?</strong></p>
      `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Yes, Exit Test',
        cancelButtonText: 'Stay in Test'
      });

      if (!finalConfirm.isConfirmed) return;

      setIsSubmitting(true);
      submissionLockRef.current = true;

      const token = localStorage.getItem('token');
      const { data } = await axios.post(
        `/api/student/test/${testId}/exit`,
        { 
          violations, // Include violations in exit
          timeTaken,
          browserInfo,
          monitoringData: {
            monitoringImages,
            suspiciousActivities,
            cameraMonitoring: cameraMonitoringEnabled,
            testStartTime: testStartTimeRef.current,
            testEndTime: new Date().toISOString()
          }
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (data.success) {
        await Swal.fire({
          title: 'Test Exited',
          text: 'Your test has been exited successfully. You cannot restart.',
          icon: 'success',
          confirmButtonColor: '#10b981',
          timer: 2000,
          timerProgressBar: true
        });

        cleanup();
        setTimeout(() => navigate('/student'), 1500);
      } else {
        throw new Error(data.message || 'Exit failed');
      }
    } catch (err) {
      console.error('Exit error:', err);
      await Swal.fire({
        title: 'Exit Failed',
        text: `Failed to exit test: ${err.message}`,
        icon: 'error',
        confirmButtonColor: '#dc2626'
      });
      submissionLockRef.current = false;
      setIsSubmitting(false);
    }
  }, [testId, cleanup, navigate, answerSheetUrl, violations]);
   useEffect(() => {
    if (!testStarted || (Object.keys(answers).length === 0 && Object.keys(offlineAnswers).length === 0) || isSubmitted) return;

    if (autoSaveRef.current) {
      clearTimeout(autoSaveRef.current);
    }

    autoSaveRef.current = setTimeout(() => {
      const allAnswers = { ...answers, ...offlineAnswers };
      localStorage.setItem(`test-answers-${testId}`, JSON.stringify(allAnswers));
      
      if (isOnline) {
        console.log('💾 Answers auto-saved (online)');
      } else {
        console.log('💾 Answers auto-saved (offline)');
        setPendingSave(true);
      }
    }, 2000);

    return () => {
      if (autoSaveRef.current) {
        clearTimeout(autoSaveRef.current);
      }
    };
  }, [answers, offlineAnswers, testStarted, testId, isSubmitted, isOnline]);

  // Camera lifecycle management with improved stability
  useEffect(() => {
    let cameraRetryTimeout;
    
    // Request camera permissions when test starts
    if (testStarted && !isCameraActive && !cameraInitializingRef.current) {
      const requestCamera = async () => {
        try {
          addDebugLog('🔄 Requesting camera for test monitoring...', 'info');
          await startCamera();
        } catch (error) {
          addDebugLog(`❌ Camera request failed: ${error.message}`, 'error');
          
          // Retry camera initialization after delay if it failed
          if (!cameraInitializingRef.current) {
            addDebugLog('🔄 Scheduling camera retry in 5 seconds...', 'info');
            cameraRetryTimeout = setTimeout(() => {
              if (testStarted && !isCameraActive && !cameraInitializingRef.current) {
                addDebugLog('🔄 Retrying camera initialization...', 'info');
                requestCamera();
              }
            }, 5000);
          }
        }
      };
      requestCamera();
    }

    // Cleanup camera when test ends or component unmounts
    return () => {
      if (cameraRetryTimeout) {
        clearTimeout(cameraRetryTimeout);
      }
      stopCamera();
    };
  }, [testStarted, startCamera, stopCamera, isCameraActive]); // Added isCameraActive back for proper state tracking
  // eslint-disable-next-line react-hooks/exhaustive-deps

  // Monitoring lifecycle
  useEffect(() => {
    if (testStarted && isCameraActive && !monitoringActive) {
      startMonitoring();
    }

    return () => {
      stopMonitoring();
    };
  }, [testStarted, isCameraActive, monitoringActive, startMonitoring, stopMonitoring]);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      stopCamera();
      stopMonitoring();
      if (autoSaveRef.current) {
        clearTimeout(autoSaveRef.current);
      }
    };
  }, [stopCamera, stopMonitoring]);

  const renderFullscreenPrompt = () => {
    if (!showFullscreenPrompt || !testStarted || isBetterViewer || isSubmitted) return null;

    return (
      <div className="fullscreen-prompt-overlay">
        <div className="fullscreen-prompt-modal">
          <h3>🔒 Exam Security Notice</h3>
          <p>For security and integrity purposes, this exam must be taken in fullscreen mode.</p>
          <div className="prompt-actions">
            <button
              className="btn btn-primary btn-large"
              onClick={requestFullscreen}
            >
              📺 Enter Fullscreen Mode
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setShowFullscreenPrompt(false);
                toast.info('💡 Alternative: Press F11 key to enter fullscreen');
              }}
            >
              💡 Show Alternative (F11)
            </button>
          </div>
          <small className="prompt-note">
            If the button doesn't work, please press the <strong>F11</strong> key on your keyboard
          </small>
        </div>
      </div>
    );
  };

  // Enhanced PDF viewer with better viewer mode
  const renderQuestionPaper = () => {
    // Only render if we have a signed PDF URL
    if (!pdfUrl) {
      if (pdfLoading) {
        return (
          <div className="question-paper-loading">
            <div className="loading-spinner">
              <span>🔄 Loading question paper...</span>
            </div>
          </div>
        );
      }
      return (
        <div className="question-paper-error">
          <div className="error-message">
            <span>❌ Question paper not available</span>
            <button 
              className="btn btn-sm btn-primary"
              onClick={fetchSignedPdfUrl}
              disabled={!test?.questionPaperURL}
            >
              🔄 Retry Loading
            </button>
          </div>
        </div>
      );
    }

    return (
      <div>
        {/* Regular PDF Display */}
        <div className={`question-paper ${isBetterViewer ? 'hidden' : ''}`}>
          <div className="question-paper-header">
            <h3>📄 Question Paper</h3>
            <div className="pdf-toolbar">
              <button
                className="btn btn-primary"
                onClick={enterBetterViewer}
                disabled={isSubmitted}
                title="View question paper in better viewer mode"
              >
                📺 Better Viewer
              </button>
              <button
                className="btn btn-sm btn-outline"
                onClick={refreshPdfUrl}
                disabled={pdfLoading || isSubmitted}
              >
                {pdfLoading ? '🔄 Refreshing...' : '🔄 Refresh'}
              </button>
            </div>
          </div>

          <div style={{ position: 'relative', width: '100%', height: '80vh' }}>
            <iframe
              src={enhanceEmbedUrl(pdfUrl)}
              title="Question Paper"
              className="pdf-viewer"
              style={{ width: '100%', height: '100%', border: 0 }}
              sandbox="allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox"
              scrolling="yes"
              referrerPolicy="no-referrer-when-downgrade"
              allow="fullscreen autoplay"
            />
            {/* Mobile Fallback Button */}
            <div style={{
              position: 'absolute',
              bottom: 10,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 10
            }}>
              <button
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
                onClick={() => window.open(pdfUrl, '_blank', 'noopener,noreferrer')}
              >
                📄 Open in New Tab
              </button>
            </div>
            {/* Overlay to block top-right popout button */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: 60, // Adjust width/height to cover the button
                height: 55,
                zIndex: 2,
                background: 'rgba(145, 127, 127, 0.8)',
                cursor: 'default'
              }}
            />
          </div>


          <div className="pdf-info">
            <small className="text-muted">
              💡 Click "Better Viewer" for distraction-free reading experience
            </small>
          </div>
        </div>

        {/* Better Viewer Overlay */}
        {isBetterViewer && (
          <div className="better-viewer-overlay">
            {/* Red Close Button */}
            <button
              className="better-viewer-close"
              onClick={exitBetterViewer}
              title="Exit Better Viewer (ESC)"
            >
              ✕
            </button>

            {/* Optimized Timer Display in Better Viewer */}
            <div className="better-viewer-timer">
              <TimerDisplay 
                timeRemaining={timer.timeRemaining}
                size="small"
                showWarning={true}
                onTimeOut={() => handleAutoSubmit('time_limit')}
              />
            </div>

            {/* Zoom controls */}
            <div className="better-viewer-zoom">
              <button
                className="zoom-btn"
                onClick={() => setPdfScale(prev => Math.max(prev - 0.25, 0.5))}
                disabled={pdfScale <= 0.5}
                title="Zoom Out (Ctrl+-)"
              >
                🔍➖
              </button>

              <span className="zoom-display">
                {Math.round(pdfScale * 100)}%
              </span>

              <button
                className="zoom-btn"
                onClick={() => setPdfScale(prev => Math.min(prev + 0.25, 3))}
                disabled={pdfScale >= 3}
                title="Zoom In (Ctrl++)"
              >
                🔍➕
              </button>

              <button
                className="zoom-btn"
                onClick={() => setPdfScale(1.25)}
                title="Reset Zoom (Ctrl+0)"
              >
                🎯
              </button>
            </div>

            {/* PDF Content with Popout Protection */}
            <div className="better-viewer-content">
              <div
                className="pdf-container-better"
                style={{
                  transform: `scale(${pdfScale})`,
                  transformOrigin: 'top center',
                  transition: 'transform 0.3s ease'
                }}
              >
                <div className="popout-blocker-container">
                  <iframe
                    ref={pdfViewerRef}
                    src={enhanceEmbedUrl(pdfUrl)}
                    title="Question Paper Better Viewer"
                    className="pdf-viewer-better"
                    width="100%"
                    height="100%"
                    sandbox="allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox"
                    scrolling="yes"
                    referrerPolicy="no-referrer-when-downgrade"
                    allow="fullscreen"
                    onError={() => {
                      setPdfError(true);
                      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                      if (isMobile) {
                        toast.info('📱 If content is blocked on mobile, try opening in a new tab');
                      }
                    }}
                    onLoad={() => setPdfError(false)}
                  />
                  {/* Popout button blocker overlay */}
                  <div className="popout-blocker-overlay"></div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    );
  };

  const renderQuestions = () => {
    // Questions are displayed in the PDF viewer, not as individual components
    // This function is only for tests that have questions stored as array in database (MCQ tests)
    if (!test?.questions || test.questions.length === 0) return null;

    return (
      <div className={`questions-section ${isBetterViewer ? 'hidden' : ''}`}>
        <h3>📝 Answer the Following Questions</h3>
        {test.questions.map((question, index) => (
          <div key={index} className="question-card">
            <div className="question-header">
              <span className="question-number">Question {index + 1}</span>
              <span className="question-marks">({question.marks || 1} marks)</span>
            </div>

            <div className="question-text">
              {question.questionText}
            </div>

            <div className="question-answer">
              {question.questionType === 'mcq' && (
                <div className="mcq-options">
                  {question.options?.map((option, optIndex) => (
                    <label key={optIndex} className="mcq-option">
                      <input
                        type="radio"
                        name={`question-${index}`}
                        value={option.id}
                        checked={answers[index] === option.id}
                        onChange={(e) => handleAnswerChange(index, e.target.value)}
                        disabled={isSubmitted}
                      />
                      <span className="option-text">{option.text}</span>
                    </label>
                  ))}
                </div>
              )}

              {(question.questionType === 'text' || !question.questionType) && (
                <textarea
                  className="text-answer"
                  value={answers[index] || ''}
                  onChange={(e) => handleAnswerChange(index, e.target.value)}
                  placeholder="Type your answer here..."
                  rows="4"
                  disabled={isSubmitted}
                />
              )}

              {question.questionType === 'numerical' && (
                <input
                  type="number"
                  className="numerical-answer"
                  value={answers[index] || ''}
                  onChange={(e) => handleAnswerChange(index, e.target.value)}
                  placeholder="Enter numerical answer"
                  disabled={isSubmitted}
                />
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Show paper upload timer if required
  if (showPaperUploadTimer) {
    return (
      <PaperUploadTimer
        test={test}
        user={user}
        onComplete={handlePaperUploadComplete}
        onSkip={handlePaperUploadSkip}
      />
    );
  }

  // Show submitted state
  if (isSubmitted) {
    return (
      <div className="test-submitted">
        <div className="submitted-content">
          <h2>✅ Test Submitted Successfully</h2>
          <p>Your test has been submitted and saved. You cannot make any more changes.</p>
          <button
            className="btn btn-primary"
            onClick={() => navigate('/student')}
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="test-loading">
        <LoadingSpinner text="Loading test interface..." />
        <p>Please wait while we prepare your exam...</p>
      </div>
    );
  }

  if (!test) {
    return (
      <div className="test-loading">
        <LoadingSpinner text="Loading test data..." />
        <p>Please wait while we prepare your exam...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="test-error">
        <h2>❌ Unable to Load Test</h2>
        <p>{error}</p>
        <button className="btn btn-primary" onClick={() => navigate('/student')}>
          Return to Dashboard
        </button>
      </div>
    );
  }

  if (!test) {
    return (
      <div className="test-error">
        <h2>⚠️ Test Not Available</h2>
        <p>The test you're looking for is not available or has been removed.</p>
        <button className="btn btn-primary" onClick={() => navigate('/student')}>
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="test-interface">
      {/* Critical Time Warning Indicator */}
      {showCriticalTimeWarning && timer.timeRemaining <= 300 && timer.timeRemaining > 0 && (
        <div className="critical-time-indicator">
          ⚠️ Critical Time: {formatTime(timer.timeRemaining)} Remaining!
        </div>
      )}
      
      {/* Hidden video element for camera monitoring - always available */}
      <video 
        ref={videoRef}
        style={{ 
          position: 'absolute',
          top: '-9999px',
          left: '-9999px',
          width: '1px',
          height: '1px',
          opacity: 0,
          pointerEvents: 'none'
        }}
        autoPlay
        playsInline
        muted
      />
      
      {/* Hidden canvas for image capture */}
      <canvas 
        ref={canvasRef}
        style={{ 
          position: 'absolute',
          top: '-9999px',
          left: '-9999px',
          width: '1px',
          height: '1px',
          opacity: 0,
          pointerEvents: 'none'
        }}
      />

      {/* Enhanced Debug Panel */}
      {showDebugPanel && (
        <div style={{
          position: 'fixed',
          top: '10px',
          left: '10px',
          right: '10px',
          width: window.innerWidth < 768 ? 'calc(100vw - 20px)' : '350px',
          maxHeight: window.innerWidth < 768 ? '50vh' : '400px',
          background: 'rgba(0, 0, 0, 0.95)',
          color: 'white',
          padding: window.innerWidth < 768 ? '10px' : '15px',
          borderRadius: '8px',
          fontSize: window.innerWidth < 768 ? '11px' : '12px',
          zIndex: 10000,
          fontFamily: 'monospace',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          border: '1px solid #333'
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '10px',
            borderBottom: '1px solid #333',
            paddingBottom: '8px'
          }}>
            <strong style={{ fontSize: window.innerWidth < 768 ? '12px' : '14px' }}>
              🔧 Camera Debug
            </strong>
            <button 
              onClick={() => setShowDebugPanel(false)}
              style={{
                background: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                padding: '4px 8px',
                cursor: 'pointer',
                fontSize: '10px',
                minWidth: '40px',
                minHeight: '30px'
              }}
            >
              ✕
            </button>
          </div>
          
          {/* Status Overview */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ 
              color: cameraMonitoringEnabled ? '#28a745' : '#dc3545',
              marginBottom: '3px',
              display: 'flex',
              justifyContent: 'space-between'
            }}>
              <span>Camera Monitoring:</span>
              <span>{cameraMonitoringEnabled ? '✅' : '❌'}</span>
            </div>
            <div style={{ 
              color: showVideoPreview ? '#28a745' : '#dc3545',
              marginBottom: '3px',
              display: 'flex',
              justifyContent: 'space-between'
            }}>
              <span>Video Preview:</span>
              <span>{showVideoPreview ? '✅' : '❌'}</span>
            </div>
            <div style={{ 
              color: !!streamRef.current ? '#28a745' : '#dc3545',
              marginBottom: '3px',
              display: 'flex',
              justifyContent: 'space-between'
            }}>
              <span>Stream Active:</span>
              <span>{!!streamRef.current ? '✅' : '❌'}</span>
            </div>
            <div style={{ 
              color: !!videoRef.current ? '#28a745' : '#dc3545',
              marginBottom: '3px',
              display: 'flex',
              justifyContent: 'space-between'
            }}>
              <span>Video Element:</span>
              <span>{!!videoRef.current ? '✅' : '❌'}</span>
            </div>
            <div style={{ 
              color: isCameraActive ? '#28a745' : '#dc3545',
              display: 'flex',
              justifyContent: 'space-between'
            }}>
              <span>Camera Active:</span>
              <span>{isCameraActive ? '✅' : '❌'}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ 
            marginBottom: '12px', 
            display: 'grid',
            gridTemplateColumns: window.innerWidth < 768 ? '1fr 1fr' : 'repeat(3, 1fr)',
            gap: '5px'
          }}>
            <button 
              onClick={async () => {
                addDebugLog('🧪 Manual camera test started...', 'info');
                try {
                  await initializeCameraMonitoring();
                  addDebugLog('🧪 Manual test completed successfully', 'success');
                } catch (error) {
                  addDebugLog(`🧪 Manual test failed: ${error.message}`, 'error');
                }
              }}
              style={{
                padding: '8px 4px',
                background: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '10px',
                minHeight: '35px'
              }}
            >
              🧪 Test
            </button>
            
            <button 
              onClick={() => {
                if (!isCameraActive || !streamRef.current) {
                  addDebugLog('🎥 Camera not active, initializing...', 'info');
                  initializeCameraMonitoring();
                } else {
                  setShowVideoPreview(!showVideoPreview);
                  addDebugLog(`🎥 Video preview ${!showVideoPreview ? 'shown' : 'hidden'}`, 'info');
                }
              }}
              style={{
                padding: '8px 4px',
                background: showVideoPreview ? '#dc3545' : '#17a2b8',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '10px',
                minHeight: '35px'
              }}
            >
              {showVideoPreview ? '🎥 Hide' : '🎥 Show'}
            </button>

            <button 
              onClick={() => {
                setDebugLogs([]);
                addDebugLog('🧹 Debug logs cleared', 'info');
              }}
              style={{
                padding: '8px 4px',
                background: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '10px',
                minHeight: '35px',
                gridColumn: window.innerWidth < 768 ? 'span 2' : 'auto'
              }}
            >
              🧹 Clear
            </button>
          </div>

          {/* Debug Logs */}
          <div style={{ 
            borderTop: '1px solid #333',
            paddingTop: '8px',
            maxHeight: window.innerWidth < 768 ? '120px' : '150px',
            overflowY: 'auto'
          }}>
            <div style={{ marginBottom: '5px', fontWeight: 'bold' }}>📋 Debug Messages:</div>
            {debugLogs.length === 0 ? (
              <div style={{ color: '#6c757d', fontStyle: 'italic' }}>No debug messages yet...</div>
            ) : (
              debugLogs.map(log => (
                <div 
                  key={log.id} 
                  style={{ 
                    marginBottom: '3px',
                    padding: '3px 6px',
                    borderRadius: '3px',
                    background: log.type === 'error' ? 'rgba(220, 53, 69, 0.2)' : 
                               log.type === 'success' ? 'rgba(40, 167, 69, 0.2)' : 
                               'rgba(108, 117, 125, 0.2)',
                    color: log.type === 'error' ? '#ff6b6b' : 
                           log.type === 'success' ? '#51cf66' : 
                           '#adb5bd',
                    fontSize: window.innerWidth < 768 ? '10px' : '11px',
                    wordBreak: 'break-word'
                  }}
                >
                  <span style={{ fontSize: '9px', opacity: 0.7 }}>[{log.timestamp}]</span> {log.message}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Debug Panel Toggle Button (when panel is closed) */}
      {!showDebugPanel && (
        <button
          onClick={() => {
            setShowDebugPanel(true);
            addDebugLog('🔧 Debug panel opened', 'info');
          }}
          style={{
            position: 'fixed',
            top: '10px',
            left: '10px',
            width: window.innerWidth < 768 ? '50px' : '40px',
            height: window.innerWidth < 768 ? '50px' : '40px',
            borderRadius: '50%',
            background: '#007bff',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            fontSize: window.innerWidth < 768 ? '20px' : '16px',
            zIndex: 10000,
            boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title="Open Camera Debug Panel"
        >
          🔧
        </button>
      )}

      {/* Timer and Test Info Header */}
      <div className="test-header-enhanced">
        <div className="test-info-main">
          <h1 className="test-title">{test?.title || 'Loading...'}</h1>
          <div className="test-meta-info">
            <div className="timer-container">
              <span className="timer-label">Time Remaining:</span>
              <span className={`timer-display ${timer.timeRemaining <= 300 ? 'timer-warning' : ''}`}>
                {formatTime(timer.timeRemaining || 0)}
              </span>
            </div>
            <div className="question-count">
              <span className="question-label">Questions:</span>
              <span className="question-number">{test?.questionsCount || 0}</span>
            </div>
            {test?.cameraMonitoring?.enabled && (
              <div className={`monitoring-status ${monitoringActive ? 'active' : 'inactive'}`}>
                <span className="monitoring-icon">📹</span>
                <span className="monitoring-text">
                  Camera: {monitoringActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            )}
          </div>
        </div>
        
        {/* Violations Display */}
        {violations.length > 0 && (
          <div className="violations-display-enhanced">
            <div className="violation-badge">
              <span className="violation-icon">⚠️</span>
              <span className="violation-text">
                {violations.length}/{test?.proctoringSettings?.maxViolations || 10}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Camera Modal */}
      {showCameraModal && (
        <div className="camera-modal-overlay">
          <div className="camera-modal-enhanced">
            <div className="camera-modal-header">
              <h3>📷 Camera Controls</h3>
              <button 
                className="close-btn-enhanced"
                onClick={() => setShowCameraModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="camera-content-enhanced">
              <div className="camera-preview-container">
                <video ref={videoRef} className="camera-preview-enhanced" playsInline />
                <canvas ref={canvasRef} style={{ display: 'none' }} />
              </div>
              
              <div className="camera-controls-enhanced">
                {!isCameraActive ? (
                  <button className="btn btn-primary btn-large" onClick={startCamera}>
                    📷 Start Camera
                  </button>
                ) : (
                  <div className="active-camera-controls">
                    <button className="btn btn-success btn-large" onClick={() => captureImage('answer')}>
                      📸 Capture Image
                    </button>
                    <button className="btn btn-danger" onClick={stopCamera}>
                      🛑 Stop Camera
                    </button>
                  </div>
                )}
              </div>
              
              {/* Captured Images Preview */}
              {capturedImages.length > 0 && (
                <div className="captured-images-enhanced">
                  <h4>Captured Images ({capturedImages.length})</h4>
                  <div className="images-grid-enhanced">
                    {capturedImages.map((img) => (
                      <div key={img.id} className="image-item-enhanced">
                        <img src={img.data} alt={`Page ${img.page}`} />
                        <div className="image-overlay">
                          <button 
                            className="remove-btn-enhanced"
                            onClick={() => removeImage(img.id)}
                          >
                            🗑️
                          </button>
                          <span className="image-label-enhanced">Page {img.page}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Paper Upload Modal */}
      {showPaperUploadModal && (
        <div className="paper-upload-modal-overlay">
          <div className="paper-upload-modal-enhanced">
            <div className="paper-upload-header-enhanced">
              <h3>📄 Upload Answer Sheet</h3>
              <div className={`upload-timer-enhanced ${paperUploadTimeRemaining <= 300 ? 'urgent' : ''}`}>
                <span className="timer-label">Time Remaining:</span>
                <span className={`timer-display-upload ${paperUploadTimeRemaining <= 300 ? 'urgent-timer' : ''}`}>
                  {formatTime(paperUploadTimeRemaining)}
                </span>
              </div>
              {autoSubmit && (
                <div className="upload-notice-enhanced urgent-notice">
                  <span className="notice-icon">🚨</span>
                  <strong>TEST TIME EXPIRED!</strong> Upload your answer sheet now. Test will auto-submit when uploaded or when timer expires.
                </div>
              )}
              {!autoSubmit && !test?.paperUploadAllowedDuringTest && (
                <div className="upload-notice-enhanced">
                  <span className="notice-icon">⏰</span>
                  Test time has ended. Please upload your answer sheet page by page.
                </div>
              )}
            </div>
            
            <div className="paper-upload-content-enhanced">
              <div className="upload-options">
                <h4>Upload Methods</h4>
                <div className="upload-method-tabs">
                  <button 
                    className={`upload-tab ${uploadMethod === 'camera' ? 'active' : ''}`}
                    onClick={() => setUploadMethod('camera')}
                  >
                    📷 Camera Capture
                  </button>
                  <button 
                    className={`upload-tab ${uploadMethod === 'file' ? 'active' : ''}`}
                    onClick={() => setUploadMethod('file')}
                  >
                    📁 File Upload
                  </button>
                </div>
              </div>

              {uploadMethod === 'camera' && (
                <div className="camera-section-enhanced">
                  <div className="camera-preview-container">
                    <video ref={videoRef} className="camera-preview-enhanced" playsInline />
                    <canvas ref={canvasRef} style={{ display: 'none' }} />
                  </div>
                  
                  <div className="camera-controls-enhanced">
                    {!isCameraActive ? (
                      <button className="btn btn-primary btn-large" onClick={startCamera}>
                        📷 Start Camera
                      </button>
                    ) : (
                      <div className="capture-controls-enhanced">
                        <div className="page-info-enhanced">
                          <span className="page-icon">📄</span>
                          Ready to capture Page {currentPageNumber}
                        </div>
                        <button className="btn btn-success btn-large" onClick={capturePaperPage}>
                          📸 Capture Page {currentPageNumber}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {uploadMethod === 'file' && (
                <div className="file-upload-section-enhanced">
                  <div className="file-upload-area">
                    <input
                      type="file"
                      id="file-upload"
                      accept="image/jpeg,image/jpg"
                      multiple
                      onChange={handleImageFileUpload}
                      className="file-input"
                      disabled={mobileUploadDetected}
                    />
                    <label htmlFor="file-upload" className="file-upload-label">
                      <div className="upload-icon">�</div>
                      <div className="upload-text">
                        <h4>Select Answer Sheet Images from Device</h4>
                        <p>Click here to select images from your device</p>
                        <p>Supports: JPG, PNG, HEIC (Multiple files allowed)</p>
                        <small>Tip: Name files as page1.jpg, page2.jpg for auto-ordering</small>
                        <small style={{color: '#28a745'}}>✓ No camera required - select from your device files</small>
                      </div>
                    </label>
                  </div>

                  {/* Page Management */}
                  {uploadedPages.length > 0 && (
                    <div className="page-management">
                      <div className="page-management-header">
                        <h4>📄 Uploaded Pages ({uploadedPages.length})</h4>
                        <div className="page-controls">
                          <button
                            className={`btn ${pageOrderMode ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setPageOrderMode(!pageOrderMode)}
                          >
                            {pageOrderMode ? '✅ Done Reordering' : '🔄 Reorder Pages'}
                          </button>
                          <button
                            className="btn btn-success"
                            onClick={convertPagesToPdf}
                            disabled={isUploading || uploadedPages.length === 0 || mobileUploadDetected}
                          >
                            {mobileUploadDetected ? '📱 Mobile Upload Complete' : '📑 Convert to PDF & Upload'}
                          </button>
                        </div>
                      </div>

                      <div className={`pages-grid-enhanced ${pageOrderMode ? 'reorder-mode' : ''}`}>
                        {uploadedPages.map((page, index) => (
                          <div
                            key={page.id}
                            className="page-item-enhanced"
                            draggable={pageOrderMode}
                            onDragStart={(e) => e.dataTransfer.setData('text/plain', index)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              const dragIndex = parseInt(e.dataTransfer.getData('text/plain'));
                              reorderPages(dragIndex, index);
                            }}
                          >
                            <div className="page-number-badge-enhanced">
                              <span className="page-num">#{page.pageNumber}</span>
                              <span className="page-label">Page {page.pageNumber}</span>
                            </div>
                            <img src={page.data} alt={`Page ${page.pageNumber}`} />
                            <div className="page-overlay">
                              <button 
                                className="remove-btn-enhanced"
                                onClick={() => removePage(page.id)}
                              >
                                🗑️
                              </button>
                              <div className="page-info-enhanced">
                                <div className="file-info">
                                  <span className="file-name">{page.filename}</span>
                                  <span className="file-size">{(page.compressedSize / 1024).toFixed(1)}KB</span>
                                </div>
                                <div className="processing-info">
                                  {page.processTime && (
                                    <span className="process-time">⏱️ {(page.processTime/1000).toFixed(1)}s</span>
                                  )}
                                  <span className="compression-ratio">
                                    📦 {((page.originalSize - page.compressedSize) / page.originalSize * 100).toFixed(0)}% smaller
                                  </span>
                                </div>
                              </div>
                            </div>
                            {pageOrderMode && (
                              <div className="drag-handle">
                                <span>⋮⋮</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="upload-instructions">
                    <h5>📋 Instructions:</h5>
                    <ul>
                      <li>Upload images of your answer sheets in order</li>
                      <li>Name files as page1.jpg, page2.jpg for automatic ordering</li>
                      <li>Use the reorder function to arrange pages correctly</li>
                      <li>All pages will be merged into a single PDF</li>
                      <li>Images are automatically compressed for faster upload</li>
                    </ul>
                  </div>
                </div>
              )}
              
              {/* Captured Pages Preview */}
              {paperUploadPages.length > 0 && (
                <div className="captured-pages-enhanced">
                  <h4>Captured Pages ({paperUploadPages.length})</h4>
                  <div className="pages-grid-enhanced">
                    {paperUploadPages.map((page) => (
                      <div key={page.id} className="page-item-enhanced">
                        <img src={page.data} alt={`Page ${page.pageNumber}`} />
                        <div className="page-overlay">
                          <button 
                            className="remove-btn-enhanced"
                            onClick={() => removePaperPage(page.id)}
                          >
                            🗑️
                          </button>
                          <span className="page-label-enhanced">Page {page.pageNumber}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="upload-actions-enhanced">
                <button
                  className={`btn btn-success btn-large btn-primary-action ${autoSubmit ? 'auto-submit-btn' : ''}`}
                  onClick={submitPaperUpload}
                  disabled={paperUploadPages.length === 0 || isUploading || paperUploadComplete || mobileUploadDetected}
                >
                  {mobileUploadDetected 
                    ? '📱 Mobile Upload Completed'
                    : isUploading 
                      ? (autoSubmit ? '⏳ Uploading & Auto-Submitting...' : '⏳ Uploading...') 
                      : paperUploadComplete 
                        ? '✅ Uploaded' 
                        : autoSubmit 
                          ? `� Upload ${paperUploadPages.length} Pages & Auto-Submit`
                          : `�📤 Upload ${paperUploadPages.length} Pages`
                  }
                </button>
                
                {!test?.paperSubmissionRequired && (
                  <button
                    className={`btn btn-danger ${autoSubmit ? 'auto-submit-btn' : ''}`}
                    onClick={exitWithoutUpload}
                    disabled={isUploading}
                  >
                    {autoSubmit ? '🚀 Skip & Auto-Submit' : '🚪 Exit Without Upload'}
                  </button>
                )}
                
                {autoSubmit && (
                  <div className="auto-submit-notice">
                    <span className="notice-icon">⚡</span>
                    <small>Test will auto-submit immediately after upload or when timer expires</small>
                  </div>
                )}
              </div>
              
              {paperUploadComplete && (
                <div className="upload-success">
                  <p>✅ Answer sheet uploaded successfully!</p>
                  <p>Redirecting to dashboard...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="test-content">
        {/* Question Paper Section */}
        {renderQuestionPaper()}
        
        {/* Questions Section */}
        {renderQuestions()}
        
        {/* Enhanced File Upload Section */}
        <div className="file-upload-section">
          {!answerSheetUrl ? (
            <div className="upload-interface-enhanced">
              {/* Upload Header */}
              <div className="upload-header-enhanced">
                <h4>📄 Answer Sheet Upload</h4>
                {test?.paperSubmissionRequired && (
                  <div className="required-notice">
                    <span className="required-badge">Required</span>
                    <p>Paper submission is required for this test</p>
                  </div>
                )}
                <p>Upload your answer sheets as individual pages. They will be combined into a single PDF.</p>
              </div>

              {/* Pages Grid Container */}
              <div className={styles.pagesGridContainerEnhanced}>
                {/* Existing Pages */}
                {uploadedPages.map((page, index) => (
                  <div key={page.id} className={`${styles.pageBoxEnhanced} ${styles.uploaded}`}>
                    <div className={styles.pageNumberCircle}>{index + 1}</div>
                    <button 
                      className={styles.removePageBtn}
                      onClick={() => removePage(page.id)}
                      disabled={isSubmitted}
                    >
                      ×
                    </button>
                    <div className={styles.pagePreview}>
                      <img src={page.data} alt={`Page ${index + 1}`} />
                    </div>
                    <div className={styles.pageDetails}>
                      <div className={styles.fileName}>{page.filename}</div>
                      <div className={styles.fileStats}>
                        <span className={styles.fileSize}>{(page.compressedSize / 1024).toFixed(1)}KB</span>
                        {page.processTime && (
                          <span className={styles.processTime}>{(page.processTime/1000).toFixed(1)}s</span>
                        )}
                      </div>
                      {page.originalSize && page.compressedSize && (
                        <div className={styles.compressionInfo}>
                          {((page.originalSize - page.compressedSize) / page.originalSize * 100).toFixed(0)}% compressed
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Add Page Box */}
                {!isSubmitted && (
                  <div className={`${styles.pageBoxEnhanced} ${styles.addPage}`}>
                    <div className={`${styles.pageNumberCircle} ${styles.add}`}>+</div>
                    <div className={styles.addPageContent}>
                      <input
                        type="file"
                        accept=".jpg,.jpeg"
                        multiple
                        onChange={handleImageFileUpload}
                        className={styles.fileInputHidden}
                        id="add-page-input"
                        disabled={mobileUploadDetected}
                      />
                      <label htmlFor="add-page-input" className={`${styles.addPageLabel} ${mobileUploadDetected ? styles.disabled : ''}`}>
                        <div className={styles.addPageIcon}>📎</div>
                        <div className={styles.addPageText}>
                          <h5>Add Pages</h5>
                          <p>Choose JPG/JPEG files</p>
                          <small>Multiple files supported</small>
                        </div>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Page Controls */}
              {uploadedPages.length > 0 && (
                <div className="page-controls-enhanced">
                  <div className="page-summary">
                    <div className="page-count">
                      {uploadedPages.length} page{uploadedPages.length !== 1 ? 's' : ''} ready
                    </div>
                    <div className="total-size">
                      Total size: {(uploadedPages.reduce((sum, page) => sum + page.compressedSize, 0) / 1024).toFixed(1)}KB
                    </div>
                  </div>
                  <div className="action-buttons">
                    <button
                      className="btn-convert"
                      onClick={handleAnswerSheetSubmit}
                      disabled={isUploading || answerSheetUrl || mobileUploadDetected}
                    >
                      {mobileUploadDetected ? '📱 Mobile Upload Completed' : 
                       isUploading ? '⏳ Converting & Uploading...' : '📤 Convert to PDF & Upload'}
                    </button>
                    <button
                      className="btn-mobile-upload"
                      onClick={requestMobileUploadLink}
                      disabled={isUploading || answerSheetUrl || mobileUploadDetected}
                      title={mobileUploadDetected ? "Mobile upload already completed" : "Get mobile upload link via email or QR code"}
                    >
                      {mobileUploadDetected ? '✅ Upload Complete' : '📱 Mobile Upload (Email + QR)'}
                    </button>
                  </div>
                </div>
              )}

              {/* Upload Progress */}
              {uploadProgress > 0 && uploadProgress < 100 && (
                <div className="upload-progress">
                  <div className="progress-bar">
                    <div 
                      className="progress-fill"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <span>{uploadProgress}%</span>
                </div>
              )}

              {/* Upload Instructions */}
              <div className="upload-instructions-enhanced">
                <h6>📋 Upload Instructions:</h6>
                <ul>
                  <li>Upload images of your answer sheets one by one</li>
                  <li>Images will be automatically compressed for faster upload</li>
                  <li>Pages will be arranged in the order you upload them</li>
                  <li>All pages will be merged into a single PDF file</li>
                  <li>Supported formats: JPG, JPEG</li>
                </ul>
                
                {/* Mobile Upload Alternative */}
                {uploadedPages.length === 0 && (
                  <div className="mobile-upload-alternative">
                    <hr style={{ margin: '1rem 0', opacity: 0.3 }} />
                    <h6>📱 Alternative: Mobile Upload</h6>
                    <p>Don't have your answer sheets ready on this device? Get upload link via email or QR code!</p>
                    <button
                      className="btn-mobile-upload"
                      onClick={requestMobileUploadLink}
                      disabled={isUploading || answerSheetUrl || mobileUploadDetected}
                    >
                      {mobileUploadDetected ? '✅ Mobile Upload Complete' : '📱 Get Upload Link (Email + QR)'}
                    </button>
                    <small style={{ display: 'block', marginTop: '0.5rem', color: '#6c757d' }}>
                      Link will be sent to {user.email} and expires in 10 minutes
                    </small>
                    
                    {/* QR Code Display */}
                    {showQRCode && mobileUploadUrl && qrCodeExpiry && new Date() < qrCodeExpiry && (
                      <div className="qr-code-section" style={{ 
                        marginTop: '1rem', 
                        padding: '1rem', 
                        backgroundColor: '#f8f9fa', 
                        borderRadius: '8px',
                        textAlign: 'center',
                        border: '2px dashed #dee2e6'
                      }}>
                        <h6 style={{ color: '#495057', marginBottom: '0.5rem' }}>📱 Scan QR Code</h6>
                        <div style={{ 
                          display: 'inline-block', 
                          padding: '12px', 
                          backgroundColor: 'white', 
                          borderRadius: '8px',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                        }}>
                          <QRCode
                            value={mobileUploadUrl}
                            size={180}
                            style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                            viewBox="0 0 256 256"
                          />
                        </div>
                        <p style={{ 
                          fontSize: '12px', 
                          color: '#6c757d', 
                          marginTop: '0.5rem',
                          marginBottom: '0'
                        }}>
                          Scan with your mobile camera or check email
                        </p>
                        <small style={{ color: '#dc3545', fontSize: '11px' }}>
                          Expires in {Math.max(0, Math.ceil((qrCodeExpiry - new Date()) / 60000))} minutes
                        </small>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Early Paper Upload Option */}
              {test?.paperUploadAllowedDuringTest && !showPaperUploadModal && uploadedPages.length > 0 && (
                <div className="early-upload-option">
                  <button
                    className="btn btn-special"
                    onClick={showEarlyPaperUpload}
                    disabled={isSubmitted}
                  >
                    📄 Upload Answer Sheet & Exit Early
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="upload-success">
              <div className="success-message">
                <div className="success-icon">✅</div>
                <h4>Answer Sheet Uploaded Successfully!</h4>
                <p>Your answer sheet has been uploaded and will be reviewed.</p>
              </div>
            </div>
          )}
        </div>
        
        {/* Submit Section */}
        <div className="submit-section">
          <div className="submit-info">
            {test?.paperSubmissionRequired && !answerSheetUrl && (
              <div className="warning-notice">
                ⚠️ Paper submission is required before test submission
              </div>
            )}
            <p>Double-check your answers before submitting. You cannot make changes after submission.</p>
          </div>
          
          {/* Mobile Upload Detection Indicator */}
          {mobileUploadDetected && (
            <div className="alert alert-success" style={{ 
              margin: '1rem 0', 
              padding: '0.75rem', 
              backgroundColor: '#d4edda', 
              border: '1px solid #c3e6cb', 
              borderRadius: '0.375rem',
              color: '#155724'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.2rem' }}>📱</span>
                <div>
                  <strong>Mobile Upload Detected!</strong>
                  <br />
                  <small>
                    {mobileUploadCount} file(s) uploaded via mobile. Ready to submit!
                  </small>
                </div>
              </div>
            </div>
          )}
          
          <button
            className={`btn btn-large ${
              test?.paperSubmissionRequired && !answerSheetUrl 
                ? 'btn-disabled' 
                : 'btn-success'
            }`}
            onClick={() => handleSubmit(false)}
            disabled={
              isSubmitting || 
              isSubmitted || 
              (test?.paperSubmissionRequired && !answerSheetUrl)
            }
          >
            {isSubmitting ? '⏳ Submitting...' : '📝 Submit Test'}
          </button>
        </div>
      </div>
      
      {/* Fullscreen Prompt */}
      {showFullscreenPrompt && renderFullscreenPrompt()}

      {/* Persistent Camera Preview Widget */}
      {isCameraActive && (
        <div style={{
          position: 'fixed',
          bottom: cameraMinimized ? '20px' : '20px',
          right: '20px',
          width: cameraMinimized ? '60px' : '200px',
          height: cameraMinimized ? '60px' : '150px',
          backgroundColor: '#000',
          border: '2px solid #007bff',
          borderRadius: '8px',
          overflow: 'hidden',
          zIndex: 1000,
          transition: 'all 0.3s ease',
          cursor: 'pointer'
        }}>
          {/* Camera preview video */}
          <video 
            style={{
              width: '100%',
              height: cameraMinimized ? '100%' : 'calc(100% - 30px)',
              objectFit: 'cover',
              backgroundColor: '#000'
            }}
            autoPlay
            playsInline
            muted
            ref={(el) => {
              if (el && videoRef.current && videoRef.current.srcObject) {
                // Use the same stream as the main video element
                el.srcObject = videoRef.current.srcObject;
                const playVideo = () => {
                  el.play().catch(error => {
                    console.warn('Preview video play failed:', error);
                  });
                };
                
                if (el.readyState >= 2) {
                  playVideo();
                } else {
                  el.addEventListener('loadeddata', playVideo, { once: true });
                }
              }
            }}
            onClick={() => setCameraMinimized(!cameraMinimized)}
          />
          
          {/* Control bar - single camera status */}
          {!cameraMinimized && (
            <div style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '30px',
              backgroundColor: 'rgba(0,0,0,0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 8px',
              fontSize: '12px',
              color: 'white'
            }}>
              <span>📹 Recording</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setCameraMinimized(true);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                ➖
              </button>
            </div>
          )}
          
          {/* Minimized state indicator */}
          {cameraMinimized && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              fontSize: '20px',
              color: 'white'
            }}>
              📹
            </div>
          )}
        </div>
      )}
    </div>
  );
};
export default TestInterface;
