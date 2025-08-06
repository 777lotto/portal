// frontend/src/components/chat/SupportChatWidget.tsx
import React, { useState, useEffect, useRef } from 'react';
import type { ChatMessage, User } from '@portal/shared';
import { useAuth } from '../../hooks/useAuth';

const SupportChatWidget = ({ user }: { user: User }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const ws = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user: currentUser } = useAuth(); // Get the currently logged-in user

  useEffect(() => {
    // Scroll to the bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isOpen && !ws.current) {
      const token = localStorage.getItem("token");
      if (!token) return;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const chatHost = 'chat.777.foo';
      const roomId = user.id;
      const url = `${protocol}//${chatHost}/api/chat/${roomId}?token=${token}`;

      const socket = new WebSocket(url);
      ws.current = socket;

      socket.onopen = () => console.log("Chat connected");
      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'all') {
          setMessages(data.messages);
        } else if (data.type === 'add') {
          setMessages(prev => [...prev, data]);
        }
      };
      socket.onerror = (error) => console.error("WebSocket Error:", error);

    } else if (!isOpen && ws.current) {
      ws.current.close();
      ws.current = null;
    }

    return () => {
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.close();
        ws.current = null;
      }
    };
  }, [isOpen, user]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ content: input }));
      setInput('');
    }
  };

  const getDisplayName = (msg: ChatMessage) => {
    if (!currentUser) return msg.user;

    // Admin's perspective
    if (currentUser.role === 'admin') {
      return msg.role === 'assistant' ? null : msg.user; // Show customer name, hide "Support"
    }

    // Customer's perspective
    if (currentUser.role === 'customer' || currentUser.role === 'guest') {
      return msg.role === 'user' ? 'Me' : null; // Show "Me" for their own, hide "Support"
    }

    return msg.user;
  };

  return (
    <>
      <div className="fixed bottom-5 right-5 z-40">
        <button onClick={() => setIsOpen(!isOpen)} className="btn btn-primary shadow-lg rounded-full px-6 py-3">
          {isOpen ? 'Close Chat' : 'Support Chat'}
        </button>
      </div>
      {isOpen && (
        <div className="fixed bottom-20 right-5 w-[350px] h-[500px] card flex flex-col z-50">
          <div className="card-header flex-shrink-0">
            <h5 className="card-title text-xl">Support Chat</h5>
          </div>
          <div className="card-body flex-grow overflow-y-auto bg-secondary-light dark:bg-primary-dark p-4 space-y-4">
            {messages.map((msg) => {
              const displayName = getDisplayName(msg);
              const isCurrentUser = (currentUser?.role === 'admin' && msg.role === 'assistant') || (currentUser?.role !== 'admin' && msg.role === 'user');

              return (
                <div key={msg.id} className={`flex flex-col ${isCurrentUser ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-xs lg:max-w-md p-3 rounded-lg ${isCurrentUser ? 'bg-event-blue text-white' : 'bg-white dark:bg-tertiary-dark'}`}>
                    {displayName && <p className="text-xs font-bold opacity-80 mb-1">{displayName}</p>}
                    <p className="text-sm">{msg.content}</p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
          <div className="card-footer p-4 flex-shrink-0">
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
      )}
    </>
  );
};

export default SupportChatWidget;
