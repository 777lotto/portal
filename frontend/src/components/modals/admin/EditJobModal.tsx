// frontend/src/components/modals/admin/EditJobModal.tsx
import { useState, useEffect } from 'react';
import { api } from '../../../lib/api';
import { HTTPError } from 'hono/client';
import type { Job, User } from '@portal/shared';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onJobUpdated: (updatedJob: Job) => void;
  job: Job;
}

function EditJobModal({ isOpen, onClose, onJobUpdated, job }: Props) {
  const [users, setUsers] = useState<User[]>([]);
  const [selecteduserId, setSelectedUserId] = useState<string>(job.user_id);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedUserId(job.user_id);
      const fetchUsers = async () => {
        try {
          const allUsers = await api.admin.users.$get();
          setUsers(allUsers);
        } catch (err) {
          setError('Failed to load users.');
        }
      };
      fetchUsers();
    }
  }, [isOpen, job.user_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const updatedJob = await api.admin.jobs[':jobId'].details.$put({
        param: { jobId: job.id.toString() },
        json: { user_id: selecteduserId }
      });
      onJobUpdated(updatedJob);
      onClose();
    } catch (err: any) {
      if (err instanceof HTTPError) {
        const errorJson = await err.response.json().catch(() => ({}));
        setError(errorJson.error || 'Failed to reassign job');
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
            <h5 className="text-xl font-bold">Edit Job: {job.title}</h5>
            <button type="button" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl font-bold" onClick={onClose}>&times;</button>
          </div>
          <div className="p-6">
            {error && <div className="alert alert-danger">{error}</div>}
            <div className="mb-3">
              <label htmlFor="customer" className="form-label">Reassign to Customer</label>
              <select
                id="customer"
                className="form-control"
                value={selecteduserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
              >
                {users.map(user => (
                  <option key={user.id} value={user.id.toString()}>
                    {user.name || user.company_name} ({user.email || user.phone})
                  </option>
                ))}
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

export default EditJobModal;
