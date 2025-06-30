// frontend/src/components/SMSConversation.tsx - CORRECTED
import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getSmsConversation, sendSms } from '../lib/api.js';
import type { SMSMessage } from '@portal/shared';

function SMSConversation() {
  const { phoneNumber } = useParams<{ phoneNumber: string }>();
  const [messages, setMessages] = useState<SMSMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<null | HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(scrollToBottom, [messages]);

  useEffect(() => {
    if (!phoneNumber) return;

    const fetchMessages = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await getSmsConversation(phoneNumber); // FIX: Removed token argument
        setMessages(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchMessages();
  }, [phoneNumber]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber || !newMessage.trim()) return;

    try {
      setIsSending(true);
      setError(null);
      const sentMessage = await sendSms(phoneNumber, newMessage); // FIX: Removed token argument
      setMessages(prev => [...prev, sentMessage]);
      setNewMessage('');
    } catch(err: any) {
      setError(err.message);
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) return <div className="container mt-4">Loading messages...</div>;

  return (
    <div className="container mt-4">
      <Link to="/sms">&larr; Back to Conversations</Link>
      <h2 className="mt-2">Conversation with {phoneNumber}</h2>
      {error && <div className="alert alert-danger">{error}</div>}
      <div className="card mt-3">
        <div className="card-body" style={{ height: '60vh', overflowY: 'auto' }}>
          {messages.map((msg, index) => (
            <div key={msg.id || index} className={`d-flex mb-2 ${msg.direction === 'outgoing' ? 'justify-content-end' : 'justify-content-start'}`}>
              <div className={`p-2 rounded shadow-sm ${msg.direction === 'outgoing' ? 'bg-primary text-white' : 'bg-light'}`} style={{ maxWidth: '75%' }}>
                <p className="mb-1">{msg.message}</p>
                <small className={`d-block ${msg.direction === 'outgoing' ? 'text-light' : 'text-muted'}`}>{new Date(msg.created_at).toLocaleTimeString()}</small>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        <div className="card-footer">
          <form onSubmit={handleSend} className="d-flex">
            <input
              type="text"
              className="form-control me-2"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              disabled={isSending}
            />
            <button type="submit" className="btn btn-primary" disabled={isSending || !newMessage.trim()}>
              {isSending ? 'Sending...' : 'Send'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default SMSConversation;
