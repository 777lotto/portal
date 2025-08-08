import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { apiGet, deleteUser, getImportedContacts, adminUpdateUser, apiPost } from '../../lib/api';
import type { User } from '@portal/shared';
import AddUserModal from '../modals/AddUserModal';

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
      const updatedUser = await adminUpdateUser(user.id.toString(), formData);
      onUserUpdated(updatedUser);
    } catch (err: any) {
      setError(err.message || 'An unknown error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 space-y-4 bg-secondary-light dark:bg-secondary-dark rounded-b-lg">
      {error && <div className="alert alert-danger">{error}</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
        {/* Left Column */}
        <div className="space-y-4">
          <div>
            <label htmlFor={`name-${user.id}`} className="form-label text-xs">Full Name</label>
            <input type="text" id={`name-${user.id}`} name="name" className="form-control" value={formData.name} onChange={handleChange} />
          </div>
          <div>
            <label htmlFor={`company_name-${user.id}`} className="form-label text-xs">Company/Community Name</label>
            <input type="text" id={`company_name-${user.id}`} name="company_name" value={formData.company_name} className="form-control" onChange={handleChange} />
          </div>
          <div>
            <label htmlFor={`email-${user.id}`} className="form-label text-xs">Email Address</label>
            <input type="email" id={`email-${user.id}`} name="email" className="form-control" value={formData.email} onChange={handleChange} />
          </div>
          <div>
            <label htmlFor={`phone-${user.id}`} className="form-label text-xs">Phone Number</label>
            <input type="tel" id={`phone-${user.id}`} name="phone" className="form-control" value={formData.phone} onChange={handleChange} />
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          <div>
            <label htmlFor={`address-${user.id}`} className="form-label text-xs">Service Address</label>
            <input type="text" id={`address-${user.id}`} name="address" className="form-control" value={formData.address} onChange={handleChange} />
          </div>
          <div>
            <label htmlFor={`role-${user.id}`} className="form-label text-xs">Role</label>
            <select id={`role-${user.id}`} name="role" className="form-control" value={formData.role} onChange={handleChange}>
              <option value="customer">Customer</option>
              <option value="admin">Admin</option>
              <option value="associate">Associate</option>
              <option value="guest">Guest</option>
            </select>
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

function AdminUserList() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedUserId, setExpandedUserId] = useState<number | null>(null);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [contactsToImport, setContactsToImport] = useState<any[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [contactSearchQuery, setContactSearchQuery] = useState('');

  const fetchUsers = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Effect for handling Google Contact import tokens from URL
  useEffect(() => {
    const importToken = searchParams.get('import_token');
    const importStatus = searchParams.get('import_status');

    const processImportToken = async (token: string) => {
        try {
            const contacts = await getImportedContacts(token);
            setContactsToImport(contacts || []);
        } catch (e: any) {
            setError(e.message || 'Could not retrieve contacts for import.');
        } finally {
            searchParams.delete('import_token');
            setSearchParams(searchParams, { replace: true });
        }
    };

    if (importToken) processImportToken(importToken);

    if (importStatus === 'error') {
      const errorMessage = searchParams.get('error_message');
      setError(`Google Contact import failed: ${errorMessage || 'An unknown error occurred.'}`);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleUserUpdated = (updatedUser: User) => {
    setUsers(currentUsers => currentUsers.map(u => u.id === updatedUser.id ? updatedUser : u));
    setEditingUserId(null); // Exit edit mode on successful update
  };

  const toggleRow = (userId: number) => {
    if (editingUserId === userId) return;
    setExpandedUserId(prev => (prev === userId ? null : userId));
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

  // Other handlers remain unchanged...
  const handleToggleContactSelection = (contactResourceName: string) => { setSelectedContacts(prev => { const newSet = new Set(prev); if (newSet.has(contactResourceName)) { newSet.delete(contactResourceName); } else { newSet.add(contactResourceName); } return newSet; }); };
  const handleImportSelectedContacts = async () => { setIsImporting(true); setImportMessage(null); setError(null); const contactsToPost = contactsToImport.filter(c => selectedContacts.has(c.resourceName)); try { const result = await apiPost('/api/admin/import-contacts', { contacts: contactsToPost }); setImportMessage(`Successfully imported ${result.importedCount} new contacts.`); setContactsToImport([]); setSelectedContacts(new Set()); fetchUsers(); } catch (err: any) { setError(`Import failed: ${err.message}`); } finally { setIsImporting(false); } };
  const handleDeleteUser = async (userToDelete: User) => { if (window.confirm(`Are you sure you want to permanently delete ${userToDelete.name || userToDelete.email}? This action cannot be undone.`)) { try { await deleteUser(userToDelete.id.toString()); setUsers(currentUsers => currentUsers.filter(user => user.id !== userToDelete.id)); } catch (err: any) { setError(`Failed to delete user: ${err.message}`); } } };
  const handleUserAdded = (newUser: User) => { setUsers(currentUsers => [newUser, ...currentUsers]); };
  const handleGoogleImportClick = () => { window.location.href = '/api/auth/google'; };
  const filteredContacts = useMemo(() => { const lowercasedQuery = contactSearchQuery.toLowerCase(); if (!lowercasedQuery) return contactsToImport; return contactsToImport.filter(contact => contact.names?.[0]?.displayName?.toLowerCase().includes(lowercasedQuery) || contact.emailAddresses?.[0]?.value?.toLowerCase().includes(lowercasedQuery) || contact.phoneNumbers?.[0]?.value?.toLowerCase().includes(lowercasedQuery)); }, [contactsToImport, contactSearchQuery]);

  if (isLoading) return <div className="text-center p-8">Loading users...</div>;

  return (
    <>
      <AddUserModal isOpen={isAddUserModalOpen} onClose={() => setIsAddUserModalOpen(false)} onUserAdded={handleUserAdded} />
      {/* ... (Google Contacts import modal remains the same) ... */}
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Users</h1>
        {error && <div className="alert alert-danger">{error}</div>}
        {importMessage && <div className="alert alert-info">{importMessage}</div>}

        <div className="mb-4 flex justify-between items-center">
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search by name, company, email, or phone..." className="form-control" style={{width: '40%'}} />
          <div className="flex items-center gap-2">
            <button onClick={handleGoogleImportClick} className="btn btn-secondary">Import from Google</button>
            <button onClick={() => setIsAddUserModalOpen(true)} className="btn btn-primary">Add User</button>
          </div>
        </div>

        <div className="bg-white dark:bg-tertiary-dark shadow-md rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border-light dark:divide-border-dark">
              <thead className="bg-secondary-light dark:bg-secondary-dark">
                <tr>
                  <th scope="col" className="w-12 px-6 py-3"></th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wider">Name</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wider">Company</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wider">Contact</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wider">Role</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light dark:divide-border-dark">
                {filteredUsers.length > 0 ? (
                  filteredUsers.map(user => (
                    <>
                      <tr key={user.id} className="hover:bg-secondary-light/50 dark:hover:bg-secondary-dark/50 cursor-pointer" onClick={() => toggleRow(user.id)}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-center">
                          <span className="text-xl">{expandedUserId === user.id ? '−' : '+'}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-text-primary-light dark:text-text-primary-dark">{user.name || 'N/A'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary-light dark:text-text-secondary-dark">{user.company_name || 'N/A'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div>{user.email}</div>
                          <div className="text-text-secondary-light dark:text-text-secondary-dark">{user.phone}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.role === 'admin' ? 'bg-green-100 text-green-800' : user.role === 'guest' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}`}>{user.role}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                           <div className="flex items-center gap-2">
                             <Link
                               to={`/admin/users/${user.id}`}
                               className="btn btn-secondary !px-3 !py-1 !text-xs"
                               onClick={(e) => e.stopPropagation()}
                             >
                               View
                             </Link>
                             <button
                               onClick={(e) => { e.stopPropagation(); handleDeleteUser(user); }}
                               className="btn !px-3 !py-1 !text-xs text-white bg-red-600 hover:bg-red-700 focus:ring-red-500"
                             >
                               Delete
                             </button>
                           </div>
                        </td>
                      </tr>
                      {expandedUserId === user.id && (
                        <tr className="bg-gray-50 dark:bg-black/20">
                          <td colSpan={6} className="p-0">
                            {editingUserId === user.id ? (
                              <UserDetailEditor user={user} onUserUpdated={handleUserUpdated} onCancel={() => setEditingUserId(null)} />
                            ) : (
                              <div className="p-4">
                                <div className="flex justify-between items-center mb-2 px-4">
                                  <h4 className="text-md font-semibold">User Details</h4>
                                  <button className="btn btn-secondary" onClick={() => setEditingUserId(user.id)}>Edit User</button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 px-4 text-sm">
                                  {/* Left Column */}
                                  <div className="space-y-2">
                                      <p><strong>Name:</strong> {user.name || 'N/A'}</p>
                                      <p><strong>Company:</strong> {user.company_name || 'N/A'}</p>
                                      <p><strong>Email:</strong> {user.email || 'N/A'}</p>
                                      <p><strong>Phone:</strong> {user.phone || 'N/A'}</p>
                                  </div>
                                  {/* Right Column */}
                                  <div className="space-y-2">
                                      <p><strong>Address:</strong> {user.address || 'N/A'}</p>
                                      <p><strong>Role:</strong> {user.role}</p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  ))
                ) : (
                  <tr><td colSpan={6} className="text-center py-4">No users found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

export default AdminUserList;
