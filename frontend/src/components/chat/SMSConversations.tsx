import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { HTTPException } from 'hono/http-exception';
import type { Conversation } from '@portal/shared';
import { useQuery } from '@tanstack/react-query';

// Helper to get a user-friendly error message
async function getErrorMessage(err: unknown): Promise<string> {
    if (err instanceof HTTPException) {
        try {
            const errorJson = await err.response.json();
            return errorJson.error || 'Failed to fetch conversations';
        } catch {
            return 'An unexpected server error occurred.';
        }
    } else if (err instanceof Error) {
        return err.message;
    }
    return 'An unknown error occurred.';
}

function SMSConversations() {
  const { data: conversations, isLoading, error } = useQuery<Conversation[], Error>({
    queryKey: ['sms', 'conversations'],
    queryFn: async () => {
      const res = await api.sms.conversations.$get();
      if (!res.ok) {
        throw new HTTPException(res.status, { res });
      }
      return res.json();
    },
    // Poll for new conversations or updates every 30 seconds
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
        <div className="flex justify-center items-center h-64">
            <span className="loading loading-spinner loading-lg"></span>
        </div>
    );
  }

  if (error) {
    return <div className="alert alert-error shadow-lg"><div><span>Error: {error.message}</span></div></div>;
  }

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">SMS Conversations</h2>
      <div className="space-y-2">
        {conversations && conversations.length > 0 ? (
          conversations.map(convo => (
            <Link key={convo.phone_number} to={`/admin/chat/${convo.phone_number}`} className="card bg-base-100 shadow-md hover:shadow-lg transition-shadow">
              <div className="card-body">
                <div className="flex w-full justify-between items-center">
                  <h5 className="card-title">{convo.phone_number}</h5>
                  <small className="text-base-content/70">{new Date(convo.last_message_at).toLocaleString()}</small>
                </div>
                <p className="mb-1 text-base-content/80">Messages: {convo.message_count}</p>
              </div>
            </Link>
          ))
        ) : (
          <div className="card bg-base-100 shadow-md">
            <div className="card-body">
                <p>No SMS conversations found.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SMSConversations;
