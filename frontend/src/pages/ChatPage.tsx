// frontend/src/pages/ChatPage.tsx
import useAuth from '../hooks/useAuth';
import AdminChatDashboard from '../components/admin/AdminChatDashboard';
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
        <SupportChatWidget user={user} />
      )}
    </div>
  );
};

export default ChatPage;
