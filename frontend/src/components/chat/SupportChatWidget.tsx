// frontend/src/components/chat/SupportChatWidget.tsx
// No changes were needed for this file as it uses WebSockets, not fetch/RPC.
import React, { useState, useEffect, useRef } from 'react';
import type { ChatMessage, User } from '@portal/shared';

const SupportChatWidget = ({ user }: { user: User }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (isOpen && !ws.current) {
      const token = localStorage.getItem("token");
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const chatHost = window.location.host; // Use the main worker host
      const roomId = user.id;
      const url = `${protocol}//${chatHost}/api/chat/${roomId}?token=${token}`;

      const socket = new WebSocket(url);

      socket.onopen = () => console.log("Chat connected");
      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'all') {
          setMessages(data.messages);
        } else if (data.type === 'add') {
          setMessages(prev => [...prev, data]);
        }
      };
      ws.current = socket;
    } else if (!isOpen && ws.current) {
      ws.current.close();
      ws.current = null;
    }
  }, [isOpen, user]);

  const sendMessage = () => {
    if (input.trim() && ws.current) {
      ws.current.send(JSON.stringify({ content: input }));
      setInput('');
    }
  };

  return (
    <>
      <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 1000 }}>
        <button onClick={() => setIsOpen(!isOpen)} className="btn btn-primary shadow-lg">
          {isOpen ? 'Close Chat' : 'Support Chat'}
        </button>
      </div>
      {isOpen && (
        <div style={{ position: 'fixed', bottom: '80px', right: '20px', width: '350px', height: '500px', zIndex: 1000 }} className="card shadow-lg">
          <div className="card-header">
            <h5 className="card-title">Support Chat</h5>
          </div>
          <div className="card-body" style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column-reverse' }}>
            <div>
              {messages.map((msg) => (
                <div key={msg.id} className={`chat-message mb-2 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                  <div className={`inline-block p-2 rounded ${msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-black'}`}>
                    <p className="mb-0"><strong>{msg.user}:</strong> {msg.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="card-footer">
            <input
              type="text"
              className="form-control"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            />
            <button onClick={sendMessage} className="btn btn-primary mt-2 w-full">Send</button>
          </div>
        </div>
      )}
    </>
  );
};

export default SupportChatWidget;
