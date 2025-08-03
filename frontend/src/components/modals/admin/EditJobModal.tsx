import { useState, useEffect } from 'react';
import { api } from '../../../lib/api';
import { HTTPException } from 'hono/http-exception';
import type { Job, User } from '@portal/shared';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onJobUpdated: (updatedJob: Job) => void;
  job: Job;
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

function EditJobModal({ isOpen, onClose, onJobUpdated, job }: Props) {
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<string>(job.user_id);
  const [error, setError] = useState<string | null>(null);

  // Fetch users using TanStack Query
  const { data: users, isLoading: isLoadingUsers } = useQuery<User[], Error>({
    queryKey: ['admin', 'users'],
    queryFn: async () => {
        const res = await api.admin.users.$get();
        if (!res.ok) {
            throw new HTTPException(res.status, { res });
        }
        const data = await res.json();
        return data.users;
    },
    enabled: isOpen, // Only fetch when the modal is open
  });

  // Mutation for updating a job
  const { mutate: updateJob, isPending: isSubmitting } = useMutation({
    mutationFn: (newUserId: string) => {
        const res = api.admin.jobs[':jobId'].details.$put({
            param: { jobId: job.id.toString() },
            json: { user_id: newUserId }
        });
        return res;
    },
    onSuccess: async (res) => {
        if (!res.ok) {
            throw new HTTPException(res.status, { res });
        }
        const updatedJob = await res.json();
        // Invalidate queries that are now stale
        queryClient.invalidateQueries({ queryKey: ['admin', 'jobs'] });
        queryClient.invalidateQueries({ queryKey: ['admin', 'job', job.id.toString()] });
        onJobUpdated(updatedJob);
        onClose();
    },
    onError: async (err) => {
        const message = await getErrorMessage(err);
        setError(message);
    },
  });

  // Effect to reset form state when the modal is opened or the job changes
  useEffect(() => {
    if (isOpen) {
      setSelectedUserId(job.user_id);
      setError(null);
    }
  }, [isOpen, job.user_id]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    updateJob(selectedUserId);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-base-100 rounded-lg shadow-xl w-full max-w-lg">
        <form onSubmit={handleSubmit}>
          <div className="p-4 border-b border-base-300 flex justify-between items-center">
            <h5 className="text-xl font-bold">Edit Job: {job.title}</h5>
            <button type="button" className="btn btn-sm btn-circle btn-ghost" onClick={onClose}>✕</button>
          </div>
          <div className="p-6">
            {error && <div className="alert alert-error shadow-lg mb-4"><div><span>{error}</span></div></div>}
            <div className="form-control">
              <label htmlFor="customer" className="label"><span className="label-text">Reassign to Customer</span></label>
              <select
                id="customer"
                className="select select-bordered"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                disabled={isLoadingUsers}
              >
                {isLoadingUsers && <option>Loading users...</option>}
                {users?.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.name || user.company_name} ({user.email || user.phone})
                  </option>
                ))}
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

export default EditJobModal;
