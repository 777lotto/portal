// In: 777lotto/portal/portal-bet/frontend/src/components/ChatWidget.tsx

import { useState, useEffect, useCallback } from 'react';
import {
  RealtimeKitProvider,
  useRealtimeKitClient,
} from '@cloudflare/realtimekit-react';
import {
  RtkMeeting,
  RtkUiProvider,
} from '@cloudflare/realtimekit-react-ui';

// This function fetches the chat credentials from our worker
async function getChatCredentials(): Promise<{ sessionId: string; token: string }> {
  const res = await fetch('/api/chat/token', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  });

  if (!res.ok) {
    // Pass the response object itself to the error for inspection
    const err = new Error('Failed to get chat credentials');
    (err as any).response = res; // Attach response to the error object
    throw err;
  }
  return await res.json();
}

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [meeting, initMeeting] = useRealtimeKitClient();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // This is the core logic to initialize the connection
  const initializeChat = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const credentials = await getChatCredentials();
      await initMeeting({
        authToken: credentials.token,
        sessionId: credentials.sessionId, // Provide the session ID
        defaults: { audio: false, video: false },
      });
    } catch (err: any) {
      // Check if this is the "session refreshed" error (status 503)
      if (err.response && err.response.status === 503) {
        console.log('Chat session was refreshed. Retrying automatically...');
        // Wait a moment, then try again once.
        setTimeout(() => initializeChat(), 500);
      } else {
        console.error("Error initializing meeting:", err);
        const errorText = await err.response?.text();
        setError(errorText || 'An unknown error occurred.');
      }
    } finally {
      // Only set loading to false if there isn't an ongoing retry
      if (error || meeting) {
        setIsLoading(false);
      }
    }
  }, [initMeeting, error, meeting]);


  useEffect(() => {
    // Initialize the chat only when the widget is opened and we don't already have a meeting object
    if (isOpen && !meeting) {
      initializeChat();
    }
  }, [isOpen, meeting, initializeChat]);


  const handleClose = () => {
    if (meeting?.leaveRoom) {
      meeting.leaveRoom();
    }
    setIsOpen(false);
    // Reset state when closing the widget
    (meeting as any) = null;
    setError(null);
  }

  // This function opens the standalone chat app in a new tab
  const openStandaloneChat = () => {
    const userToken = localStorage.getItem('token');
    if (userToken) {
      window.open(`https://chat.777.foo?token=${userToken}`, '_blank');
    } else {
      alert("You must be logged in to open the standalone chat.");
    }
  };

  return (
    <>
      {/* The floating chat button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-event-blue text-white rounded-full p-4 shadow-lg hover:bg-event-blue/90 z-40 transition-transform hover:scale-110"
        aria-label="Open chat"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </button>

      {/* The Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-tertiary-dark rounded-lg shadow-xl w-full max-w-4xl h-3/4 flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-border-light dark:border-border-dark">
                <h3 className="text-lg font-bold">Live Chat</h3>
                <div>
                  <button
                    onClick={openStandaloneChat}
                    className="text-sm text-event-blue hover:underline mr-4"
                    title="Open chat in a new tab"
                  >
                    Open Fullscreen
                  </button>
                  <button onClick={handleClose} className="text-text-primary-light dark:text-text-primary-dark">&times;</button>
                </div>
            </div>
            <div className="flex-grow p-4">
              {error && <div className="p-4 text-center text-red-500">Error: {error}</div>}
              {(isLoading || (!meeting && !error)) && <div className="p-4 text-center">Loading Chat...</div>}
              {!isLoading && !error && meeting && (
                <RealtimeKitProvider value={meeting}>
                  <RtkUiProvider>
                    <RtkMeeting meeting={meeting} showSetupScreen={false} />
                  </RtkUiProvider>
                </RealtimeKitProvider>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
