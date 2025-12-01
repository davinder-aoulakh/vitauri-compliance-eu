import { useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";

const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds
const WARNING_BEFORE_LOGOUT = 2 * 60 * 1000; // Show warning 2 minutes before logout

export default function useInactivityLogout({ 
  timeout = INACTIVITY_TIMEOUT, 
  warningTime = WARNING_BEFORE_LOGOUT,
  onWarning,
  enabled = true 
}) {
  const timeoutRef = useRef(null);
  const warningTimeoutRef = useRef(null);

  const handleLogout = useCallback(async () => {
    try {
      await base44.auth.logout();
    } catch (error) {
      console.error("Logout error:", error);
      window.location.reload();
    }
  }, []);

  const resetTimer = useCallback(() => {
    // Clear existing timers
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
    }

    if (!enabled) return;

    // Set warning timer
    if (onWarning && warningTime > 0) {
      warningTimeoutRef.current = setTimeout(() => {
        onWarning(warningTime);
      }, timeout - warningTime);
    }

    // Set logout timer
    timeoutRef.current = setTimeout(() => {
      handleLogout();
    }, timeout);
  }, [timeout, warningTime, onWarning, enabled, handleLogout]);

  useEffect(() => {
    if (!enabled) return;

    // Events that indicate user activity
    const activityEvents = [
      "mousedown",
      "mousemove",
      "keydown",
      "scroll",
      "touchstart",
      "click"
    ];

    // Throttle reset to avoid excessive calls
    let lastReset = Date.now();
    const throttledReset = () => {
      const now = Date.now();
      if (now - lastReset > 1000) { // Only reset once per second max
        lastReset = now;
        resetTimer();
      }
    };

    // Add event listeners
    activityEvents.forEach(event => {
      document.addEventListener(event, throttledReset, { passive: true });
    });

    // Start the initial timer
    resetTimer();

    // Cleanup
    return () => {
      activityEvents.forEach(event => {
        document.removeEventListener(event, throttledReset);
      });
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
      }
    };
  }, [enabled, resetTimer]);

  return { resetTimer };
}