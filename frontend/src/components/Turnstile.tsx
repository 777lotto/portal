// src/components/Turnstile.tsx - Fixed to prevent re-rendering
import { useState, useEffect, useRef, useCallback } from 'react';

interface TurnstileProps {
  sitekey: string;
  onVerify: (token: string) => void;
  theme?: 'light' | 'dark' | 'auto';
  size?: 'normal' | 'compact';
  key?: string; // Add key prop to force re-render when needed
}

export default function Turnstile({ sitekey, onVerify, theme = 'auto', size = 'normal', key }: TurnstileProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const [widgetId, setWidgetId] = useState<string | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState<boolean>(false);
  const [isVerified, setIsVerified] = useState<boolean>(false);
  const onVerifyRef = useRef(onVerify);

  // Update the callback ref when onVerify changes
  useEffect(() => {
    onVerifyRef.current = onVerify;
  }, [onVerify]);

  // Stable callback that won't cause re-renders
  const handleVerify = useCallback((token: string) => {
    setIsVerified(true);
    onVerifyRef.current(token);
  }, []);

  // Load Turnstile script if not already loaded
  useEffect(() => {
    if (typeof window.turnstile !== 'undefined') {
      setScriptLoaded(true);
      return;
    }

    // Check if script is already in the DOM
    const existingScript = document.querySelector('script[src*="turnstile"]');
    if (existingScript) {
      // Script exists, wait for it to load
      const checkLoaded = () => {
        if (typeof window.turnstile !== 'undefined') {
          setScriptLoaded(true);
        } else {
          setTimeout(checkLoaded, 100);
        }
      };
      checkLoaded();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    script.async = true;
    script.defer = true;

    script.onload = () => {
      setScriptLoaded(true);
      window.dispatchEvent(new Event('turnstile-loaded'));
    };

    script.onerror = () => {
      console.error('Failed to load Turnstile script');
    };

    document.head.appendChild(script);

    return () => {
      // Don't remove the script as it might be used by other components
    };
  }, []);

  // Render the widget once the script is loaded and div is available
  useEffect(() => {
    if (!scriptLoaded || !divRef.current || typeof window.turnstile === 'undefined' || isVerified) {
      return;
    }

    // Don't render if widget already exists
    if (widgetId) {
      return;
    }

    try {
      const id = window.turnstile.render(divRef.current, {
        sitekey: sitekey,
        callback: handleVerify,
        theme: theme,
        size: size,
        'refresh-expired': 'auto',
      });
      setWidgetId(id);
      console.log('Turnstile widget rendered with ID:', id);
    } catch (e) {
      console.error('Error rendering Turnstile widget:', e);
    }

    // Cleanup function
    return () => {
      if (widgetId && window.turnstile && !isVerified) {
        try {
          window.turnstile.remove(widgetId);
          console.log('Turnstile widget removed:', widgetId);
        } catch (e) {
          console.error('Error removing Turnstile widget:', e);
        }
      }
    };
  }, [scriptLoaded, sitekey, theme, size, handleVerify, widgetId, isVerified]);

  // Reset verification state when key prop changes (form reset)
  useEffect(() => {
    if (key !== undefined) {
      setIsVerified(false);
      if (widgetId && window.turnstile) {
        try {
          window.turnstile.remove(widgetId);
          setWidgetId(null);
        } catch (e) {
          console.error('Error resetting Turnstile widget:', e);
        }
      }
    }
  }, [key, widgetId]);

  return (
    <div>
      <div ref={divRef} className="cf-turnstile" />
      {isVerified && (
        <div style={{ 
          marginTop: '8px', 
          fontSize: '14px', 
          color: '#16a34a',
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          ✓ Verification complete
        </div>
      )}
    </div>
  );
}

// Add TypeScript declarations for Turnstile
declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          theme?: 'light' | 'dark' | 'auto';
          size?: 'normal' | 'compact';
          'refresh-expired'?: 'auto' | 'manual';
        }
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}
