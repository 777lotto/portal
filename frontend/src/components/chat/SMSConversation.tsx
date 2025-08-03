import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { HTTPException } from 'hono/http-exception';
import type { SMSMessage } from '@portal/shared';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

function SMSConversation() {
  const { phoneNumber } = useParams<{ phoneNumber: string }>();
  const queryClient = useQueryClient();
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<null | HTMLDivElement>(null);

  const { data: messages, isLoading, error } = useQuery<SMSMessage[], Error>({
    queryKey: ['sms', 'conversation', phoneNumber],
    queryFn: async () => {
      if (!phoneNumber) return [];
      const res = await api.sms.conversation[':phoneNumber'].$get({
        param: { phoneNumber }
      });
      if (!res.ok) throw new HTTPException(res.status, { res });
      return res.json();
    },
    enabled: !!phoneNumber,
    // Poll for new messages every 5 seconds when the window is focused
    refetchInterval: 5000,
  });

  const sendMessageMutation = useMutation({
    mutationFn: (messageText: string) => {
      if (!phoneNumber) throw new Error("Phone number is missing.");
      return api.sms.send.$post({
        json: { to: phoneNumber, message: messageText }
      });
    },
    onSuccess: async (res) => {
      if (!res.ok) throw new HTTPException(res.status, { res });
      setNewMessage('');
      // Invalidate both the specific conversation and the list of conversations
      // to ensure the UI updates everywhere.
      await queryClient.invalidateQueries({ queryKey: ['sms', 'conversation', phoneNumber] });
      await queryClient.invalidateQueries({ queryKey: ['sms', 'conversations'] });
    },
  });

  // Effect to scroll to the bottom of the message list when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    sendMessageMutation.mutate(newMessage);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
          <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col h-[calc(100vh-8rem)]">
      <Link to="/admin/chat" className="btn btn-ghost mb-4 self-start">&larr; Back to Conversations</Link>
      <h2 className="text-2xl font-bold mb-4">Conversation with {phoneNumber}</h2>

      {(error || sendMessageMutation.error) && (
        <div className="alert alert-error shadow-lg">
          <div>
            <span>Error: {error?.message || sendMessageMutation.error?.message}</span>
          </div>
        </div>
      )}

      <div className="card bg-base-100 shadow-xl flex-grow flex flex-col">
        <div className="card-body overflow-y-auto p-4 space-y-4">
          {messages?.map((msg) => (
            <div key={msg.id} className={`chat ${msg.direction === 'outgoing' ? 'chat-end' : 'chat-start'}`}>
              <div className={`chat-bubble ${msg.direction === 'outgoing' ? 'chat-bubble-primary' : ''}`}>
                <p>{msg.message}</p>
                <time className="text-xs opacity-50">{new Date(msg.createdAt).toLocaleTimeString()}</time>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        <div className="card-footer p-4 border-t">
          <form onSubmit={handleSend} className="flex gap-2">
            <input
              type="text"
              className="input input-bordered flex-grow"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              disabled={sendMessageMutation.isPending}
            />
            <button type="submit" className="btn btn-primary" disabled={sendMessageMutation.isPending || !newMessage.trim()}>
              {sendMessageMutation.isPending ? <span className="loading loading-spinner"></span> : 'Send'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default SMSConversation;
