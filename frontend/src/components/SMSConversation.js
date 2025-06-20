import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// frontend/src/components/SMSConversation.tsx
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getConversation, sendSMS } from '../lib/api';
export default function SMSConversation() {
    const { phoneNumber } = useParams();
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef(null);
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    // Fetch conversation messages
    useEffect(() => {
        async function fetchMessages() {
            if (!phoneNumber)
                return;
            try {
                setLoading(true);
                const data = await getConversation(phoneNumber, token);
                setMessages(data.reverse()); // Reverse to show oldest first
            }
            catch (err) {
                setError(err.message || 'Failed to load messages');
            }
            finally {
                setLoading(false);
            }
        }
        fetchMessages();
        // Poll for new messages every 15 seconds
        const interval = setInterval(fetchMessages, 15000);
        return () => clearInterval(interval);
    }, [phoneNumber, token]);
    // Scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);
    // Handle sending a new message
    const handleSend = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !phoneNumber)
            return;
        try {
            setSending(true);
            await sendSMS(phoneNumber, newMessage, token);
            // Add message locally (optimistic update)
            setMessages([
                ...messages,
                {
                    id: Date.now(), // Temporary ID
                    direction: 'outgoing',
                    message: newMessage,
                    created_at: new Date().toISOString(),
                    status: 'sent'
                }
            ]);
            // Clear input
            setNewMessage('');
        }
        catch (err) {
            setError(err.message || 'Failed to send message');
        }
        finally {
            setSending(false);
        }
    };
    if (loading && messages.length === 0) {
        return _jsx("div", { style: { padding: '2rem' }, children: "Loading conversation..." });
    }
    return (_jsxs("div", { style: { padding: '1rem' }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', marginBottom: '1rem' }, children: [_jsx("button", { onClick: () => navigate('/sms'), style: { marginRight: '1rem', padding: '0.5rem', background: 'transparent', border: '1px solid #ddd' }, children: "\u2190 Back" }), _jsxs("h2", { style: { margin: 0 }, children: ["Conversation with ", phoneNumber] })] }), error && (_jsx("div", { style: { color: 'red', marginBottom: '1rem' }, children: error })), _jsxs("div", { style: {
                    height: '400px',
                    overflowY: 'auto',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    padding: '1rem',
                    marginBottom: '1rem'
                }, children: [messages.length === 0 ? (_jsx("div", { style: { textAlign: 'center', color: '#888', marginTop: '1rem' }, children: "No messages yet. Start the conversation!" })) : (messages.map(msg => (_jsxs("div", { style: {
                            maxWidth: '70%',
                            marginBottom: '0.5rem',
                            padding: '0.5rem 1rem',
                            borderRadius: '1rem',
                            backgroundColor: msg.direction === 'outgoing' ? '#007bff' : '#f1f1f1',
                            color: msg.direction === 'outgoing' ? 'white' : 'black',
                            alignSelf: msg.direction === 'outgoing' ? 'flex-end' : 'flex-start',
                            marginLeft: msg.direction === 'outgoing' ? 'auto' : 0,
                        }, children: [_jsx("div", { children: msg.message }), _jsx("div", { style: {
                                    fontSize: '0.7rem',
                                    opacity: 0.7,
                                    textAlign: msg.direction === 'outgoing' ? 'right' : 'left'
                                }, children: new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })] }, msg.id)))), _jsx("div", { ref: messagesEndRef })] }), _jsxs("form", { onSubmit: handleSend, style: { display: 'flex' }, children: [_jsx("input", { type: "text", value: newMessage, onChange: (e) => setNewMessage(e.target.value), placeholder: "Type your message...", style: {
                            flex: 1,
                            padding: '0.5rem',
                            borderRadius: '4px 0 0 4px',
                            border: '1px solid #ddd',
                            borderRight: 'none'
                        }, disabled: sending }), _jsx("button", { type: "submit", disabled: sending || !newMessage.trim(), style: {
                            padding: '0.5rem 1rem',
                            backgroundColor: '#007bff',
                            color: 'white',
                            border: 'none',
                            borderRadius: '0 4px 4px 0',
                            cursor: sending || !newMessage.trim() ? 'not-allowed' : 'pointer',
                            opacity: sending || !newMessage.trim() ? 0.7 : 1
                        }, children: sending ? 'Sending...' : 'Send' })] })] }));
}
