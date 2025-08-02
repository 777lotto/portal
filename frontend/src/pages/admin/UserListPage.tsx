import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { HTTPException } from 'hono/http-exception';
import type { User } from '@portal/shared';
import AddUserModal from '../../components/modals/admin/AddUserModal.js';

// No longer need fetchAndParse helper

function UserDetailEditor({ user, onUserUpdated, onCancel }: { user: User; onUserUpdated: (updatedUser: User) => void; onCancel: () => void; }) {
  const [formData, setFormData] = useState({
    name: user.name || '',
    company_name: user.company_name || '',
    email: user.email || '',
    phone: user.phone || '',
    address: user.address || '',
    role: user.role || 'customer'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await api.admin.users[':user_id'].$put({
        param: { user_id: user.id.toString() },
        json: formData
      });
      if (!res.ok) {
        throw new Error('Failed to update user');
      }
      const updatedUser = await res.json();
      onUserUpdated(updatedUser);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 bg-gray-100 dark:bg-gray-800 rounded-b-lg">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Form fields */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
          <input type="text" name="name" id="name" value={formData.name} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
        </div>
        <div>
          <label htmlFor="company_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Company Name</label>
          <input type="text" name="company_name" id="company_name" value={formData.company_name} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
          <input type="email" name="email" id="email" value={formData.email} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
        </div>
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Phone</label>
          <input type="tel" name="phone" id="phone" value={formData.phone} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
        </div>
        <div className="md:col-span-2">
          <label htmlFor="address" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Address</label>
          <input type="text" name="address" id="address" value={formData.address} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
        </div>
        <div>
          <label htmlFor="role" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Role</label>
          <select name="role" id="role" value={formData.role} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white">
            <option value="customer">Customer</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>
      {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      <div className="flex justify-end gap-2 mt-4">
        <button type="button" onClick={onCancel} className="btn btn-secondary">Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}


function UserListPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [isAddUserModalOpen, setAddUserModalOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [expandeduserId, setExpandedUserId] = useState<string | null>(null);
  const [editinguserId, setEditingUserId] = useState<string | null>(null);


  const searchTerm = searchParams.get('q') || '';
  const sortBy = searchParams.get('sortBy') || 'name';
  const sortOrder = searchParams.get('sortOrder') || 'asc';

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await api.admin.users.$get();
        if (!res.ok) {
          throw new Error('Failed to fetch users');
        }
        const data = await res.json();
        // FIX: The API returns an array of users directly.
        // It is not wrapped in a { users: ... } object.
        setUsers(data);
      } catch (error) {
        console.error("Error fetching users:", error);
      }
    };

    fetchUsers();
  }, []);

  const handleUserAdded = (newUser: User) => {
    setUsers(currentUsers => [newUser, ...currentUsers]);
  };

  const handleSort = (column: string) => {
    const newSortOrder = sortBy === column && sortOrder === 'asc' ? 'desc' : 'asc';
    setSearchParams({ q: searchTerm, sortBy: column, sortOrder: newSortOrder });
  };

  const filteredAndSortedUsers = useMemo(() => {
    if (!Array.isArray(users)) {
        return [];
    }
    let usersToSort = [...users];

    if (searchTerm) {
      usersToSort = usersToSort.filter(
        (user) =>
          user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.company_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    usersToSort.sort((a, b) => {
      const aValue = a[sortBy as keyof User] ?? '';
      const bValue = b[sortBy as keyof User] ?? '';

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return usersToSort;
  }, [users, searchTerm, sortBy, sortOrder]);

  const [currentPage, setCurrentPage] = useState(1);
  const usersPerPage = 10;
  const totalPages = Math.ceil(filteredAndSortedUsers.length / usersPerPage);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleRowClick = (userId: string) => {
    if (editinguserId === userId) return; // Don't collapse if editing
    setExpandedUserId(currentId => (currentId === userId ? null : userId));
    setEditingUserId(null); // Close editor when expanding/collapsing
  };

  const handleUserUpdated = (updatedUser: User) => {
    setUsers(currentUsers => currentUsers.map(u => u.id === updatedUser.id ? updatedUser : u));
    setEditingUserId(null); // Exit editing mode
  };

  const handleDeleteUser = async (userToDelete: User) => {
    if (window.confirm(`Are you sure you want to delete ${userToDelete.name}?`)) {
      try {
        const res = await api.admin.users[':user_id'].$delete({
          param: { user_id: userToDelete.id.toString() },
        });
        if (!res.ok) {
          throw new Error('Failed to delete user');
        }
        setUsers(currentUsers => currentUsers.filter(u => u.id !== userToDelete.id));
      } catch (error) {
        console.error("Error deleting user:", error);
        // You might want to show an error message to the user here
      }
    }
  };


  return (
    <>
      <AddUserModal
        isOpen={isAddUserModalOpen}
        onClose={() => setAddUserModalOpen(false)}
        onUserAdded={handleUserAdded}
      />
      <div className="container mx-auto p-4">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">Users</h1>
          <button className="btn btn-primary" onClick={() => setAddUserModalOpen(true)}>
            Add User
          </button>
        </div>

        <div className="mb-4">
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchParams({ q: e.target.value, sortBy, sortOrder })}
            className="input input-bordered w-full max-w-xs"
          />
        </div>

        <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-x-auto">
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr>
                  <th onClick={() => handleSort('name')} className="cursor-pointer">
                    Name {sortBy === 'name' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </th>
                  <th onClick={() => handleSort('company_name')} className="cursor-pointer">
                    Company {sortBy === 'company_name' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </th>
                  <th onClick={() => handleSort('email')} className="cursor-pointer">
                    Email {sortBy === 'email' && (sortOrder === 'asc' ? '▲' : '▼')}
                  </th>
                  <th>Phone</th>
                  <th>Role</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedUsers
                  .slice((currentPage - 1) * usersPerPage, currentPage * usersPerPage)
                  .map((user) => (
                    <React.Fragment key={user.id}>
                      <tr onClick={() => handleRowClick(user.id)} className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700">
                        <td>{user.name}</td>
                        <td>{user.company_name}</td>
                        <td>{user.email}</td>
                        <td>{user.phone}</td>
                        <td><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.role === 'admin' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>{user.role}</span></td>
                        <td>
                          <div className="flex gap-2">
                            <Link to={`/admin/users/${user.id}`} className="btn btn-secondary !px-3 !py-1 !text-xs" onClick={(e) => e.stopPropagation()}>View</Link>
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteUser(user); }} className="btn !px-3 !py-1 !text-xs text-white bg-red-600 hover:bg-red-700">Delete</button>
                          </div>
                        </td>
                      </tr>
                      {expandeduserId === user.id && (
                        <tr className="bg-gray-50 dark:bg-black/20">
                          <td colSpan={6} className="p-0">
                            {editinguserId === user.id ? (
                              <UserDetailEditor user={user} onUserUpdated={handleUserUpdated} onCancel={() => setEditingUserId(null)} />
                            ) : (
                              <div className="p-4 flex justify-between items-center">
                                <h4 className="text-md font-semibold">User Details</h4>
                                <button className="btn btn-secondary" onClick={() => setEditingUserId(user.id)}>Edit User</button>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        {totalPages > 1 && (
          <div className="flex justify-center mt-4">
            <div className="btn-group">
              <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="btn">«</button>
              <button className="btn">Page {currentPage}</button>
              <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="btn">»</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default UserListPage;
