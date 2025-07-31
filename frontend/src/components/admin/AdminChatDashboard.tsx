// frontend/src/components/admin/AdminChatDashboard.tsx
import { useState } from 'react';
import useSWR from 'swr';
import { apiGet } from '../../lib/api';
import type { User } from '@portal/shared';
import SupportChatWidget from '../chat/SupportChatWidget';
import useAuth from '../../hooks/useAuth';

const AdminChatDashboard = () => {
  const { user: adminUser } = useAuth();
  const { data: users, error } = useSWR<User[]>('/api/admin/users', apiGet);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  if (error) return <div>Failed to load users</div>;
  if (!users) return <div>Loading users...</div>;

  if (selectedUser) {
    return (
      <div>
        <button onClick={() => setSelectedUser(null)} className="btn btn-secondary mb-4">
          &larr; Back to User List
        </button>
        <SupportChatWidget user={selectedUser} />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Chat with a User</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.map((user) => (
          <div key={user.id} className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title">{user.name}</h2>
              <p>{user.email}</p>
              <div className="card-actions justify-end">
                <button onClick={() => setSelectedUser(user)} className="btn btn-primary">
                  Chat
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminChatDashboard;
