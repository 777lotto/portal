import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect } from 'react';
import { useRealtimeKitClient } from '@cloudflare/realtimekit-react';
import { RtkChat, RtkUiProvider, provideRtkDesignSystem, } from '@cloudflare/realtimekit-react-ui';
function App() {
    const [meeting, initMeeting] = useRealtimeKitClient();
    useEffect(() => {
        provideRtkDesignSystem(document.body, {
            theme: 'light',
        });
        const searchParams = new URL(window.location.href).searchParams;
        const authToken = searchParams.get('authToken');
        if (!authToken) {
            alert("An authToken wasn't passed, please pass an authToken in the URL query to join a meeting.");
            return;
        }
        initMeeting({
            authToken,
            defaults: {
                video: false,
                audio: false,
            },
        }).then((m) => {
            // NOTE: for debugging
            Object.assign(window, { meeting: m });
        });
    }, []);
    if (!meeting)
        return _jsx("div", { children: "\"Loading...\"" });
    return (_jsx(RtkUiProvider, { meeting: meeting, children: _jsx(RtkChat, {}) }));
}
export default App;
