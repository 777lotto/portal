// frontend/src/components/chat/AdminChatMessageView.tsx
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import type { ChatMessage, User } from '@portal/shared';
import { format } from 'date-fns';

interface Props {
  selectedUser: User;
  chatPartnerName?: string; // Add this optional prop
}

export function AdminChatMessageView({ selectedUser, chatPartnerName }: Props) { // Add chatPartnerName here
  const { user: adminUser } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const ws = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll to the bottom whenever messages change
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    // Establish WebSocket connection when a user is selected
    const token = localStorage.getItem("token");
    if (!selectedUser || !token) return;

    // Close any existing connection before opening a new one
    if (ws.current) {
      ws.current.close();
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const chatHost = 'chat.777.foo';
    const roomId = selectedUser.id;
    const url = `${protocol}//${chatHost}/api/chat/${roomId}?token=${token}`;

    const socket = new WebSocket(url);
    ws.current = socket;

    socket.onopen = () => {
      console.log(`Chat connected for user: ${selectedUser.name}`);
      setMessages([]); // Clear previous messages
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'all') {
        setMessages(data.messages);
      } else if (data.type === 'add') {
        setMessages(prev => [...prev, data]);
      }
    };

    socket.onerror = (error) => console.error("WebSocket Error:", error);

    // Cleanup on component unmount or when user changes
    return () => {
      socket.close();
    };
  }, [selectedUser]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ content: input }));
      setInput('');
    }
  };

  return (
    <div className="card flex flex-col h-full">
      <div className="card-header">
        <h3 className="card-title text-xl">{chatPartnerName || `Chat with ${selectedUser.name}`}</h3>
      </div>
      <div className="card-body flex-grow overflow-y-auto bg-secondary-light dark:bg-primary-dark p-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'assistant' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-xs lg:max-w-md p-3 rounded-lg ${msg.role === 'assistant' ? 'bg-event-blue text-white' : 'bg-white dark:bg-tertiary-dark'}`}>
              <p className="text-sm">{msg.content}</p>
              <p className={`text-xs opacity-75 mt-1 ${msg.role === 'assistant' ? 'text-right' : 'text-left'}`}>
                {msg.user} - {format(new Date(), 'p')}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="card-footer p-4">
        <form onSubmit={handleSendMessage} className="flex space-x-2">
          <input
            type="text"
            className="form-control flex-grow"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
          />
          <button type="submit" className="btn btn-primary">Send</button>
        </form>
      </div>
    </div>
  );
}
