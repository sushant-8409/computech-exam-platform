import React, { useState, useEffect } from 'react';
import './PWAInstallPrompt.css';

const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    // Detect device type
    const userAgent = window.navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(userAgent));
    setIsAndroid(/Android/.test(userAgent));

    // Check if already installed
    const isInstalled = window.matchMedia('(display-mode: standalone)').matches ||
                       window.navigator.standalone ||
                       localStorage.getItem('pwa-installed') === 'true';

    if (isInstalled) return;

    // Check if user dismissed recently
    const dismissed = localStorage.getItem('install-prompt-dismissed');
    if (dismissed && Date.now() < parseInt(dismissed)) return;

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Show prompt after 3 seconds
      setTimeout(() => {
        setShowInstallPrompt(true);
      }, 3000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // For iOS devices, show manual install prompt
    if (/iPad|iPhone|iPod/.test(userAgent) && !isInstalled) {
      setTimeout(() => {
        setShowInstallPrompt(true);
      }, 3000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        localStorage.setItem('pwa-installed', 'true');
      } else {
        localStorage.setItem('install-prompt-dismissed', Date.now() + (2 * 24 * 60 * 60 * 1000));
      }
      
      setDeferredPrompt(null);
      setShowInstallPrompt(false);
    } else if (isIOS) {
      // Show iOS install instructions
      alert(`To install this app on your iOS device:
      1. Tap the Share button (⬆️) in Safari
      2. Scroll down and tap "Add to Home Screen"
      3. Tap "Add" in the top right corner`);
      setShowInstallPrompt(false);
    }
  };

  const handleDismiss = () => {
    setShowInstallPrompt(false);
    localStorage.setItem('install-prompt-dismissed', Date.now() + (30 * 24 * 60 * 60 * 1000));
  };

  const handleLater = () => {
    setShowInstallPrompt(false);
    localStorage.setItem('install-prompt-dismissed', Date.now() + (1 * 24 * 60 * 60 * 1000));
  };

  if (!showInstallPrompt) return null;

  return (
    <div className="pwa-install-overlay">
      <div className="pwa-install-popup">
        <button className="pwa-close-btn" onClick={handleDismiss}>×</button>
        
        <div className="pwa-header">
          <img src="/icon-192x192.png" alt="CompuTech" className="pwa-app-icon" />
          <div>
            <h3>Install CompuTech Exam Platform</h3>
            <p>Get the full app experience</p>
          </div>
        </div>

        <div className="pwa-benefits">
          <h4>Benefits of installing:</h4>
          <ul>
            <li>📱 Works offline during exams</li>
            <li>⚡ Faster loading times</li>
            <li>🔔 Push notifications for results</li>
            <li>🏠 Quick access from home screen</li>
            <li>🔒 Enhanced security features</li>
          </ul>
        </div>

        <div className="pwa-actions">
          <button className="pwa-install-btn" onClick={handleInstall}>
            {isIOS ? 'Show Instructions' : 'Install App'}
          </button>
          <button className="pwa-later-btn" onClick={handleLater}>
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
};

export default PWAInstallPrompt;
