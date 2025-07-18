import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// In: 777lotto/portal/portal-bet/chat-frontend/src/App.tsx
import { useEffect, useState } from 'react';
import { RealtimeKitProvider, useRealtimeKitClient, } from '@cloudflare/realtimekit-react';
import { RtkMeeting, RtkUiProvider, } from '@cloudflare/realtimekit-react-ui';
// Updated function to expect a new response structure
async function getChatCredentials(userAuthToken) {
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
    // Update the local type to use authToken
    const [session, setSession] = useState(null);
    const [error, setError] = useState(null);
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
                // FIX: Rename 'token' to 'authToken' to match what initMeeting expects
                authToken: credentials.token
            });
        })
            .catch((err) => {
            if (err instanceof Error) {
                // If the session was refreshed, prompt the user to try again.
                if (err.message.includes("refreshed")) {
                    setError("Chat session was refreshed. Please click Refresh to join.");
                }
                else {
                    setError(err.message);
                }
            }
            else {
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
        // The 'session' object now has the correct shape
        if (session) {
            initMeeting(session).catch((err) => {
                if (err instanceof Error) {
                    setError(err.message);
                }
                else {
                    setError('An unknown error occurred while initializing the meeting');
                }
            });
        }
    }, [session, initMeeting]);
    // Custom refresh button for the 503 case
    if (error && error.includes("refreshed")) {
        return (_jsxs("div", { style: { padding: '20px', textAlign: 'center' }, children: [_jsx("p", { style: { color: 'orange', marginBottom: '1rem' }, children: error }), _jsx("button", { onClick: fetchCredentials, style: { padding: '10px 20px' }, children: "Refresh" })] }));
    }
    if (error) {
        return _jsxs("div", { style: { color: 'red', padding: '20px' }, children: ["Error: ", error] });
    }
    if (isLoading || !meeting) {
        return _jsx("div", { style: { padding: '20px' }, children: "Loading chat..." });
    }
    return (_jsx(RealtimeKitProvider, { value: meeting, children: _jsx(RtkUiProvider, { children: _jsx(RtkMeeting, { meeting: meeting, style: { height: '100vh' } }) }) }));
}
export default App;
