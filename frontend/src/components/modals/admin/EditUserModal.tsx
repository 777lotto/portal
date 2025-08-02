// frontend/src/components/modals/admin/EditUserModal.tsx
import { useState, useEffect } from 'react';
import { api } from '../../../lib/api';
import { HTTPException } from 'hono/http-exception';
import type { User } from '@portal/shared';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onUserUpdated: (updatedUser: User) => void;
  user: User;
}

function EditUserModal({ isOpen, onClose, onUserUpdated, user }: Props) {
  const [formData, setFormData] = useState({
    name: '', company_name: '', email: '',
    phone: '', address: '', role: 'customer'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '', company_name: user.company_name || '',
        email: user.email || '', phone: user.phone || '',
        address: user.address || '', role: user.role || 'customer'
      });
    }
  }, [user, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const payload: Partial<User> = Object.fromEntries(
        Object.entries(formData).filter(([, value]) => value !== '')
    );
    payload.role = formData.role as User['role'];

    setIsSubmitting(true);
    try {
      const updatedUser = await api.admin.users[':user_id'].$put({
        param: { user_id: user.id.toString() },
        json: payload
      });
      onUserUpdated(updatedUser);
      onClose();
    } catch (err: any) {
      if (err instanceof HTTPException) {
        const errorJson = await err.response.json().catch(() => ({}));
        setError(errorJson.error || 'Failed to update user');
      } else {
        setError(err.message || 'An unknown error occurred.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    // ... JSX is unchanged ...
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-tertiary-dark rounded-lg shadow-xl w-full max-w-lg">
        <form onSubmit={handleSubmit}>
          <div className="p-4 border-b border-border-light dark:border-border-dark flex justify-between items-center">
            <h5 className="text-xl font-bold">Edit User: {user.name || user.company_name}</h5>
            <button type="button" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl font-bold" onClick={onClose}>&times;</button>
          </div>
          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            {error && <div className="alert alert-danger">{error}</div>}
            <div>
              <label htmlFor="name" className="form-label">Full Name</label>
              <input type="text" id="name" name="name" className="form-control" value={formData.name} onChange={handleChange} />
            </div>
            <div>
              <label htmlFor="company_name" className="form-label">Company/Community Name</label>
              <input type="text" id="company_name" name="company_name" value={formData.company_name} className="form-control" onChange={handleChange} />
            </div>
            <div>
              <label htmlFor="email" className="form-label">Email Address</label>
              <input type="email" id="email" name="email" className="form-control" value={formData.email} onChange={handleChange} />
            </div>
            <div>
              <label htmlFor="phone" className="form-label">Phone Number</label>
              <input type="tel" id="phone" name="phone" className="form-control" value={formData.phone} onChange={handleChange} />
            </div>
            <div>
              <label htmlFor="address" className="form-label">Service Address</label>
              <input type="text" id="address" name="address" className="form-control" value={formData.address} onChange={handleChange} />
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
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditUserModal;
