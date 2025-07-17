import { useState, useEffect } from 'react';
import {
  RealtimeKitProvider,
  useRealtimeKitClient,
} from '@cloudflare/realtimekit-react';
import {
  RtkMeeting,
  RtkUiProvider,
} from '@cloudflare/realtimekit-react-ui';

// This function fetches the chat token for the EMBEDDED widget. It's correct as is.
async function getChatToken() {
  const res = await fetch('/api/chat/token', {
    method: 'POST',
    headers: {
        // The fetchJson helper automatically includes the auth token from localStorage
        'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
   });
  if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to get chat token: ${errorText}`);
  }
  const data = await res.json();
  return data.token;
}

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [meeting, initMeeting] = useRealtimeKitClient();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // This logic correctly initializes the meeting for the embedded modal view.
    if (isOpen && !meeting) {
      setError(null);
      getChatToken()
        .then((token) => {
          initMeeting({
            authToken: token,
            defaults: { audio: false, video: false },
          }).catch(err => {
              console.error("Error initializing meeting:", err);
              setError(err.message);
          });
        })
        .catch(err => {
            console.error("Error getting chat token:", err);
            setError(err.message);
        });
    }
  }, [isOpen, meeting, initMeeting]);

  const handleClose = () => {
    if (meeting?.leaveRoom) {
      meeting.leaveRoom();
    }
    setIsOpen(false);
  }

  // NEW: This function opens the standalone chat app in a new tab,
  // passing the user's main session token in the URL.
  const openStandaloneChat = () => {
    const userToken = localStorage.getItem('token');
    if (userToken) {
      // This constructs the URL like: https://chat.777.foo?token=ey...
      window.open(`https://chat.777.foo?token=${userToken}`, '_blank');
    } else {
      // This should ideally not happen if the widget is only shown to logged-in users
      alert("You must be logged in to open the standalone chat.");
    }
  };

  return (
    <>
      {/* The floating chat button (no changes here) */}
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
                {/* MODIFIED: Added a container for the new button */}
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
              {error && <div className="alert alert-danger">Error: {error}</div>}
              {!error && meeting ? (
                <RealtimeKitProvider value={meeting}>
                  <RtkUiProvider>
                    <RtkMeeting meeting={meeting} showSetupScreen={false} />
                  </RtkUiProvider>
                </RealtimeKitProvider>
              ) : (
                <div>Loading Chat...</div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
