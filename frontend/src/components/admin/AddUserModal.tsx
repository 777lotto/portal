import { useState } from 'react';
import { adminCreateUser } from '../../lib/api';
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
      const newUser = await adminCreateUser(formData);
      onUserAdded(newUser);
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
              <h5 className="modal-title">Add New User</h5>
              <button type="button" className="btn-close" onClick={onClose}></button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-danger">{error}</div>}
              <div className="mb-3">
                <label htmlFor="name" className="form-label">Full Name</label>
                <input type="text" id="name" name="name" className="form-control" onChange={handleChange} />
              </div>
              <div className="mb-3">
                <label htmlFor="company_name" className="form-label">Company/Community Name</label>
                <input type="text" id="company_name" name="company_name" className="form-control" onChange={handleChange} />
              </div>
              <div className="mb-3">
                <label htmlFor="email" className="form-label">Email Address</label>
                <input type="email" id="email" name="email" className="form-control" onChange={handleChange} />
              </div>
              <div className="mb-3">
                <label htmlFor="phone" className="form-label">Phone Number</label>
                <input type="tel" id="phone" name="phone" className="form-control" onChange={handleChange} />
              </div>
              <div className="mb-3">
                <label htmlFor="role" className="form-label">Role</label>
                <select id="role" name="role" className="form-select" value={formData.role} onChange={handleChange}>
                  <option value="customer">Customer</option>
                  <option value="admin">Admin</option>
                  <option value="associate">Associate</option>
                  <option value="guest">Guest</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Create User'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default AddUserModal;
