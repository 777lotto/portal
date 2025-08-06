// frontend/src/pages/admin/AdminChatDashboard.tsx
import { useState } from 'react';
import useSWR from 'swr';
import { apiGet } from '../../lib/api';
import type { User } from '@portal/shared';
import { AdminChatMessageView } from '../../components/chat/AdminChatMessageView';

const AdminChatDashboard = () => {
  const { data: users, error } = useSWR<User[]>('/api/admin/users', apiGet);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  if (error) return <div className="text-center p-4">Failed to load users.</div>;
  if (!users) return <div className="text-center p-4">Loading users...</div>;

  // Filter out admins and associates from the chat list
  const chatUsers = users.filter(u => u.role === 'customer' || u.role === 'guest');

  return (
    <div className="flex h-[calc(100vh-8rem)]"> {/* Full height minus navbar */}
      {/* Left Pane: User List */}
      <aside className="w-1/3 xl:w-1/4 pr-4">
        <div className="card h-full flex flex-col">
           <div className="card-header">
             <h2 className="card-title text-xl">Conversations</h2>
           </div>
           <div className="card-body overflow-y-auto">
              <ul className="divide-y divide-border-light dark:divide-border-dark">
                {chatUsers.map((user) => (
                  <li key={user.id}>
                    <button
                      onClick={() => setSelectedUser(user)}
                      className={`w-full text-left p-3 transition-colors ${selectedUser?.id === user.id ? 'bg-event-blue/20' : 'hover:bg-secondary-light dark:hover:bg-secondary-dark'}`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-text-primary-light dark:text-text-primary-dark">{user.name || user.company_name}</span>
                        {/* TODO: Connect this to a backend value indicating unread messages */}
                        <span className="h-2 w-2 bg-event-red rounded-full hidden"></span>
                      </div>
                      <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark truncate">
                        {user.email || user.phone}
                      </p>
                       <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark truncate mt-1 italic">
                        {/* TODO: Display last message preview from backend */}
                        Click to view conversation
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
           </div>
        </div>
      </aside>

      {/* Right Pane: Chat View */}
      <main className="w-2/3 xl:w-3/4 h-full">
        {selectedUser ? (
          <AdminChatMessageView selectedUser={selectedUser} />
        ) : (
          <div className="card h-full flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-text-primary-light dark:text-text-primary-dark">Select a Conversation</h2>
              <p className="text-text-secondary-light dark:text-text-secondary-dark">Choose a user from the list on the left to start chatting.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminChatDashboard;
