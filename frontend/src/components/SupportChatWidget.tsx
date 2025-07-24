import React, { useState, useEffect, useRef } from 'react';

interface ChatMessage {
  user: string;
  message: string;
  timestamp: number;
}

const SupportChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (isOpen && !ws.current) {
      const token = localStorage.getItem("token");
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const socket = new WebSocket(`${protocol}//${window.location.host}/api/chat?token=${token}`);

      socket.onopen = () => console.log("Chat connected");
      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'history') {
          setMessages(data.messages);
        } else if (data.type === 'message') {
          setMessages(prev => [...prev, data.message]);
        }
      };
      ws.current = socket;
    } else if (!isOpen && ws.current) {
      ws.current.close();
      ws.current = null;
    }
  }, [isOpen]);

  const sendMessage = () => {
    if (input.trim() && ws.current) {
      ws.current.send(JSON.stringify({ message: input }));
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
                <div key={index} className={`chat-message ${msg.user === 'Admin' ? 'text-right' : ''}`}>
                  <p><strong>{msg.user}:</strong> {msg.message}</p>
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
