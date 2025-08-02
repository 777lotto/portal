// @ts-nocheck
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import type { User } from '@portal/shared';
import AddUserModal from '../../components/modals/admin/AddUserModal';
import { debounce } from 'lodash-es';

// Forward-declare the Google API objects to satisfy TypeScript
declare const google: any;
declare const gapi: any;

/**
 * A component to display user details in a read-only format.
 */
function UserDetailViewer({ user, onEdit }: { user: User; onEdit: () => void; }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 p-6">
      <div className="flex justify-between items-center mb-4">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white">User Details</h4>
        <button className="btn btn-secondary btn-sm" onClick={onEdit}>Edit User</button>
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
      </div>
    </div>
  );
}

/**
 * A component to edit user details.
 */
function UserDetailEditor({ user, onUserUpdated, onCancel }: { user: User; onUserUpdated: (user: User) => void; onCancel: () => void; }) {
  const [editedUser, setEditedUser] = useState(user);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setEditedUser({ ...editedUser, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await api.admin.users[':id'].$put({
        param: { id: user.id },
        json: editedUser,
      });

      if (response.ok) {
        // FIX: Access the wrapped 'user' object from the consistent API response
        const data = await response.json();
        onUserUpdated(data.user);
      }
    } catch (error) {
      console.error('Failed to update user:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-gray-50 dark:bg-gray-800/50 p-6">
      <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Edit User</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input type="text" name="name" value={editedUser.name || ''} onChange={handleChange} placeholder="Name" className="input input-bordered w-full" />
        <input type="text" name="company_name" value={editedUser.company_name || ''} onChange={handleChange} placeholder="Company Name" className="input input-bordered w-full" />
        <input type="email" name="email" value={editedUser.email || ''} onChange={handleChange} placeholder="Email" className="input input-bordered w-full" />
        <input type="tel" name="phone" value={editedUser.phone || ''} onChange={handleChange} placeholder="Phone" className="input input-bordered w-full" />
        <textarea name="address" value={editedUser.address || ''} onChange={handleChange} placeholder="Address" className="textarea textarea-bordered w-full md:col-span-2" />
      </div>
      <div className="flex justify-end space-x-2 mt-4">
        <button type="button" onClick={onCancel} className="btn">Cancel</button>
        <button type="submit" className="btn btn-primary">Save Changes</button>
      </div>
    </form>
  );
}


function UserListPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [currentPage, setCurrentPage] = useState(Number(searchParams.get('page')) || 1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [tokenClient, setTokenClient] = useState<any>(null);

  useEffect(() => {
    const initializeGapiClient = async () => {
      await new Promise((resolve) => gapi.load('client', resolve));
      await gapi.client.init({
        apiKey: import.meta.env.VITE_GOOGLE_API_KEY,
        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/people/v1/rest'],
      });
    };

    const initializeGisClient = () => {
        const client = google.accounts.oauth2.initTokenClient({
            client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
            scope: 'https://www.googleapis.com/auth/contacts.readonly',
            callback: handleGoogleContactsResponse,
        });
        setTokenClient(client);
    }

    const script = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (script) {
        script.onload = () => {
            initializeGisClient();
            initializeGapiClient();
        };
    }

  }, []);

  const handleGoogleContactsResponse = async (tokenResponse: any) => {
    if (tokenResponse && tokenResponse.access_token) {
        gapi.client.setToken({ access_token: tokenResponse.access_token });
        try {
            const response = await gapi.client.people.people.connections.list({
                resourceName: 'people/me',
                personFields: 'names,emailAddresses,phoneNumbers',
                pageSize: 200,
            });

            const connections = response.result.connections;
            if (connections && connections.length > 0) {
                const contacts = connections.map(person => ({
                    name: person.names?.[0]?.displayName || '',
                    email: person.emailAddresses?.[0]?.value || '',
                    phone: person.phoneNumbers?.[0]?.value || '',
                })).filter(c => c.name);

                await api.admin.users['import-google-contacts'].$post({ json: { contacts } });

                alert(`${contacts.length} contacts were successfully imported!`);
                fetchUsers(1, '');
            } else {
                alert('No contacts found in your Google account.');
            }
        } catch (error) {
            console.error('Error fetching/importing Google contacts:', error);
            alert('An error occurred during the Google contacts import. Please see the console for more details.');
        }
    }
  }

  const handleImportGoogleContacts = () => {
    if (tokenClient) {
      tokenClient.requestAccessToken();
    } else {
      alert('Google API client is not initialized yet. Please try again in a moment.');
    }
  };

  const fetchUsers = useCallback(async (page = 1, search = '') => {
    try {
      const response = await api.admin.users.$get({
        query: { page: page.toString(), limit: '10', search },
      });
      if (response.ok) {
        const data = await response.json();
        // FIX: Access the wrapped 'users' object and pagination details
        setUsers(data.users);
        setTotalPages(data.totalPages);
        setTotalUsers(data.totalUsers);
        setCurrentPage(data.currentPage);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  }, []);

  const debouncedFetchUsers = useMemo(() => debounce(fetchUsers, 300), [fetchUsers]);

  useEffect(() => {
    debouncedFetchUsers(currentPage, searchTerm);
  }, [searchTerm, currentPage, debouncedFetchUsers]);

  useEffect(() => {
    setSearchParams({ page: currentPage.toString(), search: searchTerm });
  }, [currentPage, searchTerm, setSearchParams]);

  const handleUserAdded = () => {
    fetchUsers(currentPage, searchTerm);
    setIsAddUserModalOpen(false);
  };

  const handleUserUpdated = (updatedUser: User) => {
    setUsers(users.map((user) => (user.id === updatedUser.id ? updatedUser : user)));
    setEditingUserId(null);
  };

  const handleDeleteUser = async (userToDelete: User) => {
    if (window.confirm(`Are you sure you want to delete ${userToDelete.name}? This action cannot be undone.`)) {
      try {
        const response = await api.admin.users[':id'].$delete({
          param: { id: userToDelete.id },
        });
        if(response.ok) {
          fetchUsers(currentPage, searchTerm);
        }
      } catch (error) {
        console.error('Failed to delete user:', error);
      }
    }
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
    setCurrentPage(1);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const toggleExpandUser = (userId: string) => {
    if (expandedUserId === userId) {
      setExpandedUserId(null);
      setEditingUserId(null);
    } else {
      setExpandedUserId(userId);
    }
  };

  return (
    <>
      <div className="container mx-auto p-4 md:p-6 lg:p-8">
        <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">User Management</h1>
          <div className="flex items-center space-x-2">
            <button onClick={() => setIsAddUserModalOpen(true)} className="btn btn-primary">
              Add User
            </button>
            <button onClick={handleImportGoogleContacts} className="btn btn-secondary">
              Import Google Contacts
            </button>
          </div>
        </div>

        <div className="flex justify-between items-center mb-4">
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="input input-bordered w-full max-w-xs"
          />
          <span className="text-sm text-gray-500 dark:text-gray-400">Total Users: {totalUsers}</span>
        </div>

        <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-x-auto">
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Company</th>
                  <th></th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <React.Fragment key={user.id}>
                    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td>{user.name}</td>
                      <td>{user.email}</td>
                      <td>{user.phone}</td>
                      <td>{user.company_name}</td>
                      <td>
                        <Link to={`/admin/users/${user.id}`} className="btn btn-ghost btn-sm">View Details</Link>
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button onClick={() => toggleExpandUser(user.id)} className="btn btn-ghost btn-sm">
                            {expandedUserId === user.id ? 'Collapse' : 'Edit'}
                          </button>
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
                              // This now just toggles the editor, details are on a separate page
                              <UserDetailEditor user={user} onUserUpdated={handleUserUpdated} onCancel={() => setEditingUserId(null)} />
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
      <AddUserModal
        isOpen={isAddUserModalOpen}
        onClose={() => setIsAddUserModalOpen(false)}
        onUserAdded={handleUserAdded}
      />
    </>
  );
}

export default UserListPage;
