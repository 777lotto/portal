import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// frontend/src/components/SMSConversations.tsx - CORRECTED
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getSmsConversations } from '../lib/api';
function SMSConversations() {
    const [conversations, setConversations] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    useEffect(() => {
        const fetchConversations = async () => {
            try {
                setIsLoading(true);
                setError(null);
                // FIX: The token is no longer passed directly to API functions.
                const data = await getSmsConversations();
                setConversations(data);
            }
            catch (err) {
                setError(err.message);
            }
            finally {
                setIsLoading(false);
            }
        };
        fetchConversations();
    }, []);
    if (isLoading)
        return _jsx("div", { className: "container mt-4", children: "Loading conversations..." });
    if (error)
        return _jsx("div", { className: "container mt-4 alert alert-danger", children: error });
    return (_jsxs("div", { className: "container mt-4", children: [_jsx("h2", { children: "SMS Conversations" }), _jsx("div", { className: "list-group", children: conversations.length > 0 ? (conversations.map(convo => (_jsxs(Link, { to: `/sms/${convo.phone_number}`, className: "list-group-item list-group-item-action", children: [_jsxs("div", { className: "d-flex w-100 justify-content-between", children: [_jsx("h5", { className: "mb-1", children: convo.phone_number }), _jsx("small", { children: new Date(convo.last_message_at).toLocaleString() })] }), _jsxs("p", { className: "mb-1", children: ["Messages: ", convo.message_count] })] }, convo.phone_number)))) : (_jsx("p", { children: "No SMS conversations found." })) })] }));
}
export default SMSConversations;
