import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../App';
import { toast } from 'react-toastify';
import LoadingSpinner from '../LoadingSpinner';
import { useOnlineStatus } from '../../hooks/useOnlineStatus'; // Add this import
import './TestInterface.module.css';
import offlineHandler from '../../utils/offlineHandler';
import axios from 'axios';
import Swal from 'sweetalert2';
import { confirmDelete, confirmAction, successAlert, errorAlert } from '../../utils/SweetAlerts';
const TestInterface = () => {
  const { testId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
   const [offlineAnswers, setOfflineAnswers] = useState({});
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [pendingSave, setPendingSave] = useState(false);
  const { isOnline, queueRequest } = useOnlineStatus();
  const mountedRef = useRef(true);
  const [autoSubmit, setAutoSubmit] = useState(false);
  const [autoSubmitReason, setAutoSubmitReason] = useState('');
  const timerRef = useRef(null);
  const violationTimeoutRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [answerSheetUrl, setAnswerSheetUrl] = useState(null);
  const autoSaveRef = useRef(null);
  const pdfViewerRef = useRef(null);
  const testStartTimeRef = useRef(null);
  const submissionLockRef = useRef(false); // Submission lock to prevent multiple submissions
  const [timeTaken, setTimeTaken] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const iv = setInterval(() => {
      setTimeTaken(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(iv);
  }, []);
   useEffect(() => {
    console.log('🌐 Initializing offline handler for test interface...');
    const cleanup = offlineHandler.init();
    
    return () => {
      if (cleanup) cleanup();
    };
  }, []);
  useEffect(() => {
    if (isOnline && pendingSave) {
      console.log('🔄 Back online - syncing offline answers...');
      syncOfflineAnswers();
    }
  }, [isOnline, pendingSave]);
  // Capture browser info once
  const [browserInfo] = useState({
    userAgent: navigator.userAgent,
    screenResolution: `${window.screen.width}x${window.screen.height}`,
    viewport: `${window.innerWidth}x${window.innerHeight}`
  });
  // Core test state
  const [test, setTest] = useState(null);
  const [answers, setAnswers] = useState({});
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false); // Track if test is submitted
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [testStarted, setTestStarted] = useState(false);
  const [timerInitialized, setTimerInitialized] = useState(false);

  // File upload state
  const [answerFile, setAnswerFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Proctoring state
  const [violations, setViolations] = useState([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [warningShown, setWarningShown] = useState(false);
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(false);
  const [focusLostCount, setFocusLostCount] = useState(0);
  const [lastFocusTime, setLastFocusTime] = useState(Date.now());

  // PDF and viewer state
  const [pdfError, setPdfError] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfUrl, setPdfUrl] = useState('');
  const [isBetterViewer, setIsBetterViewer] = useState(false);
  const [pdfScale, setPdfScale] = useState(1);

  // Enhanced violation detection
  const recordViolation = useCallback((type, details, severity = 'medium') => {
    if (isSubmitted || submissionLockRef.current) return; // Don't record violations after submission

    const violation = {
      type,
      timestamp: new Date().toISOString(),
      details,
      severity,
      sessionTime: testStartTimeRef.current ? Date.now() - testStartTimeRef.current : 0
    };

    setViolations(prev => {
      const newViolations = [...prev, violation];
      console.log(`🚨 Violation recorded: ${type} (${newViolations.length}/3)`);

      localStorage.setItem(`test-violations-${testId}`, JSON.stringify(newViolations));

      if (newViolations.length >= 3 && !submissionLockRef.current) {
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
        const remaining = 3 - newViolations.length;
        toast.error(`🚨 VIOLATION ${newViolations.length}/3: ${type}! ${remaining} warnings remaining.`, {
          autoClose: 4000,
          toastId: `violation-${newViolations.length}`
        });
      }

      return newViolations;
    });
  }, [testId, isSubmitted]);
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
      recordViolation('Window Blur', 'Window lost focus', 'medium');
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
  const cleanup = () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange, true);
    document.removeEventListener('contextmenu', handleRightClick, true);
    document.removeEventListener('keydown', handleKeyDown, true);
    document.removeEventListener('fullscreenchange', handleFullscreenChange, true);
    window.removeEventListener('blur', handleWindowFocus, true);
    document.removeEventListener('mouseleave', handleMouseLeave);

    if (timerRef.current) clearInterval(timerRef.current);
    if (violationTimeoutRef.current) clearTimeout(violationTimeoutRef.current);
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);

    document.body.style.overflow = 'auto';

    if (document.exitFullscreen && document.fullscreenElement) {
      document.exitFullscreen().catch(err => console.log('Exit fullscreen error:', err));
    }
  };
  // Enhanced auto-submit with submission lock
   const handleSubmit = useCallback(async (isAutoSubmit = false, autoSubmitReason = null) => {
    if (isSubmitting || isSubmitted || submissionLockRef.current) return;

    // Check if offline
    if (!isOnline && !isAutoSubmit) {
      const result = await Swal.fire({
        title: 'You are offline',
        text: 'Your submission will be queued and sent when you reconnect to the internet.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#f59e0b',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Queue Submission',
        cancelButtonText: 'Wait for Connection'
      });

      if (!result.isConfirmed) return;
    }

    // Skip confirmation for auto-submit
    if (!isAutoSubmit) {
      const result = await Swal.fire({
        title: 'Submit Test?',
        html: `
        <p>Are you sure you want to submit your test?</p>
        <p><strong>You cannot make changes after submission.</strong></p>
        ${!isOnline ? '<p style="color: #f59e0b;">⚠️ You are offline - submission will be queued</p>' : ''}
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
        offlineAnswers: Object.keys(offlineAnswers).length > 0 ? offlineAnswers : null
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
        setIsSubmitted(true);
        
        // Clear offline data
        setOfflineAnswers({});
        localStorage.removeItem(`test-answers-${testId}`);
        localStorage.removeItem(`test-violations-${testId}`);

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
    submissionLockRef,
    answers,
    offlineAnswers,
    violations,
    answerSheetUrl,
    timeTaken,
    browserInfo,
    testId,
    cleanup,
    navigate,
    isOnline,
    queueRequest
  ]);

 const handleAutoSubmit = useCallback(async (reason) => {
  if (!test || isSubmitting || isSubmitted || submissionLockRef.current) return;

  console.log(`🔒 Auto-submit triggered: ${reason}`);
  submissionLockRef.current = true;

  const reasons = {
    time_limit: '⏰ Time limit reached',
    violations: '⚠️ Maximum violations exceeded',
    window_focus: '🪟 Window focus lost too many times',
    tab_switch: '🔄 Too many tab switches detected',
    fullscreen_exit: '📺 Exited fullscreen too many times'
  };

  const reasonText = reasons[reason] || reason;

  // Show countdown with SweetAlert2
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
}, [test, isSubmitting, isSubmitted, handleSubmit]);


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

  // Setup proctoring when test starts
  useEffect(() => {
    if (test && !testStarted && !loading && !isSubmitted) {
      setTestStarted(true);
      testStartTimeRef.current = Date.now();
      setLastFocusTime(Date.now());

      if (!timerInitialized) {
        const savedStartTime = localStorage.getItem(`test-start-time-${testId}`);
        const savedDuration = localStorage.getItem(`test-duration-${testId}`);
        const savedTestId = localStorage.getItem(`current-test-id`);

        if (savedStartTime && savedDuration && savedTestId === testId) {
          const startTime = parseInt(savedStartTime);
          const duration = parseInt(savedDuration);
          const elapsed = Math.floor((Date.now() - startTime) / 1000);
          const remaining = Math.max(0, (duration * 60) - elapsed);

          setTimeRemaining(remaining);
          setTimerInitialized(true);
          testStartTimeRef.current = startTime;

          if (remaining <= 0) {
            toast.error('⏰ Test time has expired!');
            handleAutoSubmit('time_limit');
            return;
          } else {
            toast.info(`⏰ Test session restored. Time remaining: ${Math.floor(remaining / 60)}:${(remaining % 60).toString().padStart(2, '0')}`);
          }
        } else {
          setTimeRemaining(test.duration * 60);
          setTimerInitialized(true);
          testStartTimeRef.current = Date.now();

          localStorage.setItem(`test-start-time-${testId}`, Date.now().toString());
          localStorage.setItem(`test-duration-${testId}`, test.duration.toString());
          localStorage.setItem(`current-test-id`, testId);

          toast.success(`🚀 Test started! You have ${test.duration} minutes to complete.`);
        }
      }

      setPdfUrl(test.questionPaperURL);
      setupProctoring();

      const savedViolations = localStorage.getItem(`test-violations-${testId}`);
      if (savedViolations) {
        try {
          const parsedViolations = JSON.parse(savedViolations);
          setViolations(parsedViolations);

          // Check if violations already reached limit
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
  }, [test, testStarted, loading, testId, timerInitialized, handleAutoSubmit, isSubmitted]);

  // Timer effect
  useEffect(() => {
    if (!test || !testStarted || isSubmitting || timeRemaining <= 0 || !timerInitialized || isSubmitted) return;

    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        const newTime = prev - 1;

        if (newTime > 0) {
          localStorage.setItem(`test-remaining-${testId}`, newTime.toString());
        }

        if (newTime <= 0 && !submissionLockRef.current) {
          clearInterval(timerRef.current);
          handleAutoSubmit('time_limit');
          return 0;
        }

        return newTime;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [test, testStarted, isSubmitting, timeRemaining, handleAutoSubmit, timerInitialized, testId, isSubmitted]);

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

  // Warning for page refresh/navigation
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (testStarted && !isSubmitting && timeRemaining > 0 && !isSubmitted) {
        e.preventDefault();
        e.returnValue = 'Are you sure you want to refresh? Your test session will continue but refreshing may cause issues.';
        return e.returnValue;
      }
    };

    const handleUnload = () => {
      if (testStarted && !isSubmitting && timeRemaining > 0 && !isSubmitted) {
        localStorage.setItem(`test-remaining-${testId}`, timeRemaining.toString());
        localStorage.setItem(`test-last-save-${testId}`, Date.now().toString());
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('unload', handleUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('unload', handleUnload);
    };
  }, [testStarted, isSubmitting, timeRemaining, testId, isSubmitted]);
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
        setPdfUrl(response.data.test.questionPaperURL);
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
      const urlObj = new URL(url);
      return urlObj.pathname.split('/').pop(); // Extracts "file-key" from "/bucket-name/file-key"
    } catch {
      return null;
    }
  };
  const setupProctoring = () => {
    document.addEventListener('visibilitychange', handleVisibilityChange, true);
    document.addEventListener('contextmenu', handleRightClick, true);
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('fullscreenchange', handleFullscreenChange, true);

    window.addEventListener('blur', handleWindowFocus, true);
    window.addEventListener('focus', () => {
      setLastFocusTime(Date.now());
      console.log('🔍 Window regained focus');
    }, true);

    document.addEventListener('mouseleave', handleMouseLeave);

    console.log('🔒 Enhanced proctoring system activated');

    setTimeout(() => {
      if (!document.fullscreenElement && !isBetterViewer && !isSubmitted) {
        setShowFullscreenPrompt(true);
      }
    }, 2000);
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
    toast.success(`📎 File selected: ${file.name}`);
  };



  // inside TestInterface.js
  // In TestInterface.js
  const refreshPdfUrl = async () => {
    if (!test?.questionPaperURL) return;
    setPdfLoading(true);
    try {
      const signedUrl = await fetchFileUrl('questionpaper', test.questionPaperURL);
      setPdfUrl(signedUrl);
      toast.success('✅ Question paper refreshed');
    } catch (error) {
      toast.error('❌ Failed to refresh question paper');
    } finally {
      setPdfLoading(false);
    }
  };





  // Enhanced submit function with multiple submission prevention
  const handleFileUpload = useCallback(async (file) => {
    const makeUploadRequest = async () => {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('answerSheet', file);

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

      return response.data.answerSheetUrl || response.data.url;
    };

    return await queueRequest(makeUploadRequest, {
      description: 'Upload answer sheet'
    });
  }, [testId, queueRequest]);

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
    if (!answerFile) {
      toast.error('Please select a file first');
      return;
    }

    try {
      setIsUploading(true);
      const url = await handleFileUpload(answerFile);
      setAnswerSheetUrl(url);
      toast.success('✅ Answer sheet uploaded successfully!');
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('❌ ' + err.message);
    } finally {
      setIsUploading(false);
    }
  }, [answerFile, answerSheetUrl, isUploading, handleFileUpload]);

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
        { violations }, // Include violations in exit
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
  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

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
    if (!pdfUrl && !test.questionPaperURL) return null;

    const effectivePdfUrl = pdfUrl || test.questionPaperURL;

    return (
      <>
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
              src={test.questionPaperURL}
              title="Question Paper"
              className="pdf-viewer"
              style={{ width: '100%', height: '100%', border: 0 }}
              onError={(e) => {
                console.error('PDF load error:', e);
                toast.error('Failed to load PDF. Retrying...');
              }}
              onLoad={() => {
                console.log('PDF loaded successfully');
              }}
              allow="autoplay"
            />
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

            {/* Timer badge in corner */}
            <div className="better-viewer-timer">
              ⏰ {formatTime(timeRemaining)}
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
                    src={`${effectivePdfUrl}#toolbar=0&navpanes=0&scrollbar=1`}
                    title="Question Paper Better Viewer"
                    className="pdf-viewer-better"
                    width="100%"
                    height="100%"
                    onError={() => setPdfError(true)}
                    onLoad={() => setPdfError(false)}
                  />
                  {/* Popout button blocker overlay */}
                  <div className="popout-blocker-overlay"></div>
                </div>
              </div>
            </div>
          </div>
        )}

      </>
    );
  };

  const renderQuestions = () => {
    if (!test.questions || test.questions.length === 0) return null;

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
    {renderFullscreenPrompt()}
    
    {/* Offline Warning Banner */}
    {!isOnline && !isBetterViewer && (
      <div className="offline-warning-banner">
        <div className="offline-content">
          <span className="offline-icon">📱</span>
          <div className="offline-text">
            <strong>You are currently offline</strong>
            <small>Your answers are being saved locally and will sync when you reconnect</small>
          </div>
          {pendingSave && (
            <span className="pending-indicator">
              {Object.keys(offlineAnswers).length} changes pending
            </span>
          )}
        </div>
      </div>
    )}

    {/* Test Header - Hidden in better viewer */}
    <div className={`test-header ${isBetterViewer ? 'hidden' : ''}`}>
      <div className="test-info">
        <h1>{test.title}</h1>
        <div className="test-meta">
          <span>{test.subject}</span>
          <span>•</span>
          <span>Class {test.class}</span>
          <span>•</span>
          <span>{test.board}</span>
          <span>•</span>
          <span>{test.totalMarks} marks</span>
          {!isOnline && <span className="offline-badge">📱 OFFLINE</span>}
        </div>
      </div>

      <div className="test-controls">
        <div className="timer-container">
          <span className={`timer ${timeRemaining < 300 ? 'warning' : timeRemaining < 600 ? 'caution' : ''}`}>
            ⏰ {formatTime(timeRemaining)}
          </span>
        </div>

        <div className="control-buttons">
          {!isFullscreen && (
            <div className="fullscreen-warning">
              <button
                className="btn btn-warning btn-pulse"
                onClick={requestFullscreen}
                title="Enter fullscreen mode (Required)"
                disabled={isSubmitted}
              >
                ⚠️ Enter Fullscreen (Required)
              </button>
            </div>
          )}

          {isFullscreen && (
            <div className="fullscreen-status">
              <span className="status-badge success">
                ✅ Fullscreen Active
              </span>
              <button
                className="btn btn-sm btn-outline"
                onClick={exitFullscreen}
                title="Exit fullscreen"
                disabled={isSubmitted}
              >
                🔄 Exit Fullscreen
              </button>
            </div>
          )}
        </div>
      </div>
    </div>

    {/* Enhanced Status Bar with Offline Status - Hidden in better viewer */}
    <div className={`status-bar ${isBetterViewer ? 'hidden' : ''}`}>
      <div className="status-item">
        <span className={`status-indicator ${violations.length === 0 ? 'good' : violations.length < 3 ? 'warning' : 'danger'}`}>
          🚨 Violations: {violations.length}/3
        </span>
      </div>

      <div className="status-item">
        <span className={`status-indicator ${isFullscreen ? 'good' : 'danger'}`}>
          🖥️ Fullscreen: {isFullscreen ? 'Active ✅' : 'REQUIRED ⚠️'}
        </span>
      </div>

      <div className="status-item">
        <span className="status-indicator good">
          📝 Answers: {Object.keys(answers).length + Object.keys(offlineAnswers).length}
        </span>
      </div>

      {/* Online/Offline Status Indicator */}
      <div className="status-item">
        <span className={`status-indicator ${isOnline ? 'good' : 'warning'}`}>
          🌐 {isOnline ? 'Online ✅' : 'Offline 📱'}
        </span>
      </div>

      {/* Pending Sync Indicator */}
      {pendingSave && (
        <div className="status-item">
          <span className="status-indicator warning">
            ⏳ Pending Sync ({Object.keys(offlineAnswers).length})
          </span>
        </div>
      )}

      {/* Last Sync Time */}
      {lastSyncTime && !isOnline && (
        <div className="status-item">
          <span className="status-indicator info">
            🕒 Last Sync: {new Date(lastSyncTime).toLocaleTimeString()}
          </span>
        </div>
      )}
    </div>

    {/* Violation Warning - Hidden in better viewer */}
    {violations.length > 0 && !isBetterViewer && (
      <div className="violations-warning">
        ⚠️ SECURITY VIOLATION DETECTED! {violations.length}/3 warnings used.
        {violations.length >= 2 && ' NEXT VIOLATION WILL AUTO-SUBMIT YOUR TEST!'}
        {!isOnline && (
          <span className="offline-violation-note">
            📱 Violations are being tracked offline
          </span>
        )}
      </div>
    )}

    {/* Test Content - Hidden in better viewer */}
    <div className={`test-content ${isBetterViewer ? 'hidden' : ''}`}>
      {renderQuestionPaper()}
      {renderQuestions()}

      {/* Answer Sheet Upload with Offline Handling */}
      <div className="answer-upload">
        <h3>📎 Upload Answer Sheet (Optional)</h3>
        <p className="upload-description">
          You can upload a scanned copy or photo of your handwritten answers as additional submission.
          {!isOnline && (
            <span className="offline-upload-note">
              📱 <strong>Note:</strong> File upload requires internet connection. Upload will be available when you're back online.
            </span>
          )}
        </p>

        <div className="file-upload-area">
          <input
            type="file"
            id="answerFile"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={handleFileSelect}
            className="file-input"
            disabled={isSubmitted || !isOnline}
          />
          <label htmlFor="answerFile" className={`file-label ${isSubmitted || !isOnline ? 'disabled' : ''}`}>
            {answerFile ? (
              <span className="file-selected">
                ✅ {answerFile.name} ({(answerFile.size / 1024 / 1024).toFixed(2)} MB)
                {!isOnline && <span className="offline-file-note"> - Upload when online</span>}
              </span>
            ) : (
              <span className="file-placeholder">
                {!isOnline 
                  ? '📁 File upload unavailable (Offline)' 
                  : '📁 Choose file (PDF, JPG, PNG - Max 10MB)'
                }
              </span>
            )}
          </label>
        </div>

        {uploadProgress > 0 && (
          <div className="upload-progress">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <span className="progress-text">{uploadProgress}% uploaded</span>
          </div>
        )}
      </div>
    </div>

    {/* Enhanced Submit Section with Offline Support - Hidden in better viewer */}
    <div className={`test-footer ${isBetterViewer ? 'hidden' : ''}`}>
      <div className="submit-info">
        <p>
          <strong>⚠️ Important:</strong> Once you submit, you cannot make any changes.
          Please review your answers before submitting.
        </p>
        {!isOnline && (
          <p className="offline-submit-info">
            📱 <strong>Offline Mode:</strong> Your submission will be queued and sent when you reconnect to the internet.
          </p>
        )}
        {pendingSave && (
          <p className="pending-sync-info">
            ⏳ <strong>Pending Changes:</strong> {Object.keys(offlineAnswers).length} answer(s) waiting to sync.
          </p>
        )}
      </div>

      <div className="footer-buttons">
        <button
          onClick={handleAnswerSheetSubmit}
          disabled={isUploading || !!answerSheetUrl || isSubmitted || !isOnline}
          className="btn btn-secondary"
          title={!isOnline ? 'File upload requires internet connection' : ''}
        >
          {isUploading
            ? `Uploading… (${uploadProgress}%)`
            : answerSheetUrl
              ? 'Answer Sheet Uploaded ✅'
              : !isOnline
                ? 'Upload Unavailable (Offline) 📱'
                : 'Submit Answer Sheet'
          }
        </button>

        <button
          className="btn btn-outline-danger"
          onClick={handleExitTest}
          disabled={isSubmitting || isSubmitted}
          style={{ marginLeft: '1rem' }}
        >
          Exit Test
        </button>
      </div>

      {/* Offline Status Summary */}
      {!isOnline && (
        <div className="offline-status-summary">
          <div className="offline-summary-content">
            <h4>📱 Offline Mode Active</h4>
            <div className="offline-stats">
              <span>✅ {Object.keys(answers).length} Answers Saved</span>
              {Object.keys(offlineAnswers).length > 0 && (
                <span>⏳ {Object.keys(offlineAnswers).length} Pending Sync</span>
              )}
              <span>🚨 {violations.length} Violations Recorded</span>
            </div>
            <small className="offline-disclaimer">
              All your progress is being saved locally. When you reconnect, everything will sync automatically.
            </small>
          </div>
        </div>
      )}
    </div>

    {/* Enhanced Submission Modal with Offline Support */}
    {isSubmitting && (
      <div className="submission-overlay">
        <div className="submission-modal">
          <div className="loading-spinner large"></div>
          <h3>
            {!isOnline ? 'Queuing Your Test Submission...' : 'Submitting Your Test...'}
          </h3>
          <p>Please do not close this window or navigate away.</p>
          {!isOnline && (
            <div className="offline-submission-details">
              <p className="offline-submission-note">
                📱 Your submission will be sent automatically when you reconnect to the internet.
              </p>
              <div className="queued-data-summary">
                <small>Queued for submission:</small>
                <ul>
                  <li>✅ {Object.keys(answers).length + Object.keys(offlineAnswers).length} Answers</li>
                  <li>🚨 {violations.length} Security Events</li>
                  <li>⏱️ {Math.floor(timeTaken / 60)}:{(timeTaken % 60).toString().padStart(2, '0')} Time Taken</li>
                  {answerSheetUrl && <li>📎 Answer Sheet File</li>}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    )}

    {/* Connection Status Toast for Better Viewer */}
    {isBetterViewer && !isOnline && (
      <div className="better-viewer-offline-indicator">
        <span className="offline-indicator-badge">
          📱 OFFLINE - Answers saving locally
        </span>
      </div>
    )}
  </div>
);

};

export default TestInterface;