import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { HTTPError } from 'hono/client';
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
      const updatedUser = await api.admin.users[':user_id'].$put({
        param: { user_id: user.id.toString() },
        json: formData
      });
      onUserUpdated(updatedUser);
    } catch (err: any) {
        if (err instanceof HTTPError) {
            const errorJson = await err.response.json();
            setError(errorJson.error || 'Failed to update user.');
        } else {
            setError(err.message || 'An unknown error occurred.');
        }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    // ... UserDetailEditor JSX is unchanged ...
    <form onSubmit={handleSubmit} className="p-4 space-y-4 bg-secondary-light dark:bg-secondary-dark rounded-b-lg">
      {error && <div className="alert alert-danger">{error}</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
        <div className="space-y-4">
          <div>
            <label htmlFor={`name-${user.id}`} className="form-label text-xs">Full Name</label>
            <input type="text" id={`name-${user.id}`} name="name" className="form-control" value={formData.name} onChange={handleChange} />
          </div>
          <div>
            <label htmlFor={`company_name-${user.id}`} className="form-label text-xs">Company Name</label>
            <input type="text" id={`company_name-${user.id}`} name="company_name" value={formData.company_name} className="form-control" onChange={handleChange} />
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <label htmlFor={`email-${user.id}`} className="form-label text-xs">Email Address</label>
            <input type="email" id={`email-${user.id}`} name="email" className="form-control" value={formData.email} onChange={handleChange} />
          </div>
          <div>
            <label htmlFor={`phone-${user.id}`} className="form-label text-xs">Phone Number</label>
            <input type="tel" id={`phone-${user.id}`} name="phone" className="form-control" value={formData.phone} onChange={handleChange} />
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}

function UserListPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandeduserId, setExpandedUserId] = useState<number | null>(null);
  const [editinguserId, setEditingUserId] = useState<number | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [contactsToImport, setContactsToImport] = useState<any[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());

  const handleApiError = async (err: any, defaultMessage: string) => {
    if (err instanceof HTTPError) {
        const errorJson = await err.response.json();
        setError(errorJson.error || defaultMessage);
    } else {
        setError(err.message || defaultMessage);
    }
  };

  const fetchUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await api.admin.users.$get();
      setUsers(data);
    } catch (err) {
      handleApiError(err, 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    const importToken = searchParams.get('import_token');
    const processImportToken = async (token: string) => {
        try {
            const contacts = await api.admin['get-imported-contacts'].$post({ json: { token } });
            setContactsToImport(contacts || []);
        } catch (err) {
            handleApiError(err, 'Could not retrieve contacts for import.');
        } finally {
            searchParams.delete('import_token');
            setSearchParams(searchParams, { replace: true });
        }
    };
    if (importToken) processImportToken(importToken);
  }, [searchParams, setSearchParams]);

  const handleImportSelectedContacts = async () => {
    setIsImporting(true);
    setImportMessage(null);
    setError(null);
    const contactsToPost = contactsToImport.filter(c => selectedContacts.has(c.resourceName));
    try {
      const result = await api.admin['import-contacts'].$post({ json: { contacts: contactsToPost } });
      setImportMessage(`Successfully imported ${result.importedCount} new contacts.`);
      setContactsToImport([]);
      setSelectedContacts(new Set());
      fetchUsers();
    } catch (err) {
      handleApiError(err, 'Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  const handleDeleteUser = async (userToDelete: User) => {
    if (window.confirm(`Are you sure you want to permanently delete ${userToDelete.name || userToDelete.email}?`)) {
      try {
        await api.admin.users[':user_id'].$delete({ param: { user_id: userToDelete.id.toString() } });
        setUsers(currentUsers => currentUsers.filter(user => user.id !== userToDelete.id));
      } catch (err) {
        handleApiError(err, `Failed to delete user`);
      }
    }
  };

  const handleUserUpdated = (updatedUser: User) => {
    setUsers(currentUsers => currentUsers.map(u => u.id === updatedUser.id ? updatedUser : u));
    setEditingUserId(null);
  };

  const toggleRow = (userId: number) => {
    if (editinguserId === userId) return;
    setExpandedUserId(expandeduserId === userId ? null : userId);
  };

  const filteredUsers = useMemo(() => {
    const lowercasedQuery = searchQuery.toLowerCase();
    if (!lowercasedQuery) return users;
    return users.filter(user =>
      user.name?.toLowerCase().includes(lowercasedQuery) ||
      user.company_name?.toLowerCase().includes(lowercasedQuery) ||
      user.email?.toLowerCase().includes(lowercasedQuery) ||
      user.phone?.toLowerCase().includes(lowercasedQuery)
    );
  }, [users, searchQuery]);

  const handleUserAdded = (newUser: User) => setUsers(currentUsers => [newUser, ...currentUsers]);
  const handleGoogleImportClick = () => { window.location.href = '/api/auth/google'; };

  if (isLoading) return <div className="text-center p-8">Loading users...</div>;

  return (
    <>
      <AddUserModal isOpen={isAddUserModalOpen} onClose={() => setIsAddUserModalOpen(false)} onUserAdded={handleUserAdded} />
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Users</h1>
        {error && <div className="alert alert-danger">{error}</div>}
        {importMessage && <div className="alert alert-info">{importMessage}</div>}

        <div className="mb-4 flex justify-between items-center">
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search..." className="form-control" style={{width: '40%'}} />
          <div className="flex items-center gap-2">
            <button onClick={handleGoogleImportClick} className="btn btn-secondary">Import from Google</button>
            <button onClick={() => setIsAddUserModalOpen(true)} className="btn btn-primary">Add User</button>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border-light dark:divide-border-dark">
              {/* ... table structure is unchanged ... */}
              <thead className="bg-secondary-light dark:bg-secondary-dark">
                <tr>
                    <th className="px-6 py-4 w-12"></th>
                    <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider">Name</th>
                    <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider">Company</th>
                    <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider">Contact</th>
                    <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider">Role</th>
                    <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light dark:divide-border-dark">
                {filteredUsers.map(user => (
                    <React.Fragment key={user.id}>
                      <tr className="hover:bg-secondary-light/50 dark:hover:bg-secondary-dark/50 cursor-pointer" onClick={() => toggleRow(user.id)}>
                        <td className="px-6 py-4"><span className="text-xl">{expandeduserId === user.id ? '−' : '+'}</span></td>
                        <td className="px-6 py-4">{user.name || 'N/A'}</td>
                        <td className="px-6 py-4">{user.company_name || 'N/A'}</td>
                        <td className="px-6 py-4">
                          <div>{user.email}</div>
                          <div>{user.phone}</div>
                        </td>
                        <td className="px-6 py-4"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.role === 'admin' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{user.role}</span></td>
                        <td className="px-6 py-4">
                           <div className="flex items-center gap-2">
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
      </div>
    </>
  );
}

export default UserListPage;
