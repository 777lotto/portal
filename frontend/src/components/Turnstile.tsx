// src/components/Turnstile.tsx
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

  useEffect(() => {
    // Load Turnstile script if not already loaded
    if (!window.turnstile) {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);

      return () => {
        document.head.removeChild(script);
      };
    }

    return () => {
      // Cleanup on unmount
      if (widgetId && window.turnstile) {
        window.turnstile.remove(widgetId);
      }
    };
  }, []);

  useEffect(() => {
    // Render the widget once the script is loaded
    const renderWidget = () => {
      if (!divRef.current || !window.turnstile) return;

      // Reset if already rendered
      if (widgetId) {
        window.turnstile.remove(widgetId);
      }

      const id = window.turnstile.render(divRef.current, {
        sitekey: sitekey,
        callback: onVerify,
        theme: theme,
        size: size,
      });

      setWidgetId(id);
    };

    // Check if turnstile is already loaded
    if (window.turnstile) {
      renderWidget();
    } else {
      // If not loaded yet, set up an event listener
      const handleLoad = () => renderWidget();
      window.addEventListener('turnstile-loaded', handleLoad);
      return () => window.removeEventListener('turnstile-loaded', handleLoad);
    }
  }, [sitekey, onVerify, theme, size]);

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
        }
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}
