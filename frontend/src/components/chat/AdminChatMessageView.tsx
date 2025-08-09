// frontend/src/components/chat/AdminChatMessageView.tsx
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { fetchJson } from '../../lib/fetchJson';
import type { ChatMessage, User } from '@portal/shared';
import { format } from 'date-fns';
import ChatPhotoSelectorModal from '../modals/ChatPhotoSelectorModal';

interface Props {
  selectedUser: User;
  chatPartnerName?: string; // Add this optional prop
}

export function AdminChatMessageView({ selectedUser, chatPartnerName }: Props) { // Add chatPartnerName here
  const { user: adminUser } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isPhotoSelectorOpen, setIsPhotoSelectorOpen] = useState(false);
  const ws = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const result = await fetchJson<{ success: boolean; attachment?: ChatMessage['attachment']; message?: string }>('/api/chat/upload', {
        method: 'POST',
        body: formData,
      });

      if (result.success && result.attachment && ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({ attachment: result.attachment }));
      } else {
        console.error("File upload failed:", result.message);
      }
    } catch (error) {
      console.error("File upload error:", error);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handlePhotoSelect = (attachment: ChatMessage['attachment']) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ attachment }));
    }
    setIsPhotoSelectorOpen(false);
  };

  return (
    <div className="card flex flex-col h-full">
      <div className="card-header">
        <h3 className="card-title text-xl">{chatPartnerName || `Chat with ${selectedUser.name}`}</h3>
      </div>
      <div className="card-body grow overflow-y-auto bg-secondary-light dark:bg-primary-dark p-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'assistant' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-xs lg:max-w-md p-3 rounded-lg ${msg.role === 'assistant' ? 'bg-event-blue text-white' : 'bg-white dark:bg-tertiary-dark'}`}>
              <p className="text-sm">{msg.content}</p>
              {msg.attachment && (
                <div className="mt-2">
                  {msg.attachment.fileType.startsWith('image/') ? (
                    <img src={msg.attachment.url} alt={msg.attachment.fileName} className="max-w-full h-auto rounded-md" />
                  ) : (
                    <a href={msg.attachment.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                      <span>{msg.attachment.fileName}</span>
                    </a>
                  )}
                </div>
              )}
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
        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" disabled={isUploading} />
          <button type="button" onClick={() => fileInputRef.current?.click()} className="btn btn-ghost btn-circle" disabled={isUploading} aria-label="Attach file from device">
            {isUploading ? <span className="loading loading-spinner"></span> : <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>}
          </button>
          <button type="button" onClick={() => setIsPhotoSelectorOpen(true)} className="btn btn-ghost btn-circle" disabled={isUploading} aria-label="Attach photo from account">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l-1-1m6-3l-2 2" /></svg>
          </button>
          <input
            type="text"
            className="form-control grow"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            disabled={isUploading}
          />
          <button type="submit" className="btn btn-primary" disabled={isUploading || !input.trim()}>Send</button>
        </form>
      </div>
      {adminUser &&
        <ChatPhotoSelectorModal
          isOpen={isPhotoSelectorOpen}
          onClose={() => setIsPhotoSelectorOpen(false)}
          onPhotoSelect={handlePhotoSelect}
          chatUser={selectedUser}
        />
      }
    </div>
  );
}
