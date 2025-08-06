import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { adminGetUser, adminUpdateUser } from '../../lib/api';
import { User } from '@portal/shared';
import EditUserModal from '../../components/modals/admin/EditUserModal';

function UserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const fetchUser = async () => {
    if (userId) {
      try {
        setIsLoading(true);
        const userData = await adminGetUser(userId);
        setUser(userData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchUser();
  }, [userId]);

  const handleUpdateUser = async (updatedData: Partial<User>) => {
    if (userId) {
      try {
        await adminUpdateUser(userId, updatedData);
        fetchUser(); // Refresh user data
        setIsEditModalOpen(false);
      } catch (err) {
        console.error("Failed to update user:", err);
        // You might want to show an error message in the modal
      }
    }
  };

  if (isLoading) {
    return <div className="text-center p-4">Loading user details...</div>;
  }

  if (error) {
    return <div className="text-center p-4 text-red-500">Error: {error}</div>;
  }

  if (!user) {
    return <div className="text-center p-4">User not found.</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">{user.name}</h1>
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            Edit User
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><p><strong>Email:</strong> {user.email}</p></div>
          <div><p><strong>Phone:</strong> {user.phone || 'N/A'}</p></div>
          <div><p><strong>Address:</strong> {user.address || 'N/A'}</p></div>
          <div><p><strong>Role:</strong> <span className="capitalize">{user.role}</span></p></div>
        </div>
        <div className="mt-6 border-t pt-6">
            <h2 className="text-xl font-semibold mb-2">Actions</h2>
            <div className="flex space-x-4">
                <Link to={`/users/${userId}/jobs`} className="text-blue-500 hover:underline">View Jobs</Link>
                <Link to={`/users/${userId}/notes`} className="text-blue-500 hover:underline">View Notes</Link>
                <Link to={`/users/${userId}/photos`} className="text-blue-500 hover:underline">View Photos</Link>
            </div>
        </div>
      </div>
      {isEditModalOpen && user && (
        <EditUserModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          user={user}
          onSave={handleUpdateUser}
        />
      )}
    </div>
  );
}

export default UserDetailPage;
