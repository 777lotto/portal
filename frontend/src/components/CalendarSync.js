import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { getCalendarFeed, syncCalendar } from '../lib/api';
function CalendarSync() {
    const [feedUrl, setFeedUrl] = useState('');
    const [syncUrl, setSyncUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState(null);
    useEffect(() => {
        const token = localStorage.getItem("token");
        if (token) {
            // getCalendarFeed is a simple string constructor, no API call needed here
            setFeedUrl(getCalendarFeed(token));
        }
    }, []);
    const handleSync = async (e) => {
        e.preventDefault();
        const token = localStorage.getItem("token");
        if (!token || !syncUrl)
            return;
        try {
            setIsLoading(true);
            setMessage(null);
            await syncCalendar(syncUrl, token);
            setMessage({ type: 'success', text: 'Calendar sync initiated successfully!' });
        }
        catch (err) {
            setMessage({ type: 'danger', text: err.message });
        }
        finally {
            setIsLoading(false);
        }
    };
    return (_jsxs("div", { className: "container mt-4", children: [_jsx("h2", { children: "Calendar Sync" }), _jsx("div", { className: "card", children: _jsxs("div", { className: "card-body", children: [_jsx("h5", { className: "card-title", children: "Your Personal Calendar Feed" }), _jsx("p", { children: "Add this URL to your calendar application (Google Calendar, Outlook, etc.) to see your jobs." }), _jsx("input", { type: "text", readOnly: true, className: "form-control", value: feedUrl }), _jsx("button", { className: "btn btn-secondary mt-2", onClick: () => navigator.clipboard.writeText(feedUrl), children: "Copy URL" })] }) }), _jsx("div", { className: "card mt-4", children: _jsxs("div", { className: "card-body", children: [_jsx("h5", { className: "card-title", children: "Sync External Calendar" }), _jsx("p", { children: "Paste the URL of an external iCal feed to sync it with your portal." }), _jsxs("form", { onSubmit: handleSync, children: [_jsx("div", { className: "mb-3", children: _jsx("input", { type: "url", className: "form-control", value: syncUrl, onChange: (e) => setSyncUrl(e.target.value), placeholder: "https://example.com/feed.ics", required: true }) }), message && _jsx("div", { className: `alert alert-${message.type}`, children: message.text }), _jsx("button", { type: "submit", className: "btn btn-primary", disabled: isLoading, children: isLoading ? 'Syncing...' : 'Sync Now' })] })] }) })] }));
}
export default CalendarSync;
