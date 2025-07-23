// frontend/src/components/admin/AdminRecurrenceRequestModal.tsx
import { useState } from 'react';
import { updateRecurrenceRequest } from '../../lib/api';
import type { JobRecurrenceRequest } from '@portal/shared';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  request: JobRecurrenceRequest;
  onUpdate: () => void;
}

const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function AdminRecurrenceRequestModal({ isOpen, onClose, request, onUpdate }: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpdate = async (status: 'accepted' | 'declined') => {
    setError(null);
    setIsSubmitting(true);
    try {
      await updateRecurrenceRequest(request.id, { status });
      onUpdate();
    } catch (err: any) {
      setError(err.message || 'An unknown error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-tertiary-dark rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Review Recurrence Request</h2>
        {error && <div className="alert alert-danger">{error}</div>}

        <div className="space-y-3 text-sm">
          <p><strong>Customer:</strong> {request.customer_name}</p>
          <p><strong>Job:</strong> {request.job_title}</p>
          <p><strong>Requested Frequency:</strong> Every {request.frequency} days</p>
          {request.requested_day !== null && (
            <p><strong>Preferred Day:</strong> {weekDays[request.requested_day]}</p>
          )}
        </div>

        <div className="flex justify-end items-center mt-6 space-x-3">
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          <button onClick={() => handleUpdate('declined')} className="btn btn-danger" disabled={isSubmitting}>
            {isSubmitting ? '...' : 'Decline'}
          </button>
          <button onClick={() => handleUpdate('accepted')} className="btn btn-success" disabled={isSubmitting}>
            {isSubmitting ? '...' : 'Accept'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AdminRecurrenceRequestModal;
