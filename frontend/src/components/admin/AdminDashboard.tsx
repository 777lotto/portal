// frontend/src/components/admin/AdminDashboard.tsx - MODIFIED
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiGet, deleteUser } from '../../lib/api.js'; // Import deleteUser
import type { User } from '@portal/shared';

function AdminDashboard() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await apiGet<User[]>('/api/admin/users');
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

  // ADD THIS FUNCTION
  const handleDeleteUser = async (userToDelete: User) => {
    if (window.confirm(`Are you sure you want to permanently delete ${userToDelete.name} (${userToDelete.email}) and all their data? This action cannot be undone.`)) {
      try {
        await deleteUser(userToDelete.id.toString());
        // Remove the user from the list in the UI without a page reload
        setUsers(currentUsers => currentUsers.filter(user => user.id !== userToDelete.id));
      } catch (err: any) {
        setError(`Failed to delete user: ${err.message}`);
      }
    }
  };

  if (isLoading) return <div className="container mt-4">Loading users...</div>;
  if (error) return <div className="container mt-4 alert alert-danger">{error}</div>;

  return (
    <div className="container mt-4">
      <h2>Admin Dashboard</h2>
      <p>Select a user to manage their photos and notes, or delete them.</p>

      <div className="list-group">
        {users.length > 0 ? (
          users.map(user => (
            <div key={user.id} className="list-group-item list-group-item-action d-flex justify-content-between align-items-center">
              <Link to={`/admin/users/${user.id}`} className="flex-grow-1 text-decoration-none">
                <div>
                  <h5 className="mb-1">{user.name}</h5>
                  <p className="mb-1 text-muted">{user.email} {user.phone && `| ${user.phone}`}</p>
                </div>
              </Link>
              <div className="d-flex align-items-center">
                <span className={`badge me-2 ${user.role === 'admin' ? 'bg-success' : 'bg-secondary'}`}>{user.role}</span>
                 {/* ADD THIS DELETE BUTTON */}
                <button
                  onClick={() => handleDeleteUser(user)}
                  className="btn btn-sm btn-danger"
                  aria-label={`Delete user ${user.name}`}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        ) : (<p>No users found.</p>)}
      </div>
    </div>
  );
}

export default AdminDashboard;
