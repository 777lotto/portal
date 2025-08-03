// frontend/src/pages/admin/AdminChatDashboard.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { User } from '@portal/shared';
import SupportChatWidget from '../../components/chat/SupportChatWidget';

/**
 * REFACTORED: The data-fetching function for React Query.
 * It now correctly unwraps the enveloped response from the API.
 */
const fetchUsers = async () => {
  const res = await api.admin.users.$get();
  if (!res.ok) {
    throw new Error('Failed to fetch users');
  }
  const data = await res.json();
  return data.users;
};

/**
 * REFACTORED: The component now uses `useQuery` for data fetching.
 * This replaces `useSWR` to align with the project's standard data-fetching library.
 */
const AdminChatDashboard = () => {
  const { data: users, isLoading, error } = useQuery<User[]>({
    queryKey: ['adminUsers'],
    queryFn: fetchUsers,
  });
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  if (isLoading) return <div>Loading users...</div>;
  if (error) return <div>Failed to load users: {error.message}</div>;

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
        {users?.map((user) => (
          <div key={user.id} className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title">{user.name || user.company_name}</h2>
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
