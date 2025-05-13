// frontend/src/components/SMSConversations.tsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getConversations } from '../lib/api';

interface Conversation {
  phone_number: string;
  last_message_at: string;
  message_count: number;
}

export default function SMSConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const token = localStorage.getItem('token')!;

  useEffect(() => {
    async function fetchConversations() {
      try {
        setLoading(true);
        const data = await getConversations(token);
        setConversations(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load conversations');
      } finally {
        setLoading(false);
      }
    }

    fetchConversations();
  }, [token]);

  if (loading) {
    return <div style={{ padding: '2rem' }}>Loading conversations...</div>;
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h1>SMS Conversations</h1>

      {error && (
        <div style={{ color: 'red', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {conversations.length === 0 ? (
        <p>No conversations yet.</p>
      ) : (
        <div>
          {conversations.map((conversation) => (
            <Link
              key={conversation.phone_number}
              to={`/sms/${conversation.phone_number}`}
              style={{
                display: 'block',
                padding: '1rem',
                marginBottom: '0.5rem',
                borderRadius: '4px',
                backgroundColor: '#f8f9fa',
                textDecoration: 'none',
                color: 'inherit',
                border: '1px solid #ddd',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ fontWeight: 'bold' }}>{conversation.phone_number}</div>
                <div style={{ color: '#666', fontSize: '0.9rem' }}>
                  {new Date(conversation.last_message_at).toLocaleDateString()} at{' '}
                  {new Date(conversation.last_message_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
              <div style={{ color: '#666', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                {conversation.message_count} messages
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
