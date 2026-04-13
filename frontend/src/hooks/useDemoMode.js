// frontend/src/hooks/useDemoMode.js
import { useState, useCallback } from "react";

const DEMO_MODE_KEY = "flowiq_demo_mode";

export function useDemoMode() {
  const [isDemoMode, setIsDemoMode] = useState(() => {
    try {
      return localStorage.getItem(DEMO_MODE_KEY) === "true";
    } catch {
      return false;
    }
  });

  const enterDemoMode = useCallback(() => {
    try {
      localStorage.setItem(DEMO_MODE_KEY, "true");
    } catch {}
    setIsDemoMode(true);
  }, []);

  const exitDemoMode = useCallback(() => {
    try {
      localStorage.removeItem(DEMO_MODE_KEY);
    } catch {}
    setIsDemoMode(false);
  }, []);

  return { isDemoMode, enterDemoMode, exitDemoMode };
}
