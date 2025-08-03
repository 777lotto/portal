import { useState, useEffect } from 'react';
import { api } from '../../../lib/api';
import { HTTPException } from 'hono/http-exception';
import type { User } from '@portal/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onUserUpdated: (updatedUser: User) => void;
  user: User;
}

// Helper to extract a user-friendly error message.
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

function EditUserModal({ isOpen, onClose, onUserUpdated, user }: Props) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: '', company_name: '', email: '',
    phone: '', address: '', role: 'customer'
  });
  const [error, setError] = useState<string | null>(null);

  // Mutation for updating a user
  const { mutate: updateUser, isPending: isSubmitting } = useMutation({
    mutationFn: (payload: Partial<User>) => {
        return api.admin.users[':user_id'].$put({
            param: { user_id: user.id.toString() },
            json: payload
        });
    },
    onSuccess: async (res) => {
        if (!res.ok) {
            throw new HTTPException(res.status, { res });
        }
        const updatedUser = await res.json();
        // Invalidate queries that are now stale
        queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
        queryClient.invalidateQueries({ queryKey: ['admin', 'user', user.id.toString()] });
        onUserUpdated(updatedUser);
        onClose();
    },
    onError: async (err) => {
        const message = await getErrorMessage(err);
        setError(message);
    },
  });

  // Effect to populate form when modal opens or user prop changes
  useEffect(() => {
    if (user && isOpen) {
      setFormData({
        name: user.name || '',
        company_name: user.company_name || '',
        email: user.email || '',
        phone: user.phone || '',
        address: user.address || '',
        role: user.role || 'customer'
      });
      setError(null);
    }
  }, [user, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const payload: Partial<User> = Object.fromEntries(
        Object.entries(formData).filter(([, value]) => value !== '')
    );
    payload.role = formData.role as User['role'];
    updateUser(payload);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-base-100 rounded-lg shadow-xl w-full max-w-lg">
        <form onSubmit={handleSubmit}>
          <div className="p-4 border-b border-base-300 flex justify-between items-center">
            <h5 className="text-xl font-bold">Edit User: {user.name || user.company_name}</h5>
            <button type="button" className="btn btn-sm btn-circle btn-ghost" onClick={onClose}>✕</button>
          </div>
          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            {error && <div className="alert alert-error shadow-lg"><div><span>{error}</span></div></div>}
            <div className="form-control">
              <label className="label"><span className="label-text">Full Name</span></label>
              <input type="text" name="name" className="input input-bordered" value={formData.name} onChange={handleChange} />
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">Company/Community Name</span></label>
              <input type="text" name="company_name" value={formData.company_name} className="input input-bordered" onChange={handleChange} />
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">Email Address</span></label>
              <input type="email" name="email" className="input input-bordered" value={formData.email} onChange={handleChange} />
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">Phone Number</span></label>
              <input type="tel" name="phone" className="input input-bordered" value={formData.phone} onChange={handleChange} />
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">Service Address</span></label>
              <textarea name="address" className="textarea textarea-bordered" value={formData.address} onChange={handleChange}></textarea>
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
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditUserModal;
