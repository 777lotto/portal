import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
// In: 777lotto/portal/portal-bet/chat-frontend/src/App.tsx
// Correct imports based on the documentation
import { useEffect, useState } from 'react';
import { RealtimeKitProvider, useRealtimeKitClient, } from '@cloudflare/realtimekit-react';
import { RtkMeeting, RtkUiProvider, } from '@cloudflare/realtimekit-react-ui';
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
    const [authToken, setAuthToken] = useState(null);
    const [error, setError] = useState(null);
    useEffect(() => {
        getDyteToken()
            .then(setAuthToken)
            .catch((err) => {
            if (err instanceof Error) {
                setError(err.message);
            }
            else {
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
            }).catch((err) => {
                if (err instanceof Error) {
                    setError(err.message);
                }
                else {
                    setError('An unknown error occurred');
                }
            });
        }
    }, [authToken, initMeeting]);
    if (error) {
        return _jsxs("div", { style: { color: 'red' }, children: ["Error: ", error] });
    }
    if (!meeting) {
        return _jsx("div", { children: "Loading chat..." });
    }
    // Use the correct RealtimeKit and Rtk components
    return (_jsx(RealtimeKitProvider, { value: meeting, children: _jsx(RtkUiProvider, { children: _jsx(RtkMeeting, { meeting: meeting, style: { height: '100vh' } }) }) }));
}
export default App;
