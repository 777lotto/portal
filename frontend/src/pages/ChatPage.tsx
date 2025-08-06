// frontend/src/pages/ChatPage.tsx
import { useAuth } from '../hooks/useAuth';
import AdminChatDashboard from './admin/AdminChatDashboard';
import { AdminChatMessageView } from '../components/chat/AdminChatMessageView'; // Import the new component

const ChatPage = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    // Should be redirected by auth logic, but as a fallback:
    return <div>Please log in to view messages.</div>;
  }

  return (
    // Set a height on the container so the chat view can fill it
    <div className="container mx-auto h-[calc(100vh-8rem)]">
      {user.role === 'admin' ? (
        <AdminChatDashboard />
      ) : (
        // Use the full-page view for customers
        <AdminChatMessageView selectedUser={user} chatPartnerName="Chat with Support" />
      )}
    </div>
  );
};

export default ChatPage;
