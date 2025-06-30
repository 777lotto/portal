import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// frontend/src/components/SMSConversation.tsx - CORRECTED
import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getSmsConversation, sendSms } from '../lib/api.js';
function SMSConversation() {
    const { phoneNumber } = useParams();
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState(null);
    const messagesEndRef = useRef(null);
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };
    useEffect(scrollToBottom, [messages]);
    useEffect(() => {
        if (!phoneNumber)
            return;
        const fetchMessages = async () => {
            try {
                setIsLoading(true);
                setError(null);
                const data = await getSmsConversation(phoneNumber); // FIX: Removed token argument
                setMessages(data);
            }
            catch (err) {
                setError(err.message);
            }
            finally {
                setIsLoading(false);
            }
        };
        fetchMessages();
    }, [phoneNumber]);
    const handleSend = async (e) => {
        e.preventDefault();
        if (!phoneNumber || !newMessage.trim())
            return;
        try {
            setIsSending(true);
            setError(null);
            const sentMessage = await sendSms(phoneNumber, newMessage); // FIX: Removed token argument
            setMessages(prev => [...prev, sentMessage]);
            setNewMessage('');
        }
        catch (err) {
            setError(err.message);
        }
        finally {
            setIsSending(false);
        }
    };
    if (isLoading)
        return _jsx("div", { className: "container mt-4", children: "Loading messages..." });
    return (_jsxs("div", { className: "container mt-4", children: [_jsx(Link, { to: "/sms", children: "\u2190 Back to Conversations" }), _jsxs("h2", { className: "mt-2", children: ["Conversation with ", phoneNumber] }), error && _jsx("div", { className: "alert alert-danger", children: error }), _jsxs("div", { className: "card mt-3", children: [_jsxs("div", { className: "card-body", style: { height: '60vh', overflowY: 'auto' }, children: [messages.map((msg, index) => (_jsx("div", { className: `d-flex mb-2 ${msg.direction === 'outgoing' ? 'justify-content-end' : 'justify-content-start'}`, children: _jsxs("div", { className: `p-2 rounded shadow-sm ${msg.direction === 'outgoing' ? 'bg-primary text-white' : 'bg-light'}`, style: { maxWidth: '75%' }, children: [_jsx("p", { className: "mb-1", children: msg.message }), _jsx("small", { className: `d-block ${msg.direction === 'outgoing' ? 'text-light' : 'text-muted'}`, children: new Date(msg.created_at).toLocaleTimeString() })] }) }, msg.id || index))), _jsx("div", { ref: messagesEndRef })] }), _jsx("div", { className: "card-footer", children: _jsxs("form", { onSubmit: handleSend, className: "d-flex", children: [_jsx("input", { type: "text", className: "form-control me-2", value: newMessage, onChange: (e) => setNewMessage(e.target.value), placeholder: "Type a message...", disabled: isSending }), _jsx("button", { type: "submit", className: "btn btn-primary", disabled: isSending || !newMessage.trim(), children: isSending ? 'Sending...' : 'Send' })] }) })] })] }));
}
export default SMSConversation;
