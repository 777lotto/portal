import { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { apiGet, deleteUser, adminImportInvoices } from '../../lib/api.js';
import type { User } from '@portal/shared';
import AddUserModal from './AddUserModal.js';

function AdminDashboard() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);

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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdownId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleDeleteUser = async (userToDelete: User) => {
    if (window.confirm(`Are you sure you want to permanently delete ${userToDelete.name || userToDelete.email} and all their data? This action cannot be undone.`)) {
      try {
        await deleteUser(userToDelete.id.toString());
        setUsers(currentUsers => currentUsers.filter(user => user.id !== userToDelete.id));
        setOpenDropdownId(null);
      } catch (err: any) {
        setError(`Failed to delete user: ${err.message}`);
      }
    }
  };

  const handleUserAdded = (newUser: User) => {
    // Add the new user to the top of the list for immediate UI feedback
    setUsers(currentUsers => [newUser, ...currentUsers]);
  };

  const handleImportClick = async () => {
      if (!window.confirm("This will import paid Stripe invoices as jobs for existing customers. This may take a moment. Continue?")) {
          return;
      }
      setIsImporting(true);
      setImportMessage(null);
      setError(null);
      try {
          const result = await adminImportInvoices();
          let messageText = `Import complete! ${result.imported} jobs created, ${result.skipped} skipped.`;
          if (result.errors && result.errors.length > 0) {
              messageText += ` Errors: ${result.errors.join(', ')}`;
          }
          setImportMessage(messageText);
      } catch (err: any) {
          setError(`Import failed: ${err.message}`);
      } finally {
          setIsImporting(false);
      }
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


  if (isLoading) return <div className="text-center p-8">Loading users...</div>;

  return (
    <>
      <AddUserModal
        isOpen={isAddUserModalOpen}
        onClose={() => setIsAddUserModalOpen(false)}
        onUserAdded={handleUserAdded}
      />
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Users</h1>
        {error && <div className="alert alert-danger">{error}</div>}
        {importMessage && <div className="alert alert-info">{importMessage}</div>}

        <div className="mb-4 flex justify-between items-center">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, company, email, or phone..."
            className="form-control"
            style={{width: '50%'}}
          />
          <div className="flex items-center gap-2">
            <button
                onClick={handleImportClick}
                className="btn btn-secondary"
                disabled={isImporting}
            >
                {isImporting ? 'Importing...' : 'Import Stripe Invoices'}
            </button>
            <button
                onClick={() => setIsAddUserModalOpen(true)}
                className="btn btn-primary"
            >
                Add User
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-tertiary-dark shadow-md rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border-light dark:divide-border-dark">
              <thead className="bg-secondary-light dark:bg-secondary-dark">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wider">Name</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wider">Company</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wider">Contact</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wider">Role</th>
                  <th scope="col" className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light dark:divide-border-dark">
                {filteredUsers.length > 0 ? (
                  filteredUsers.map(user => (
                    <tr key={user.id} className="hover:bg-secondary-light/50 dark:hover:bg-secondary-dark/50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">{user.name || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary-light dark:text-text-secondary-dark">{user.company_name || 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-text-primary-light dark:text-text-primary-dark">{user.email}</div>
                          <div className="text-sm text-text-secondary-light dark:text-text-secondary-dark">{user.phone}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          user.role === 'admin' ? 'bg-green-100 text-green-800' :
                          user.role === 'guest' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="relative inline-block text-left" ref={openDropdownId === user.id ? dropdownRef : null}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenDropdownId(openDropdownId === user.id ? null : user.id);
                            }}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-full text-text-secondary-light dark:text-text-secondary-dark hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none"
                          >
                           ...
                          </button>
                          {openDropdownId === user.id && (
                            <div className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white dark:bg-primary-dark ring-1 ring-black ring-opacity-5 z-10">
                              <div className="py-1" role="menu" aria-orientation="vertical">
                                <Link to={`/admin/users/${user.id}`} className="block px-4 py-2 text-sm text-text-primary-light dark:text-text-primary-dark hover:bg-secondary-light dark:hover:bg-secondary-dark" role="menuitem">Manage User</Link>
                                <button
                                  onClick={() => handleDeleteUser(user)}
                                  className="block w-full text-left px-4 py-2 text-sm text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                                  role="menuitem"
                                >
                                  Delete User
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={5} className="text-center py-4">No users found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

export default AdminDashboard;
