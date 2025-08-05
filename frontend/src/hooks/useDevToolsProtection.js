import { useEffect, useRef } from 'react';
import DevToolsProtection from '../utils/devToolsProtection';

/**
 * React Hook for Developer Tools Protection
 * Provides easy integration of security measures
 */
export const useDevToolsProtection = (options = {}) => {
  const protectionRef = useRef(null);
  const {
    enabled = true,
    onViolation = null,
    maxViolations = 5, // Changed from 3 to 5
    strictMode = false // Extra strict for exam pages
  } = options;

  useEffect(() => {
    if (!enabled) return;

    // Initialize protection with options
    protectionRef.current = new DevToolsProtection({
      maxViolations,
      strictMode,
      onViolation
    });

    // Cleanup function
    return () => {
      if (protectionRef.current) {
        protectionRef.current.destroy();
        protectionRef.current = null;
      }
    };
  }, [enabled, maxViolations, strictMode, onViolation]);

  // Return protection controls
  return {
    disable: () => protectionRef.current?.destroy(),
    enable: () => {
      if (!protectionRef.current && enabled) {
        protectionRef.current = new DevToolsProtection({
          maxViolations,
          strictMode,
          onViolation
        });
      }
    },
    getViolationCount: () => protectionRef.current?.violationCount || 0,
    isProtected: () => !protectionRef.current?.isDestroyed
  };
};
