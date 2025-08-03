import { useState, useEffect } from 'react';
import { api } from '../../../lib/api';
import { HTTPException } from 'hono/http-exception';
import type { User } from '@portal/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onUserAdded: (newUser: User) => void;
}

const getErrorMessage = async (error: unknown): Promise<string> => {
  if (error instanceof HTTPException) {
    try {
      const data = await error.response.json();
      return data.message || data.error || 'An unexpected error occurred.';
    } catch (e) {
      return 'An unexpected error occurred parsing the error response.';
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unknown error occurred.';
};

function AddUserModal({ isOpen, onClose, onUserAdded }: Props) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: '',
    company_name: '',
    email: '',
    phone: '',
    role: 'customer'
  });
  const [error, setError] = useState<string | null>(null);

  const { mutate: createUser, isPending: isSubmitting } = useMutation({
    mutationFn: (userData: typeof formData) => {
      return api.admin.users.$post({ json: userData });
    },
    onSuccess: async (res) => {
      if (!res.ok) {
        throw new HTTPException(res.status, { res });
      }
      const newUser = await res.json();
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      onUserAdded(newUser);
      onClose();
    },
    onError: async (err) => {
      const message = await getErrorMessage(err);
      setError(message);
    }
  });

  useEffect(() => {
    if (isOpen) {
      // Reset form on open
      setFormData({
        name: '',
        company_name: '',
        email: '',
        phone: '',
        role: 'customer'
      });
      setError(null);
    }
  }, [isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
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
    createUser(formData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-base-100 rounded-lg w-full max-w-lg">
        <form onSubmit={handleSubmit}>
          <div className="p-6 border-b border-base-300 flex justify-between items-center">
            <h5 className="text-xl font-bold">Add New User</h5>
            <button type="button" className="btn btn-sm btn-circle btn-ghost" onClick={onClose}>✕</button>
          </div>
          <div className="p-6 space-y-4">
            {error && <div className="alert alert-error shadow-lg"><div><span>{error}</span></div></div>}
            <div className="form-control">
              <label className="label"><span className="label-text">Full Name</span></label>
              <input type="text" name="name" className="input input-bordered" onChange={handleChange} value={formData.name} />
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">Company/Community Name</span></label>
              <input type="text" name="company_name" className="input input-bordered" onChange={handleChange} value={formData.company_name} />
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">Email Address</span></label>
              <input type="email" name="email" className="input input-bordered" onChange={handleChange} value={formData.email} />
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">Phone Number</span></label>
              <input type="tel" name="phone" className="input input-bordered" onChange={handleChange} value={formData.phone} />
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">Role</span></label>
              <select name="role" className="select select-bordered" value={formData.role} onChange={handleChange}>
                <option value="customer">Customer</option>
                <option value="admin">Admin</option>
                <option value="associate">Associate</option>
                <option value="guest">Guest</option>
              </select>
            </div>
          </div>
          <div className="p-4 border-t border-base-300 flex justify-end gap-2 bg-base-200/50 rounded-b-lg">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting && <span className="loading loading-spinner"></span>}
              Create User
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddUserModal;
