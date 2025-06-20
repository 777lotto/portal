import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// frontend/src/components/SMSConversations.tsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getConversations } from '../lib/api';
export default function SMSConversations() {
    const [conversations, setConversations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const token = localStorage.getItem('token');
    useEffect(() => {
        async function fetchConversations() {
            try {
                setLoading(true);
                const data = await getConversations(token);
                setConversations(data);
            }
            catch (err) {
                setError(err.message || 'Failed to load conversations');
            }
            finally {
                setLoading(false);
            }
        }
        fetchConversations();
    }, [token]);
    if (loading) {
        return _jsx("div", { style: { padding: '2rem' }, children: "Loading conversations..." });
    }
    return (_jsxs("div", { style: { padding: '2rem' }, children: [_jsx("h1", { children: "SMS Conversations" }), error && (_jsx("div", { style: { color: 'red', marginBottom: '1rem' }, children: error })), conversations.length === 0 ? (_jsx("p", { children: "No conversations yet." })) : (_jsx("div", { children: conversations.map((conversation) => (_jsxs(Link, { to: `/sms/${conversation.phone_number}`, style: {
                        display: 'block',
                        padding: '1rem',
                        marginBottom: '0.5rem',
                        borderRadius: '4px',
                        backgroundColor: '#f8f9fa',
                        textDecoration: 'none',
                        color: 'inherit',
                        border: '1px solid #ddd',
                    }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between' }, children: [_jsx("div", { style: { fontWeight: 'bold' }, children: conversation.phone_number }), _jsxs("div", { style: { color: '#666', fontSize: '0.9rem' }, children: [new Date(conversation.last_message_at).toLocaleDateString(), " at", ' ', new Date(conversation.last_message_at).toLocaleTimeString([], {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        })] })] }), _jsxs("div", { style: { color: '#666', fontSize: '0.9rem', marginTop: '0.5rem' }, children: [conversation.message_count, " messages"] })] }, conversation.phone_number))) }))] }));
}
