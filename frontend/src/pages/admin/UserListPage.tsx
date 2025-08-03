import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { User } from '@portal/shared';
import AddUserModal from '../../components/modals/admin/AddUserModal';
import { debounce } from 'lodash-es';
import { HTTPException } from 'hono/http-exception';

declare const google: any;
declare const gapi: any;

/**
 * REFACTORED: A component to edit user details, now using useMutation for state management.
 */
function UserDetailEditor({ user, onUserUpdated, onCancel }: { user: User; onUserUpdated: (user: User) => void; onCancel: () => void; }) {
  const [editedUser, setEditedUser] = useState(user);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (updatedUser: User) => {
      return api.admin.users[':user_id'].$put({
        param: { user_id: updatedUser.id.toString() },
        json: updatedUser,
      });
    },
    onSuccess: async (response) => {
      const data = await response.json();
      // Invalidate the users query to refetch the fresh list
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      onUserUpdated(data.user);
    },
    onError: (err) => {
      // Error is now handled by the mutation's error state
      console.error('Failed to update user:', err);
    }
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setEditedUser({ ...editedUser, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(editedUser);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-gray-50 dark:bg-gray-800/50 p-6">
      <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Edit User</h4>
      {mutation.isError && (
        <div className="alert alert-danger mb-4">
          {mutation.error instanceof HTTPException
            ? (mutation.error as any).message || 'Failed to update user.'
            : 'An unexpected error occurred.'}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input type="text" name="name" value={editedUser.name || ''} onChange={handleChange} placeholder="Name" className="input input-bordered w-full" />
        <input type="text" name="company_name" value={editedUser.company_name || ''} onChange={handleChange} placeholder="Company Name" className="input input-bordered w-full" />
        <input type="email" name="email" value={editedUser.email || ''} onChange={handleChange} placeholder="Email" className="input input-bordered w-full" />
        <input type="tel" name="phone" value={editedUser.phone || ''} onChange={handleChange} placeholder="Phone" className="input input-bordered w-full" />
        <textarea name="address" value={editedUser.address || ''} onChange={handleChange} placeholder="Address" className="textarea textarea-bordered w-full md:col-span-2" />
      </div>
      <div className="flex justify-end space-x-2 mt-4">
        <button type="button" onClick={onCancel} className="btn" disabled={mutation.isPending}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}

/**
 * REFACTORED: User list page now uses useInfiniteQuery for data fetching and pagination.
 */
function UserListPage() {
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [expandedUserId, setExpandedUserId] = useState<number | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [tokenClient, setTokenClient] = useState<any>(null);
  const queryClient = useQueryClient();

  // --- Google Contacts logic remains unchanged ---
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
    if (script) { script.onload = () => { initializeGisClient(); initializeGapiClient(); }; }
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
                const contacts = connections.map((person: any) => ({
                    name: person.names?.[0]?.displayName || '',
                    email: person.emailAddresses?.[0]?.value || '',
                    phone: person.phoneNumbers?.[0]?.value || '',
                })).filter((c: any) => c.name);
                await api.admin.users['import-google-contacts'].$post({ json: { contacts } });
                alert(`${contacts.length} contacts were successfully imported!`);
                queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
            } else {
                alert('No contacts found in your Google account.');
            }
        } catch (error) {
            console.error('Error fetching/importing Google contacts:', error);
            alert('An error occurred during the Google contacts import.');
        }
    }
  }

  const handleImportGoogleContacts = () => {
    if (tokenClient) tokenClient.requestAccessToken();
    else alert('Google API client is not initialized yet.');
  };
  // --- End of Google Contacts logic ---

  const fetchUsers = async ({ pageParam = 1 }) => {
    const res = await api.admin.users.$get({
      query: { page: pageParam.toString(), limit: '10', search: searchTerm },
    });
    if (!res.ok) throw new Error('Failed to fetch users');
    return res.json();
  };

  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    status,
  } = useInfiniteQuery({
    queryKey: ['adminUsers', searchTerm],
    queryFn: fetchUsers,
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      return lastPage.currentPage < lastPage.totalPages ? lastPage.currentPage + 1 : undefined;
    },
  });

  const debouncedSetSearchTerm = useMemo(() => debounce(setSearchTerm, 300), []);

  useEffect(() => {
    setSearchParams({ search: searchTerm });
  }, [searchTerm, setSearchParams]);

  const handleUserAdded = () => {
    queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
    setIsAddUserModalOpen(false);
  };

  const handleUserUpdated = (updatedUser: User) => {
    setEditingUserId(null);
    setExpandedUserId(null);
  };

  const deleteUserMutation = useMutation({
    mutationFn: (userId: number) => {
      return api.admin.users[':user_id'].$delete({ param: { user_id: userId.toString() } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
    },
    onError: (err) => {
      console.error('Failed to delete user:', err);
      alert('Failed to delete user.');
    }
  });

  const handleDeleteUser = (userToDelete: User) => {
    if (window.confirm(`Are you sure you want to delete ${userToDelete.name}?`)) {
      deleteUserMutation.mutate(userToDelete.id);
    }
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    debouncedSetSearchTerm(event.target.value);
  };

  const toggleExpandUser = (userId: number) => {
    setExpandedUserId(expandedUserId === userId ? null : userId);
    setEditingUserId(editingUserId === userId ? null : userId);
  };

  const users = data?.pages.flatMap(page => page.users) ?? [];

  return (
    <>
      <div className="container mx-auto p-4 md:p-6 lg:p-8">
        <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">User Management</h1>
          <div className="flex items-center space-x-2">
            <button onClick={() => setIsAddUserModalOpen(true)} className="btn btn-primary">Add User</button>
            <button onClick={handleImportGoogleContacts} className="btn btn-secondary">Import Google Contacts</button>
          </div>
        </div>

        <div className="flex justify-between items-center mb-4">
          <input
            type="text"
            placeholder="Search users..."
            defaultValue={searchTerm}
            onChange={handleSearchChange}
            className="input input-bordered w-full max-w-xs"
          />
           {status === 'success' && (
             <span className="text-sm text-gray-500 dark:text-gray-400">Total Users: {data.pages[0].totalUsers}</span>
           )}
        </div>

        <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-x-auto">
          {status === 'pending' ? (
            <p className="p-4">Loading...</p>
          ) : status === 'error' ? (
            <p className="p-4 text-error">Error: {error.message}</p>
          ) : (
            <>
              <table className="table w-full">
                <thead>
                  <tr>
                    <th>Name</th><th>Email</th><th>Phone</th><th>Company</th><th></th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <React.Fragment key={user.id}>
                      <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td>{user.name}</td><td>{user.email}</td><td>{user.phone}</td><td>{user.company_name}</td>
                        <td><Link to={`/admin/users/${user.id}`} className="btn btn-ghost btn-sm">View Details</Link></td>
                        <td className="text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <button onClick={() => toggleExpandUser(user.id)} className="btn btn-ghost btn-sm">{expandedUserId === user.id ? 'Collapse' : 'Edit'}</button>
                            <button onClick={() => handleDeleteUser(user)} className="btn btn-error btn-sm" disabled={deleteUserMutation.isPending}>Delete</button>
                          </div>
                        </td>
                      </tr>
                      {expandedUserId === user.id && (
                        <tr className="bg-gray-50 dark:bg-gray-800/20">
                          <td colSpan={6} className="p-0">
                             <UserDetailEditor user={user} onUserUpdated={handleUserUpdated} onCancel={() => setExpandedUserId(null)} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
              <div className="p-4 flex justify-center">
                <button
                  onClick={() => fetchNextPage()}
                  disabled={!hasNextPage || isFetchingNextPage}
                  className="btn"
                >
                  {isFetchingNextPage ? 'Loading more...' : hasNextPage ? 'Load More' : 'Nothing more to load'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      <AddUserModal isOpen={isAddUserModalOpen} onClose={() => setIsAddUserModalOpen(false)} onUserAdded={handleUserAdded} />
    </>
  );
}

export default UserListPage;
