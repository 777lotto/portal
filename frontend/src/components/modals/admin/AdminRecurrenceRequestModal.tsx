import { useState } from 'react';
import { api } from '../../../lib/api';
import { HTTPException } from 'hono/http-exception';
import type { JobRecurrenceRequest } from '@portal/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  request: JobRecurrenceRequest & { customer_name?: string, job_title?: string };
  onUpdate: () => void;
}

const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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

function AdminRecurrenceRequestModal({ isOpen, onClose, request, onUpdate }: Props) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { mutate: updateRequest, isPending: isSubmitting } = useMutation({
    mutationFn: (status: 'accepted' | 'declined') => {
      return api.admin['recurrence-requests'][':requestId'].$put({
        param: { requestId: request.id.toString() },
        json: { status }
      });
    },
    onSuccess: (res) => {
      if (!res.ok) {
        throw new HTTPException(res.status, { res });
      }
      queryClient.invalidateQueries({ queryKey: ['admin', 'recurrence-requests'] });
      onUpdate();
      onClose();
    },
    onError: async (err) => {
      const message = await getErrorMessage(err);
      setError(message);
    }
  });

  const handleUpdate = (status: 'accepted' | 'declined') => {
    setError(null);
    updateRequest(status);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-base-100 rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Review Recurrence Request</h2>
        {error && <div className="alert alert-error shadow-lg"><div><span>{error}</span></div></div>}
        <div className="space-y-3 text-sm">
          <p><strong>Customer:</strong> {request.customer_name || 'N/A'}</p>
          <p><strong>Job:</strong> {request.job_title || 'N/A'}</p>
          <p><strong>Requested Frequency:</strong> Every {request.frequency} days</p>
          {request.requested_day !== null && typeof request.requested_day !== 'undefined' && (
            <p><strong>Preferred Day:</strong> {weekDays[request.requested_day]}</p>
          )}
        </div>
        <div className="flex justify-end items-center mt-6 space-x-3">
          <button type="button" onClick={onClose} className="btn btn-ghost">
            Cancel
          </button>
          <button onClick={() => handleUpdate('declined')} className="btn btn-error" disabled={isSubmitting}>
            {isSubmitting && <span className="loading loading-spinner"></span>}
            Decline
          </button>
          <button onClick={() => handleUpdate('accepted')} className="btn btn-success" disabled={isSubmitting}>
            {isSubmitting && <span className="loading loading-spinner"></span>}
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}

export default AdminRecurrenceRequestModal;
