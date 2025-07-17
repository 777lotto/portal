// In: 777lotto/portal/portal-bet/chat-frontend/src/App.tsx

// Correct imports based on the documentation
import { useEffect, useState } from 'react';
import {
  RealtimeKitProvider,
  useRealtimeKitClient,
} from '@cloudflare/realtimekit-react';
import {
  RtkMeeting,
  RtkUiProvider,
} from '@cloudflare/realtimekit-react-ui';

async function getDyteToken() {
  const res = await fetch('/api/token', { method: 'POST' });
  if (!res.ok) {
    throw new Error('Failed to get auth token');
  }
  const data = await res.json();
  return data.token;
}

function App() {
  const [meeting, initMeeting] = useRealtimeKitClient(); // Correct hook
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDyteToken()
      .then(setAuthToken)
      .catch((err: unknown) => {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('An unknown error occurred');
        }
      });
  }, []);

  useEffect(() => {
    if (authToken) {
      initMeeting({
        authToken,
        defaults: {
          audio: false,
          video: false,
        },
      }).catch((err: unknown) => {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('An unknown error occurred');
        }
      });
    }
  }, [authToken, initMeeting]);

  if (error) {
    return <div style={{ color: 'red' }}>Error: {error}</div>;
  }

  if (!meeting) {
    return <div>Loading chat...</div>;
  }

  // Use the correct RealtimeKit and Rtk components
  return (
    <RealtimeKitProvider value={meeting}>
      <RtkUiProvider>
        <RtkMeeting meeting={meeting} style={{ height: '100vh' }} />
      </RtkUiProvider>
    </RealtimeKitProvider>
  );
}

export default App;
