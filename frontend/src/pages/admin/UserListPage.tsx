import React, { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api.js';
import type { User } from '@portal/shared';
import AddUserModal from '../../components/modals/admin/AddUserModal.js';

/**
 * A component to display user details in a read-only format.
 */
function UserDetailViewer({ user, onEdit }: { user: User; onEdit: () => void; }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 p-6">
      <div className="flex justify-between items-center mb-4">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white">User Details</h4>
        <button className="btn btn-secondary" onClick={onEdit}>Edit User</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
        <div className="text-sm">
          <dt className="font-medium text-gray-500 dark:text-gray-400">Name</dt>
          <dd className="text-gray-900 dark:text-gray-200 mt-1">{user.name || 'N/A'}</dd>
        </div>
        <div className="text-sm">
          <dt className="font-medium text-gray-500 dark:text-gray-400">Company Name</dt>
          <dd className="text-gray-900 dark:text-gray-200 mt-1">{user.company_name || 'N/A'}</dd>
        </div>
        <div className="text-sm">
          <dt className="font-medium text-gray-500 dark:text-gray-400">Email</dt>
          <dd className="text-gray-900 dark:text-gray-200 mt-1">{user.email || 'N/A'}</dd>
        </div>
        <div className="text-sm">
          <dt className="font-medium text-gray-500 dark:text-gray-400">Phone</dt>
          <dd className="text-gray-900 dark:text-gray-200 mt-1">{user.phone || 'N/A'}</dd>
        </div>
        <div className="text-sm md:col-span-2">
          <dt className="font-medium text-gray-500 dark:text-gray-400">Address</dt>
          <dd className="text-gray-900 dark:text-gray-200 mt-1">{user.address || 'N/A'}</dd>
        </div>
        <div className="text-sm">
          <dt className="font-medium text-gray-500 dark:text-gray-400">Role</dt>
          <dd className="text-gray-900 dark:text-gray-200 mt-1 capitalize">{user.role || 'N/A'}</dd>
        </div>
      </div>
    </div>
  );
}


/**
 * A component that provides a form to edit user details.
 */
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
    <form onSubmit={handleSubmit} className="p-6 bg-gray-50 dark:bg-gray-800/50">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
          <input type="text" name="name" id="name" value={formData.name} onChange={handleChange} className="input input-bordered w-full mt-1" />
        </div>
        <div>
          <label htmlFor="company_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Company Name</label>
          <input type="text" name="company_name" id="company_name" value={formData.company_name} onChange={handleChange} className="input input-bordered w-full mt-1" />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
          <input type="email" name="email" id="email" value={formData.email} onChange={handleChange} className="input input-bordered w-full mt-1" />
        </div>
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Phone</label>
          <input type="tel" name="phone" id="phone" value={formData.phone} onChange={handleChange} className="input input-bordered w-full mt-1" />
        </div>
        <div className="md:col-span-2">
          <label htmlFor="address" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Address</label>
          <input type="text" name="address" id="address" value={formData.address} onChange={handleChange} className="input input-bordered w-full mt-1" />
        </div>
        <div>
          <label htmlFor="role" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Role</label>
          <select name="role" id="role" value={formData.role} onChange={handleChange} className="select select-bordered w-full mt-1">
            <option value="customer">Customer</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>
      {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      <div className="flex justify-end gap-2 mt-6">
        <button type="button" onClick={onCancel} className="btn btn-ghost">Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}


/**
 * Main page component for listing and managing users.
 */
function UserListPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [isAddUserModalOpen, setAddUserModalOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importMessage, setImportMessage] = useState('');

  const searchTerm = searchParams.get('q') || '';
  const sortBy = searchParams.get('sortBy') || 'name';
  const sortOrder = searchParams.get('sortOrder') || 'asc';

  const fetchUsers = async () => {
    try {
      const res = await api.admin.users.$get();
      if (!res.ok) throw new Error('Failed to fetch users');
      const data = await res.json();
      setUsers(data);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };


  useEffect(() => {
    fetchUsers();
  }, []);

  const handleUserAdded = (newUser: User) => {
    setUsers(currentUsers => [newUser, ...currentUsers].sort((a, b) => a.name.localeCompare(b.name)));
  };

  const handleUserUpdated = (updatedUser: User) => {
    setUsers(currentUsers => currentUsers.map(u => u.id === updatedUser.id ? updatedUser : u));
    setEditingUserId(null);
  };

  const handleDeleteUser = async (userToDelete: User) => {
    if (window.confirm(`Are you sure you want to delete ${userToDelete.name}? This action cannot be undone.`)) {
      try {
        const res = await api.admin.users[':user_id'].$delete({ param: { user_id: userToDelete.id.toString() } });
        if (!res.ok) throw new Error('Failed to delete user');
        setUsers(currentUsers => currentUsers.filter(u => u.id !== userToDelete.id));
      } catch (error) {
        console.error("Error deleting user:", error);
      }
    }
  };

  const handleSort = (column: string) => {
    const newSortOrder = sortBy === column && sortOrder === 'asc' ? 'desc' : 'asc';
    setSearchParams({ q: searchTerm, sortBy: column, sortOrder: newSortOrder });
  };

  const handleRowClick = (userId: string) => {
    if (editingUserId === userId) return;
    setExpandedUserId(currentId => (currentId === userId ? null : userId));
    setEditingUserId(null);
  };

  const handleImport = async (importFn: () => Promise<Response>, source: string) => {
    setIsImporting(true);
    setImportMessage(`Importing from ${source}...`);
    try {
      const res = await importFn();
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: `Failed to import from ${source}` }));
        throw new Error(errorData.message);
      }
      const result = await res.json();
      setImportMessage(result.message || 'Import successful!');
      await fetchUsers(); // Refetch users to show the new ones
    } catch (error) {
      console.error(`Error importing from ${source}:`, error);
      setImportMessage(error instanceof Error ? error.message : `Error importing from ${source}.`);
    } finally {
      setIsImporting(false);
      setTimeout(() => setImportMessage(''), 5000); // Clear message after 5 seconds
    }
  };

  const handleImportGoogleContacts = () => {
    handleImport(() => api.admin.users.import.google.$post(), 'Google Contacts');
  };

  const handleImportStripeUsers = () => {
    handleImport(() => api.admin.users.import.stripe.$post(), 'Stripe');
  };


  const filteredAndSortedUsers = useMemo(() => {
    if (!Array.isArray(users)) return [];
    let usersToSort = [...users];

    if (searchTerm) {
      const lowercasedTerm = searchTerm.toLowerCase();
      usersToSort = usersToSort.filter(user =>
        user.name?.toLowerCase().includes(lowercasedTerm) ||
        user.email?.toLowerCase().includes(lowercasedTerm) ||
        user.company_name?.toLowerCase().includes(lowercasedTerm)
      );
    }

    usersToSort.sort((a, b) => {
      const aValue = a[sortBy as keyof User] as string | number | undefined | null;
      const bValue = b[sortBy as keyof User] as string | number | undefined | null;

      const valA = aValue ?? '';
      const valB = bValue ?? '';

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return usersToSort;
  }, [users, searchTerm, sortBy, sortOrder]);

  const [currentPage, setCurrentPage] = useState(1);
  const usersPerPage = 10;
  const totalPages = Math.ceil(filteredAndSortedUsers.length / usersPerPage);
  const paginatedUsers = filteredAndSortedUsers.slice((currentPage - 1) * usersPerPage, currentPage * usersPerPage);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  return (
    <>
      <AddUserModal isOpen={isAddUserModalOpen} onClose={() => setAddUserModalOpen(false)} onUserAdded={handleUserAdded} />
      <div className="container mx-auto p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Users</h1>
          <div className="flex gap-2 flex-wrap">
            <button className="btn btn-secondary" onClick={handleImportGoogleContacts} disabled={isImporting}>
              {isImporting ? 'Importing...' : 'Import Google Contacts'}
            </button>
            <button className="btn btn-secondary" onClick={handleImportStripeUsers} disabled={isImporting}>
               {isImporting ? 'Importing...' : 'Import Stripe Users'}
            </button>
            <button className="btn btn-primary" onClick={() => setAddUserModalOpen(true)} disabled={isImporting}>
              Add User
            </button>
          </div>
        </div>

        {importMessage && (
            <div className="mb-4 p-4 rounded-md bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-200">
                {importMessage}
            </div>
        )}

        <div className="mb-6">
          <input
            type="text"
            placeholder="Search by name, company, or email..."
            value={searchTerm}
            onChange={(e) => {
              setCurrentPage(1);
              setSearchParams({ q: e.target.value, sortBy, sortOrder });
            }}
            className="input input-bordered w-full max-w-md"
          />
        </div>

        <div className="bg-white dark:bg-gray-900/50 shadow-lg rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  {['name', 'company_name', 'email', 'phone', 'role'].map(col => (
                    <th key={col} onClick={() => handleSort(col)} className="p-4 font-semibold text-left cursor-pointer uppercase tracking-wider">
                      {col.replace('_', ' ')} {sortBy === col && (sortOrder === 'asc' ? '▲' : '▼')}
                    </th>
                  ))}
                  <th className="p-4 font-semibold text-left uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedUsers.map((user) => (
                  <React.Fragment key={user.id}>
                    <tr onClick={() => handleRowClick(user.id)} className="border-b border-gray-200 dark:border-gray-700/50 cursor-pointer hover:bg-gray-100/50 dark:hover:bg-gray-800/50 transition-colors duration-200">
                      <td className="p-4">{user.name}</td>
                      <td className="p-4">{user.company_name}</td>
                      <td className="p-4">{user.email}</td>
                      <td className="p-4">{user.phone}</td>
                      <td className="p-4">
                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full capitalize ${user.role === 'admin' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200' : 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200'}`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2">
                          <Link to={`/admin/users/${user.id}`} className="btn btn-ghost btn-sm" onClick={(e) => e.stopPropagation()}>View</Link>
                          <button onClick={(e) => { e.stopPropagation(); handleDeleteUser(user); }} className="btn btn-error btn-sm">Delete</button>
                        </div>
                      </td>
                    </tr>
                    {expandedUserId === user.id && (
                      <tr className="bg-gray-50 dark:bg-gray-800/20">
                        <td colSpan={6} className="p-0">
                           {editingUserId === user.id ? (
                              <UserDetailEditor user={user} onUserUpdated={handleUserUpdated} onCancel={() => setEditingUserId(null)} />
                            ) : (
                              <UserDetailViewer user={user} onEdit={() => setEditingUserId(user.id)} />
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
          <div className="flex justify-center mt-6">
            <div className="btn-group">
              <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="btn">«</button>
              <button className="btn">Page {currentPage} of {totalPages}</button>
              <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="btn">»</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default UserListPage;
