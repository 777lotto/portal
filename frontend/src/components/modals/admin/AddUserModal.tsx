import { useState } from 'react';
// Import the new 'api' client.
import { api } from '../../../lib/api';
import { ApiError } from '../../../lib/fetchJson';
import type { User } from '@portal/shared';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onUserAdded: (newUser: User) => void;
}

function AddUserModal({ isOpen, onClose, onUserAdded }: Props) {
  const [formData, setFormData] = useState({
    name: '',
    company_name: '',
    email: '',
    phone: '',
    role: 'customer'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name && !formData.company_name) {
      setError("Either a name or a company name must be provided.");
      return;
    }
    if (!formData.email && !formData.phone) {
      setError("Either an email or phone number must be provided.");
      return;
    }

    setIsSubmitting(true);
    try {
      // --- UPDATED ---
      const res = await api.admin.users.$post({ json: formData });
      if (!res.ok) {
        const errorData = await res.json();
        throw new ApiError(errorData.error || 'Failed to create user', res.status);
      }
      const newUser = await res.json();
      // --- END UPDATE ---

      onUserAdded(newUser);
      onClose();
    } catch (err: any) {
      setError(err.message || 'An unknown error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  // No changes needed for the JSX below
 return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-tertiary-dark rounded-lg w-full max-w-lg">
        <form onSubmit={handleSubmit}>
          <div className="p-6 border-b border-border-light dark:border-border-dark flex justify-between items-center">
            <h5 className="text-xl font-bold">Add New User</h5>
            <button type="button" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl font-bold" onClick={onClose}>&times;</button>
          </div>
          <div className="p-6 space-y-4">
            {error && <div className="alert alert-danger">{error}</div>}
            <div>
              <label htmlFor="name" className="form-label">Full Name</label>
              <input type="text" id="name" name="name" className="form-control" onChange={handleChange} />
            </div>
            <div>
              <label htmlFor="company_name" className="form-label">Company/Community Name</label>
              <input type="text" id="company_name" name="company_name" className="form-control" onChange={handleChange} />
            </div>
            <div>
              <label htmlFor="email" className="form-label">Email Address</label>
              <input type="email" id="email" name="email" className="form-control" onChange={handleChange} />
            </div>
            <div>
              <label htmlFor="phone" className="form-label">Phone Number</label>
              <input type="tel" id="phone" name="phone" className="form-control" onChange={handleChange} />
            </div>
            <div>
              <label htmlFor="role" className="form-label">Role</label>
              <select id="role" name="role" className="form-control" value={formData.role} onChange={handleChange}>
                <option value="customer">Customer</option>
                <option value="admin">Admin</option>
                <option value="associate">Associate</option>
                <option value="guest">Guest</option>
              </select>
            </div>
          </div>
          <div className="p-4 border-t border-border-light dark:border-border-dark flex justify-end gap-2 bg-gray-50 dark:bg-secondary-dark/50 rounded-b-lg">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddUserModal;
