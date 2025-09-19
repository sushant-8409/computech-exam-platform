import React, { useState, useEffect } from 'react';
import './PWAInstallPrompt.css';

const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Detect device type and installation status
    const userAgent = window.navigator.userAgent;
    const isIOSDevice = /iPad|iPhone|iPod/.test(userAgent);
    const isAndroidDevice = /Android/.test(userAgent);
    
    setIsIOS(isIOSDevice);
    setIsAndroid(isAndroidDevice);

    // Check if app is already installed or running standalone
    const isAlreadyInstalled = 
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true ||
      localStorage.getItem('pwa-installed') === 'true';
    
    setIsStandalone(isAlreadyInstalled);

    if (isAlreadyInstalled) {
      console.log('App is already installed');
      return;
    }

    // Check if user dismissed recently
    const dismissed = localStorage.getItem('install-prompt-dismissed');
    if (dismissed && Date.now() < parseInt(dismissed)) {
      console.log('Install prompt was recently dismissed');
      return;
    }

    // Listen for beforeinstallprompt event (Android Chrome)
    const handleBeforeInstallPrompt = (e) => {
      console.log('beforeinstallprompt event fired');
      e.preventDefault();
      setDeferredPrompt(e);
      
      // Show prompt after a delay to avoid interrupting user
      setTimeout(() => {
        setShowInstallPrompt(true);
      }, 5000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // For iOS devices, show manual install prompt
    if (isIOSDevice && !isAlreadyInstalled) {
      // Check if it's Safari (required for iOS installation)
      const isSafari = /Safari/.test(userAgent) && !/Chrome|CriOS|FxiOS/.test(userAgent);
      
      if (isSafari) {
        setTimeout(() => {
          setShowInstallPrompt(true);
        }, 5000);
      }
    }

    // For Android devices without beforeinstallprompt support
    if (isAndroidDevice && !isAlreadyInstalled) {
      setTimeout(() => {
        if (!deferredPrompt) {
          setShowInstallPrompt(true);
        }
      }, 8000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [deferredPrompt]);

  const handleInstall = async () => {
    if (deferredPrompt) {
      console.log('Triggering install prompt');
      deferredPrompt.prompt();
      
      const { outcome } = await deferredPrompt.userChoice;
      console.log('User choice:', outcome);
      
      if (outcome === 'accepted') {
        localStorage.setItem('pwa-installed', 'true');
        console.log('User accepted the install prompt');
      } else {
        localStorage.setItem('install-prompt-dismissed', Date.now() + (7 * 24 * 60 * 60 * 1000)); // 7 days
      }
      
      setDeferredPrompt(null);
      setShowInstallPrompt(false);
    } else if (isIOS) {
      // Show iOS install instructions
      const message = `To install AucTutor on your iPhone/iPad:

1. Tap the Share button (⬆️) at the bottom of Safari
2. Scroll down and tap "Add to Home Screen"
3. Tap "Add" in the top right corner
4. The app will appear on your home screen

Benefits:
✓ Works offline during exams
✓ Faster loading
✓ Full screen experience
✓ Push notifications`;
      
      alert(message);
      setShowInstallPrompt(false);
      localStorage.setItem('install-prompt-dismissed', Date.now() + (3 * 24 * 60 * 60 * 1000)); // 3 days
    } else if (isAndroid) {
      // Show Android manual install instructions
      const message = `To install AucTutor:

1. Open Chrome browser menu (⋮)
2. Tap "Add to Home screen"
3. Tap "Add" to confirm
4. The app will appear on your home screen

Or try these steps:
1. Tap "Install" in the browser address bar
2. Follow the installation prompts

Benefits:
✓ Works offline during exams
✓ Faster loading
✓ Native app experience`;
      
      alert(message);
      setShowInstallPrompt(false);
      localStorage.setItem('install-prompt-dismissed', Date.now() + (3 * 24 * 60 * 60 * 1000)); // 3 days
    }
  };

  const handleDismiss = () => {
    setShowInstallPrompt(false);
    localStorage.setItem('install-prompt-dismissed', Date.now() + (30 * 24 * 60 * 60 * 1000)); // 30 days
    console.log('Install prompt dismissed for 30 days');
  };

  const handleLater = () => {
    setShowInstallPrompt(false);
    localStorage.setItem('install-prompt-dismissed', Date.now() + (7 * 24 * 60 * 60 * 1000)); // 7 days
    console.log('Install prompt dismissed for 7 days');
  };

  // Don't show if already installed or prompt is hidden
  if (!showInstallPrompt || isStandalone) return null;

  return (
    <div className="pwa-install-overlay">
      <div className="pwa-install-popup">
        <button className="pwa-close-btn" onClick={handleDismiss}>×</button>
        
        <div className="pwa-header">
          <img src="/icon-192x192.png" alt="AucTutor" className="pwa-app-icon" />
          <div>
            <h3>Install CompuTech Exam Platform</h3>
            <p>Get the full app experience on your {isIOS ? 'iPhone/iPad' : isAndroid ? 'Android device' : 'device'}</p>
          </div>
        </div>

        <div className="pwa-benefits">
          <h4>Why install the app?</h4>
          <ul>
            <li>📱 <strong>Works offline</strong> - Take exams without internet</li>
            <li>⚡ <strong>Faster loading</strong> - Instant app startup</li>
            <li>🔔 <strong>Push notifications</strong> - Get result alerts</li>
            <li>🏠 <strong>Home screen access</strong> - Quick launch</li>
            <li>🔒 <strong>Enhanced security</strong> - Better exam protection</li>
            <li>🎯 <strong>Full screen</strong> - Distraction-free experience</li>
          </ul>
        </div>

        {isIOS && (
          <div className="pwa-ios-instructions">
            <p><strong>Installation steps for iOS:</strong></p>
            <ol>
              <li>Tap the Share button (⬆️) in Safari</li>
              <li>Scroll down and tap "Add to Home Screen"</li>
              <li>Tap "Add" to confirm</li>
            </ol>
          </div>
        )}

        <div className="pwa-actions">
          <button className="pwa-install-btn" onClick={handleInstall}>
            {deferredPrompt ? 'Install Now' : isIOS ? 'Show Instructions' : 'Install App'}
          </button>
          <button className="pwa-later-btn" onClick={handleLater}>
            Remind Me Later
          </button>
        </div>
      </div>
    </div>
  );
};

export default PWAInstallPrompt;
