import { useEffect, useState } from 'react';
import { useDyteClient, DyteProvider } from '@cloudflare/realtimekit-react';
import { DyteMeeting, DyteUiProvider } from '@cloudflare/realtimekit-react-ui';


// This is a simple API helper for this standalone app.
async function getDyteToken() {
  const res = await fetch('/api/token', { method: 'POST' });
  if (!res.ok) {
    throw new Error('Failed to get auth token');
  }
  const data = await res.json();
  return data.token;
}

function App() {
  const [meeting, initMeeting] = useDyteClient();
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch the token when the component mounts
  useEffect(() => {
    getDyteToken()
      .then(setAuthToken)
      .catch((err) => setError(err.message));
  }, []);

  // Initialize the Dyte meeting once we have the token
  useEffect(() => {
    if (authToken) {
      initMeeting({
        authToken,
        defaults: {
          audio: false,
          video: false,
        },
      }).catch((err) => setError(err.message));
    }
  }, [authToken, initMeeting]);

  if (error) {
    return <div style={{ color: 'red' }}>Error: {error}</div>;
  }

  if (!meeting) {
    return <div>Loading chat...</div>;
  }

  return (
    <DyteProvider value={meeting}>
      <DyteUiProvider>
        <DyteMeeting meeting={meeting} style={{ height: '100vh' }} />
      </DyteUiProvider>
    </DyteProvider>
  );
}

export default App;
