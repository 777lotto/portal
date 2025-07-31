// frontend/src/components/admin/AdminChat.tsx
import React, { useState, useEffect, useRef } from 'react';
import { apiGet } from '../../../lib/api';
import { User } from '@portal/shared';

interface ChatMessage {
  user: string;
  content: string; // The durable-chat worker uses 'content'
  id?: string;
}

const AdminChat = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    apiGet<User[]>('/api/admin/users').then(setUsers);
  }, []);

  useEffect(() => {
    if (selectedUser) {
      if (ws.current) {
        ws.current.close();
      }
      const token = localStorage.getItem("token");
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

      // MODIFICATION: Point to the dedicated chat service
      const chatHost = 'chat.777.foo';
      const roomId = selectedUser.id; // Room is the customer's ID
      const url = `${protocol}//${chatHost}/api/chat/${roomId}?token=${token}`;

      const socket = new WebSocket(url);

      socket.onopen = () => console.log(`Admin chat connected to user ${selectedUser.id}`);
      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'all') {
          setMessages(data.messages);
        } else if (data.type === 'add') {
          setMessages(prev => [...prev, data]);
        }
      };
      ws.current = socket;
    }
  }, [selectedUser]);

  const sendMessage = () => {
    if (input.trim() && ws.current) {
      // The durable-chat worker expects an object with a `content` property
      ws.current.send(JSON.stringify({ type: 'add', content: input }));
      setInput('');
    }
  };

  return (
    <div className="container mt-4">
      <div className="row">
        <div className="col-4">
          <h2>Users</h2>
          <ul className="list-group">
            {users.map(user => (
              <li key={user.id} className={`list-group-item ${selectedUser?.id === user.id ? 'active' : ''}`} onClick={() => setSelectedUser(user)}>
                {user.name || user.email}
              </li>
            ))}
          </ul>
        </div>
        <div className="col-8">
          {selectedUser ? (
            <div className="card">
              <div className="card-header">Chat with {selectedUser.name || selectedUser.email}</div>
              <div className="card-body" style={{ height: '500px', overflowY: 'auto' }}>
                {messages.map((msg, index) => (
                  <div key={msg.id || index} className={`chat-message ${msg.user === 'You' ? 'text-right' : ''}`}>
                    <p><strong>{msg.user}:</strong> {msg.content}</p>
                  </div>
                ))}
              </div>
              <div className="card-footer">
                <input type="text" className="form-control" value={input} onChange={e => setInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && sendMessage()} />
                <button onClick={sendMessage} className="btn btn-primary mt-2">Send</button>
              </div>
            </div>
          ) : (
            <p>Select a user to start chatting.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminChat;
