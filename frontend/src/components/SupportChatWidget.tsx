// frontend/src/components/SupportChatWidget.tsx
import React, { useState, useEffect, useRef } from 'react';

interface ChatMessage {
  user: string;
  message: string;
  timestamp: number;
}

// Define the type for the user prop
interface UserPayload {
  id: number;
  role: 'customer' | 'admin';
}

const SupportChatWidget = ({ user }: { user: UserPayload }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (isOpen && !ws.current) {
      const token = localStorage.getItem("token");
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

      // MODIFICATION: Point to the dedicated chat service
      const chatHost = 'chat.777.foo';
      const roomId = user.id; // The room is unique to the logged-in user
      const url = `${protocol}//${chatHost}/api/chat/${roomId}?token=${token}`;

      const socket = new WebSocket(url);

      socket.onopen = () => console.log("Chat connected");
      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'history' || data.type === 'all') { // The durable-chat worker uses 'all'
          setMessages(data.messages);
        } else if (data.type === 'message' || data.type === 'add') { // The durable-chat worker uses 'add'
          const newMessage = data.type === 'add' ? data : data.message;
          setMessages(prev => [...prev, newMessage]);
        }
      };
      ws.current = socket;
    } else if (!isOpen && ws.current) {
      ws.current.close();
      ws.current = null;
    }
  }, [isOpen, user]); // Add user to dependency array

  const sendMessage = () => {
    if (input.trim() && ws.current) {
      // The durable-chat worker expects an object with a `content` property
      ws.current.send(JSON.stringify({ type: 'add', content: input }));
      setInput('');
    }
  };

  return (
    <>
      <div style={{ position: 'fixed', bottom: '20px', right: '20px' }}>
        <button onClick={() => setIsOpen(!isOpen)} className="btn btn-primary">
          {isOpen ? 'Close Chat' : 'Support Chat'}
        </button>
      </div>
      {isOpen && (
        <div style={{ position: 'fixed', bottom: '80px', right: '20px', width: '350px', height: '500px' }} className="card">
          <div className="card-header">
            <h5 className="card-title">Support Chat</h5>
          </div>
          <div className="card-body" style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column-reverse' }}>
            <div>
              {messages.map((msg, index) => (
                <div key={msg.id || index} className={`chat-message ${msg.user === 'You' ? 'text-right' : ''}`}>
                  <p><strong>{msg.user}:</strong> {msg.content}</p>
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
            <button onClick={sendMessage} className="btn btn-primary mt-2">Send</button>
          </div>
        </div>
      )}
    </>
  );
};

export default SupportChatWidget;
