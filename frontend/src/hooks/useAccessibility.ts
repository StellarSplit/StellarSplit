import { useState, useEffect, useCallback } from 'react';

interface AccessibilityPreferences {
  prefersReducedMotion: boolean;
  prefersHighContrast: boolean;
  prefersReducedTransparency: boolean;
}

/**
 * Hook to detect user's accessibility preferences
 * Follows WCAG guidelines for respecting user preferences
 */
export function useAccessibility(): AccessibilityPreferences {
  const [preferences, setPreferences] = useState<AccessibilityPreferences>({
    prefersReducedMotion: false,
    prefersHighContrast: false,
    prefersReducedTransparency: false,
  });

  useEffect(() => {
    // Guard against environments without matchMedia (jsdom, SSR)
    if (typeof window.matchMedia !== 'function') {
      return;
    }

    // Check for reduced motion preference
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const contrastQuery = window.matchMedia('(prefers-contrast: more)');
    const transparencyQuery = window.matchMedia('(prefers-reduced-transparency: reduce)');

    const updatePreferences = () => {
      setPreferences({
        prefersReducedMotion: motionQuery.matches,
        prefersHighContrast: contrastQuery.matches,
        prefersReducedTransparency: transparencyQuery.matches,
      });
    };

    // Initial check
    updatePreferences();

    // Listen for changes
    motionQuery.addEventListener('change', updatePreferences);
    contrastQuery.addEventListener('change', updatePreferences);
    transparencyQuery.addEventListener('change', updatePreferences);

    return () => {
      motionQuery.removeEventListener('change', updatePreferences);
      contrastQuery.removeEventListener('change', updatePreferences);
      transparencyQuery.removeEventListener('change', updatePreferences);
    };
  }, []);

  return preferences;
}

/**
 * Hook to announce messages to screen readers
 * Uses a live region for accessibility
 */
export function useAnnounce() {
  const [message, setMessage] = useState('');

  const announce = useCallback((newMessage: string) => {
    setMessage('');
    // Small delay to ensure screen readers detect the change
    setTimeout(() => {
      setMessage(newMessage);
    }, 50);
  }, []);

  return { message, announce };
}
