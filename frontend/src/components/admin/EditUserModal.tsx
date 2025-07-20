// Create new file: 777lotto/portal/portal-bet/frontend/src/components/admin/EditUserModal.tsx
import { useState, useEffect } from 'react';
import { adminUpdateUser } from '../../lib/api';
import type { User } from '@portal/shared';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onUserUpdated: (updatedUser: User) => void;
  user: User;
}

function EditUserModal({ isOpen, onClose, onUserUpdated, user }: Props) {
  const [formData, setFormData] = useState({
    name: '',
    company_name: '',
    email: '',
    phone: '',
    address: '',
    role: 'customer'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // When the user prop is available, populate the form
    if (user) {
      setFormData({
        name: user.name || '',
        company_name: user.company_name || '',
        email: user.email || '',
        phone: user.phone || '',
        address: user.address || '',
        role: user.role || 'customer'
      });
    }
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const payload: Partial<User> = {};
    if (formData.name) payload.name = formData.name;
    if (formData.company_name) payload.company_name = formData.company_name;
    if (formData.email) payload.email = formData.email;
    if (formData.phone) payload.phone = formData.phone;
    if (formData.address) payload.address = formData.address;
    if (formData.role) payload.role = formData.role;

    setIsSubmitting(true);
    try {
      const updatedUser = await adminUpdateUser(user.id.toString(), payload);
      onUserUpdated(updatedUser);
      onClose();
    } catch (err: any) {
      setError(err.message || 'An unknown error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex={-1}>
      <div className="modal-dialog">
        <div className="modal-content">
          <form onSubmit={handleSubmit}>
            <div className="modal-header">
              <h5 className="modal-title">Edit User: {user.name || user.company_name}</h5>
              <button type="button" className="btn-close" onClick={onClose}></button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-danger">{error}</div>}
              <div className="mb-3">
                <label htmlFor="name" className="form-label">Full Name</label>
                <input type="text" id="name" name="name" className="form-control" value={formData.name} onChange={handleChange} />
              </div>
              <div className="mb-3">
                <label htmlFor="company_name" className="form-label">Company/Community Name</label>
                <input type="text" id="company_name" name="company_name" value={formData.company_name} className="form-control" onChange={handleChange} />
              </div>
              <div className="mb-3">
                <label htmlFor="email" className="form-label">Email Address</label>
                <input type="email" id="email" name="email" className="form-control" value={formData.email} onChange={handleChange} />
              </div>
              <div className="mb-3">
                <label htmlFor="phone" className="form-label">Phone Number</label>
                <input type="tel" id="phone" name="phone" className="form-control" value={formData.phone} onChange={handleChange} />
              </div>
              <div className="mb-3">
                <label htmlFor="address" className="form-label">Service Address</label>
                <input type="text" id="address" name="address" className="form-control" value={formData.address} onChange={handleChange} />
              </div>
              <div className="mb-3">
                <label htmlFor="role" className="form-label">Role</label>
                <select id="role" name="role" className="form-select" value={formData.role} onChange={handleChange}>
                  <option value="customer">Customer</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default EditUserModal;
