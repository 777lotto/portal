import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
// In: 777lotto/portal/portal-bet/chat-frontend/src/App.tsx
import { useEffect, useState } from 'react';
import { RealtimeKitProvider, useRealtimeKitClient, } from '@cloudflare/realtimekit-react';
import { RtkMeeting, RtkUiProvider, } from '@cloudflare/realtimekit-react-ui';
// This function now accepts the user's main auth token from the portal
async function getChatToken(userAuthToken) {
    // The endpoint is proxied through the main worker, so we use the full path
    const res = await fetch('/api/chat/token', {
        method: 'POST',
        headers: {
            // This header is required by your main worker's `requireAuthMiddleware`
            'Authorization': `Bearer ${userAuthToken}`
        }
    });
    if (!res.ok) {
        const errorText = await res.text();
        console.error("Auth token fetch failed:", errorText);
        throw new Error('Failed to get chat token. You may not have permission to access this page.');
    }
    const data = await res.json();
    return data.token;
}
function App() {
    const [meeting, initMeeting] = useRealtimeKitClient();
    const [chatToken, setChatToken] = useState(null);
    const [error, setError] = useState(null);
    useEffect(() => {
        // Read the user's main session token from the URL search parameters
        const queryParams = new URLSearchParams(window.location.search);
        const userAuthToken = queryParams.get('token');
        if (!userAuthToken) {
            setError("Authentication is missing. This page should be accessed from the main portal.");
            return;
        }
        // Pass the token to the fetch function
        getChatToken(userAuthToken)
            .then(setChatToken)
            .catch((err) => {
            if (err instanceof Error) {
                setError(err.message);
            }
            else {
                setError('An unknown error occurred');
            }
        });
    }, []); // Note: The empty dependency array means this runs only once.
    useEffect(() => {
        if (chatToken) {
            initMeeting({
                authToken: chatToken, // Use the chat-specific token from the backend
                defaults: {
                    audio: false,
                    video: false,
                },
            }).catch((err) => {
                if (err instanceof Error) {
                    setError(err.message);
                }
                else {
                    setError('An unknown error occurred while initializing the meeting');
                }
            });
        }
    }, [chatToken, initMeeting]);
    if (error) {
        return _jsxs("div", { style: { color: 'red', padding: '20px' }, children: ["Error: ", error] });
    }
    if (!meeting) {
        return _jsx("div", { style: { padding: '20px' }, children: "Loading chat..." });
    }
    return (_jsx(RealtimeKitProvider, { value: meeting, children: _jsx(RtkUiProvider, { children: _jsx(RtkMeeting, { meeting: meeting, style: { height: '100vh' } }) }) }));
}
export default App;
