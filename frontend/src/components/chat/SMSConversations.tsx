// frontend/src/components/chat/SMSConversations.tsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
// Import the new 'api' client.
import { api } from '../../lib/api';
import { ApiError } from '../../lib/fetchJson';
import type { Conversation } from '@portal/shared';

function SMSConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // --- UPDATED ---
        const res = await api.sms.conversations.$get();
        if (!res.ok) {
          const errorData = await res.json();
          throw new ApiError(errorData.error || 'Failed to fetch conversations', res.status);
        }
        const data = await res.json();
        // --- END UPDATE ---

        setConversations(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchConversations();
  }, []);

  if (isLoading) return <div className="container mt-4">Loading conversations...</div>;
  if (error) return <div className="container mt-4 alert alert-danger">{error}</div>;

  return (
    <div className="container mt-4">
      <h2>SMS Conversations</h2>
      <div className="list-group">
        {conversations.length > 0 ? (
          conversations.map(convo => (
            <Link key={convo.phone_number} to={`/sms/${convo.phone_number}`} className="list-group-item list-group-item-action">
              <div className="d-flex w-100 justify-content-between">
                <h5 className="mb-1">{convo.phone_number}</h5>
                <small>{new Date(convo.last_message_at).toLocaleString()}</small>
              </div>
              <p className="mb-1">Messages: {convo.message_count}</p>
            </Link>
          ))
        ) : (
          <p>No SMS conversations found.</p>
        )}
      </div>
    </div>
  );
}
export default SMSConversations;
