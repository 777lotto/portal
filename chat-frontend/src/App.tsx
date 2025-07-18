// In: 777lotto/portal/portal-bet/chat-frontend/src/App.tsx

import { useEffect, useState } from 'react';
import {
  RealtimeKitProvider,
  useRealtimeKitClient,
  // NEW: Import RtkSession type
  type RtkSession,
} from '@cloudflare/realtimekit-react';
import {
  RtkMeeting,
  RtkUiProvider,
} from '@cloudflare/realtimekit-react-ui';

// Updated function to expect a new response structure
async function getChatCredentials(userAuthToken: string): Promise<{ sessionId: string; token: string }> {
  const res = await fetch('/api/chat/token', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${userAuthToken}`
    }
  });

  if (!res.ok) {
    const data = await res.json();
    // Special handling for session refresh
    if (res.status === 503 && data.error) {
        throw new Error(data.error);
    }
    throw new Error('Failed to get chat credentials. You may not have permission.');
  }
  return await res.json();
}

function App() {
  const [meeting, initMeeting] = useRealtimeKitClient();
  // State to hold both sessionId and token
  const [session, setSession] = useState<RtkSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Function to attempt fetching credentials
  const fetchCredentials = () => {
      const queryParams = new URLSearchParams(window.location.search);
      const userAuthToken = queryParams.get('token');

      if (!userAuthToken) {
          setError("Authentication is missing. This page should be accessed from the main portal.");
          setIsLoading(false);
          return;
      }

      setIsLoading(true);
      setError(null);

      getChatCredentials(userAuthToken)
          .then(credentials => {
              setSession({
                  sessionId: credentials.sessionId,
                  token: credentials.token
              });
          })
          .catch((err: unknown) => {
              if (err instanceof Error) {
                  // If the session was refreshed, prompt the user to try again.
                  if (err.message.includes("refreshed")) {
                      setError("Chat session was refreshed. Please click Refresh to join.");
                  } else {
                      setError(err.message);
                  }
              } else {
                  setError('An unknown error occurred');
              }
          })
          .finally(() => {
              setIsLoading(false);
          });
  };

  useEffect(() => {
      fetchCredentials();
  }, []);

  useEffect(() => {
    // Initialize the meeting only when we have valid session credentials
    if (session) {
      initMeeting(session).catch((err: unknown) => {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('An unknown error occurred while initializing the meeting');
        }
      });
    }
  }, [session, initMeeting]);

  // Custom refresh button for the 503 case
  if (error && error.includes("refreshed")) {
      return (
          <div style={{ padding: '20px', textAlign: 'center' }}>
              <p style={{ color: 'orange', marginBottom: '1rem' }}>{error}</p>
              <button onClick={fetchCredentials} style={{ padding: '10px 20px' }}>Refresh</button>
          </div>
      );
  }

  if (error) {
    return <div style={{ color: 'red', padding: '20px' }}>Error: {error}</div>;
  }

  if (isLoading || !meeting) {
    return <div style={{ padding: '20px' }}>Loading chat...</div>;
  }

  return (
    <RealtimeKitProvider value={meeting}>
      <RtkUiProvider>
        <RtkMeeting meeting={meeting} style={{ height: '100vh' }} />
      </RtkUiProvider>
    </RealtimeKitProvider>
  );
}

export default App;
