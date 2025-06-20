import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
export default function CalendarSync() {
    const [copying, setCopying] = useState(false);
    const [calendarToken, setCalendarToken] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    useEffect(() => {
        // If not logged in, redirect to login
        if (!token) {
            navigate('/login');
            return;
        }
        // Generate or fetch a calendar token
        async function fetchCalendarToken() {
            try {
                setIsLoading(true);
                // In a real implementation, you'd want to make an API call to get a specific
                // calendar token that's different from the main auth token
                // This is just a placeholder using the existing token
                setCalendarToken(token);
            }
            catch (err) {
                setError(err.message || 'Failed to generate calendar token');
            }
            finally {
                setIsLoading(false);
            }
        }
        fetchCalendarToken();
    }, [token, navigate]);
    // Generate the calendar feed URL
    const baseUrl = window.location.origin;
    const feedUrl = calendarToken ? `${baseUrl}/api/calendar-feed?token=${calendarToken}` : '';
    const handleCopyLink = async () => {
        if (!feedUrl)
            return;
        try {
            await navigator.clipboard.writeText(feedUrl);
            setCopying(true);
            setTimeout(() => setCopying(false), 2000);
        }
        catch (err) {
            console.error('Failed to copy', err);
            setError('Failed to copy to clipboard');
        }
    };
    const handleDownloadCalendar = () => {
        if (!feedUrl)
            return;
        window.open(feedUrl, '_blank');
    };
    if (isLoading) {
        return _jsx("div", { style: { padding: '2rem' }, children: "Loading calendar sync options..." });
    }
    if (error) {
        return (_jsxs("div", { style: { padding: '2rem' }, children: [_jsx("h2", { children: "Error" }), _jsx("p", { style: { color: 'red' }, children: error }), _jsx("button", { onClick: () => navigate('/dashboard'), style: { padding: '0.5rem 1rem', marginTop: '1rem' }, children: "Back to Dashboard" })] }));
    }
    return (_jsxs("div", { style: { padding: '2rem' }, children: [_jsx("h2", { children: "Sync Your Service Schedule" }), _jsx("p", { children: "Keep track of your gutter cleaning appointments by adding them to your favorite calendar app." }), _jsxs("div", { style: { marginTop: '2rem' }, children: [_jsx("h3", { children: "Instructions" }), _jsx("h4", { style: { marginTop: '1rem' }, children: "Google Calendar" }), _jsxs("ol", { children: [_jsx("li", { children: "In Google Calendar, click the \"+\" next to \"Other calendars\"" }), _jsx("li", { children: "Select \"From URL\"" }), _jsx("li", { children: "Paste the calendar URL below" }), _jsx("li", { children: "Click \"Add calendar\"" })] }), _jsx("h4", { style: { marginTop: '1rem' }, children: "Apple Calendar" }), _jsxs("ol", { children: [_jsx("li", { children: "In Calendar, select File \u2192 New Calendar Subscription" }), _jsx("li", { children: "Paste the calendar URL below" }), _jsx("li", { children: "Click \"Subscribe\"" })] }), _jsx("h4", { style: { marginTop: '1rem' }, children: "Outlook" }), _jsxs("ol", { children: [_jsx("li", { children: "In Outlook calendar, click \"Add calendar\"" }), _jsx("li", { children: "Select \"From Internet\"" }), _jsx("li", { children: "Paste the calendar URL below" }), _jsx("li", { children: "Click \"OK\"" })] }), _jsxs("div", { style: {
                            marginTop: '1.5rem',
                            padding: '1rem',
                            backgroundColor: '#f5f5f5',
                            borderRadius: '4px',
                            border: '1px solid #ddd',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }, children: [_jsx("div", { style: {
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    flex: 1,
                                    marginRight: '1rem',
                                    fontFamily: 'monospace',
                                    fontSize: '0.9rem'
                                }, children: feedUrl }), _jsx("button", { onClick: handleCopyLink, style: {
                                    padding: '0.5rem 1rem',
                                    backgroundColor: copying ? '#4CAF50' : '#007bff',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                }, children: copying ? 'Copied!' : 'Copy URL' })] }), _jsxs("div", { style: { marginTop: '1.5rem', display: 'flex', gap: '1rem' }, children: [_jsx("button", { onClick: handleDownloadCalendar, style: {
                                    padding: '0.5rem 1rem',
                                    backgroundColor: '#6c757d',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                }, children: "Download Calendar File" }), _jsx("button", { onClick: () => navigate('/dashboard'), style: {
                                    padding: '0.5rem 1rem',
                                    backgroundColor: 'transparent',
                                    border: '1px solid #ccc',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                }, children: "Back to Dashboard" })] }), _jsxs("div", { style: { marginTop: '2rem' }, children: [_jsx("h3", { children: "Security Note" }), _jsx("p", { style: { fontSize: '0.9rem', color: '#666' }, children: "This calendar URL contains a secure token that provides access to your schedule. Don't share this URL with people you don't want to have access to your appointment information. You can reset your calendar token at any time by revisiting this page." })] })] })] }));
}
