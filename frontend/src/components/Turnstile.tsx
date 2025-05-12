// src/components/Turnstile.tsx - Updated for better reliability
import { useState, useEffect, useRef } from 'react';

interface TurnstileProps {
  sitekey: string;
  onVerify: (token: string) => void;
  theme?: 'light' | 'dark' | 'auto';
  size?: 'normal' | 'compact';
}

export default function Turnstile({ sitekey, onVerify, theme = 'auto', size = 'normal' }: TurnstileProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const [widgetId, setWidgetId] = useState<string | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState<boolean>(false);

  // Load Turnstile script if not already loaded
  useEffect(() => {
    if (typeof window.turnstile !== 'undefined') {
      setScriptLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    script.async = true;
    script.defer = true;

    script.onload = () => {
      setScriptLoaded(true);
      // Dispatch custom event to notify Turnstile is loaded
      window.dispatchEvent(new Event('turnstile-loaded'));
    };

    document.head.appendChild(script);

    return () => {
      // Only remove the script if we were the ones who added it
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, []);

  // Render the widget once the script is loaded
  useEffect(() => {
    if (!scriptLoaded || !divRef.current || typeof window.turnstile === 'undefined') {
      return;
    }

    // Cleanup previous widget if it exists
    if (widgetId) {
      try {
        window.turnstile.remove(widgetId);
      } catch (e) {
        console.error('Error removing Turnstile widget:', e);
      }
    }

    // Render new widget
    try {
      const id = window.turnstile.render(divRef.current, {
        sitekey: sitekey,
        callback: onVerify,
        theme: theme,
        size: size,
        'refresh-expired': 'auto',
      });
      setWidgetId(id);
    } catch (e) {
      console.error('Error rendering Turnstile widget:', e);
    }

    // Cleanup function
    return () => {
      if (widgetId && window.turnstile) {
        try {
          window.turnstile.remove(widgetId);
        } catch (e) {
          console.error('Error removing Turnstile widget on cleanup:', e);
        }
      }
    };
  }, [scriptLoaded, sitekey, onVerify, theme, size]);

  return <div ref={divRef} className="cf-turnstile" />;
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
