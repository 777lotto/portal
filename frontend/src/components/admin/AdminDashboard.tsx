// frontend/src/components/admin/AdminDashboard.tsx - Corrected

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiGet } from '../../lib/api';
import type { User } from '@portal/shared';

function AdminDashboard() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        setError("Authentication token not found.");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        // FIX: API call is now wrapped in try/catch
        const data = await apiGet<User[]>('/api/admin/users', token);
        setUsers(data);
      } catch (err: any) {
        console.error("Error fetching users:", err);
        setError(err.message || 'An unknown error occurred.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, []);

  if (isLoading) return <div className="container mt-4">Loading users...</div>;
  if (error) return <div className="container mt-4 alert alert-danger">{error}</div>;

  return (
    <div className="container mt-4">
      <h2>Admin Dashboard</h2>
      <p>Select a user to manage their photos and notes.</p>

      <div className="list-group">
        {users.length > 0 ? (
          users.map(user => (
            <Link
              key={user.id}
              to={`/admin/users/${user.id}`}
              className="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
            >
              <div>
                <h5 className="mb-1">{user.name}</h5>
                <p className="mb-1 text-muted">{user.email} {user.phone && `| ${user.phone}`}</p>
              </div>
              <div>
                <span className={`badge me-2 ${user.role === 'admin' ? 'bg-success' : 'bg-secondary'}`}>{user.role}</span>
                <span className="badge bg-primary rounded-pill">Manage</span>
              </div>
            </Link>
          ))
        ) : (<p>No users found.</p>)}
      </div>
    </div>
  );
}

export default AdminDashboard;
