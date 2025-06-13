import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../App';
import { toast } from 'react-toastify';
import LoadingSpinner from '../LoadingSpinner';
import axios from 'axios';

const TestInterface = () => {
  const { testId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

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

  // Enhanced auto-submit with submission lock
  const handleAutoSubmit = useCallback(async (reason) => {
    if (!test || isSubmitting || isSubmitted || submissionLockRef.current) return;

    console.log(`🔒 Auto-submit triggered: ${reason}`);
    submissionLockRef.current = true; // Lock submissions immediately
    const reasons = {
      time_limit: '⏰ Time limit reached',
      violations: '⚠️ Maximum violations exceeded',
      window_focus: '🪟 Window focus lost too many times'
    };

    toast.error(`${reasons[reason] || reason}! Test will be submitted automatically.`, {
      toastId: 'auto-submit-notification'
    });
    await new Promise(resolve => setTimeout(resolve, 5000));
    await handleSubmit(true, reason);
  }, [test, isSubmitting, isSubmitted]);

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

  const fetchTest = async () => {
    try {
      setLoading(true);
      console.log('🔍 Fetching test details for:', testId);

      const response = await axios.get(`/api/student/test/${testId}`);

      if (response.data.success) {
        const testData = response.data.test;
        const key = getFileKeyFromUrl(testData.questionPaperURL);
      if (key) {
        const { data: urlData } = await axios.get(`/api/student/answer-sheet/${key}`);
        if (urlData.success) {
          testData.questionPaperURL = urlData.url;
        }
      }
        setTest(testData);
        console.log('✅ Test loaded:', response.data.test.title);

        const savedAnswers = localStorage.getItem(`test-answers-${testId}`);
        if (savedAnswers) {
          try {
            setAnswers(JSON.parse(savedAnswers));
            toast.info('📝 Previous answers restored');
          } catch (e) {
            console.warn('Failed to load saved answers');
          }
        }
      } else {
        throw new Error(response.data.message || 'Failed to load test');
      }
    } catch (error) {
      console.error('❌ Error fetching test:', error);
      setError(error.response?.data?.message || 'Failed to load test');
      toast.error('Failed to load test. Redirecting to dashboard...');

      setTimeout(() => navigate('/student'), 3000);
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

  const handleAnswerChange = (questionIndex, value) => {
    if (isSubmitted) return;

    setAnswers(prev => ({
      ...prev,
      [questionIndex]: value
    }));

    toast.success('💾 Answer saved', { autoClose: 1000, toastId: 'save-indicator' });
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

  const url = new URL(test.questionPaperURL);
  const expiresAt = url.searchParams.get('X-Amz-Expires');
  
  // Refresh 2 minutes before expiration
  if (Date.now() + 120000 > new Date(expiresAt).getTime()) {
    // Call your /api/files/signed-url endpoint
  }
};




  // Enhanced submit function with multiple submission prevention
  const handleFileUpload = useCallback(async (file) => {
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

    // prefer answerSheetUrl, fallback to url
    const sheetUrl = response.data.answerSheetUrl || response.data.url;
    if (!sheetUrl) {
      throw new Error('No URL returned from upload');
    }

    return sheetUrl;
  }, [testId]);

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

    // 1) Gentle warning if no answer sheet

    if (!answerSheetUrl) {
      const ok = window.confirm(
        'No Answer Sheet Uploaded.\nAre you sure you want to exit without uploading?'
      );
      if (!ok) return;
    }

    // 2) Final exit confirmation
    const proceed = window.confirm(
      'Exit Test\nYour progress will be saved and you cannot restart.\nContinue?'
    );
    if (!proceed) return;


    try {
      setIsSubmitting(true);
      submissionLockRef.current = true;

      const token = localStorage.getItem('token');
      const { data } = await axios.post(
        `/api/student/test/${testId}/exit`,
        {}, // no body
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (data.success) {
        toast.success('Test exited. You cannot restart.');
        cleanup();
        // redirect after a short delay so user sees toast
        setTimeout(() => navigate('/student'), 1500);
      } else {
        throw new Error(data.message || 'Exit failed');
      }
    } catch (err) {
      console.error('Exit error:', err);
      toast.error('Failed to exit test: ' + err.message);
      submissionLockRef.current = false;
      setIsSubmitting(false);
    }
  }, [testId, cleanup, navigate]);

  const handleSubmit = useCallback(async () => {
    if (isSubmitting || isSubmitted || submissionLockRef.current) return;

    submissionLockRef.current = true;
    setIsSubmitting(true);

    try {
      // Build the payload; include URL if we have one
      const payload = {
        answers,
        answerSheetUrl,
        violations,
        autoSubmit,
        autoSubmitReason,
        timeTaken,
        browserInfo
      };

      const token = localStorage.getItem('token');
      const { data: res } = await axios.post(
        `/api/student/test/${testId}/submit`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.success) {
        setIsSubmitted(true);
        toast.success('🎉 Test submitted!');
        cleanup();
        // clear localStorage keys…
        navigate('/student', { state: { resultId: res.resultId } });
      } else {
        throw new Error(res.message || 'Submission failed');
      }
    } catch (err) {
      console.error('Submit error:', err);
      toast.error('❌ Submission error: ' + err.message);
      submissionLockRef.current = false;
    } finally {
      setIsSubmitting(false);
    }
  }, [
    isSubmitting,
    isSubmitted,
    submissionLockRef,
    answers,
    violations,
    answerSheetUrl,
    autoSubmit,
    autoSubmitReason,
    timeTaken,
    browserInfo,
    testId,
    cleanup,
    navigate
  ]);
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

          <div className="pdf-container">
            <iframe
              src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=1&view=fitH`} 
              title="Question Paper"
              className="pdf-viewer"
              width="100%"
              height="500px"
              onError={() => {
                console.warn('PDF iframe failed');
                setPdfError(true);
              }}
              onLoad={() => {
                console.log('✅ PDF loaded successfully');
                setPdfError(false);
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
                onClick={() => handlePdfZoom('out')}
                disabled={pdfScale <= 0.5}
                title="Zoom Out (Ctrl+-)"
              >
                🔍➖
              </button>
              <span className="zoom-display">{Math.round(pdfScale * 100)}%</span>
              <button
                className="zoom-btn"
                onClick={() => handlePdfZoom('in')}
                disabled={pdfScale >= 3}
                title="Zoom In (Ctrl++)"
              >
                🔍➕
              </button>
              <button
                className="zoom-btn"
                onClick={() => setPdfScale(1)}
                title="Reset Zoom (Ctrl+0)"
              >
                🎯
              </button>
            </div>

            {/* PDF Content */}
            <div className="better-viewer-content">
              <div
                className="pdf-container-better"
                style={{
                  transform: `scale(${pdfScale})`,
                  transformOrigin: 'top center',
                  transition: 'transform 0.3s ease'
                }}
              >
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

      {/* Status Bar - Hidden in better viewer */}
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
            📝 Answers: {Object.keys(answers).length}
          </span>
        </div>
      </div>

      {/* Violation Warning - Hidden in better viewer */}
      {violations.length > 0 && !isBetterViewer && (
        <div className="violations-warning">
          ⚠️ SECURITY VIOLATION DETECTED! {violations.length}/3 warnings used.
          {violations.length >= 2 && ' NEXT VIOLATION WILL AUTO-SUBMIT YOUR TEST!'}
        </div>
      )}

      {/* Test Content - Hidden in better viewer */}
      <div className={`test-content ${isBetterViewer ? 'hidden' : ''}`}>
        {renderQuestionPaper()}
        {renderQuestions()}

        {/* Answer Sheet Upload */}
        <div className="answer-upload">
          <h3>📎 Upload Answer Sheet (Optional)</h3>
          <p className="upload-description">
            You can upload a scanned copy or photo of your handwritten answers as additional submission.
          </p>

          <div className="file-upload-area">
            <input
              type="file"
              id="answerFile"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileSelect}
              className="file-input"
              disabled={isSubmitted}
            />
            <label htmlFor="answerFile" className={`file-label ${isSubmitted ? 'disabled' : ''}`}>
              {answerFile ? (
                <span className="file-selected">
                  ✅ {answerFile.name} ({(answerFile.size / 1024 / 1024).toFixed(2)} MB)
                </span>
              ) : (
                <span className="file-placeholder">
                  📁 Choose file (PDF, JPG, PNG - Max 10MB)
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

      {/* Submit Section - Hidden in better viewer */}
      <div className={`test-footer ${isBetterViewer ? 'hidden' : ''}`}>
        <div className="submit-info">
          <p>
            <strong>⚠️ Important:</strong> Once you submit, you cannot make any changes.
            Please review your answers before submitting.
          </p>
        </div>

        <button
          onClick={handleAnswerSheetSubmit}
          disabled={isUploading || !!answerSheetUrl || isSubmitted}
          className="btn btn-secondary"
        >
          {isUploading
            ? `Uploading… (${uploadProgress}%)`
            : answerSheetUrl
              ? 'Answer Sheet Uploaded'
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

      {/* Submission Modal Overlay */}
      {isSubmitting && (
        <div className="submission-overlay">
          <div className="submission-modal">
            <div className="loading-spinner large"></div>
            <h3>Submitting Your Test...</h3>
            <p>Please do not close this window or navigate away.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default TestInterface;
