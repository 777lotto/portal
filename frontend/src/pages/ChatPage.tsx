// frontend/src/pages/ChatPage.tsx
import { useAuth } from '../hooks/useAuth';
import AdminChatDashboard from './admin/AdminChatDashboard';
import SupportChatWidget from '../components/chat/SupportChatWidget';

const ChatPage = () => {
  const { user } = useAuth();

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto p-4">
      {user.role === 'admin' ? (
        <AdminChatDashboard />
      ) : (
        // We will need to update SupportChatWidget if it makes API calls,
        // but the ChatPage itself is fine.
        <SupportChatWidget user={user} />
      )}
    </div>
  );
};

export default ChatPage;
