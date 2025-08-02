// frontend/src/components/modals/admin/AdminBlockDayModal.tsx
import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { api } from '../../../lib/api';
import { HTTPException } from 'hono/http-exception';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date;
  isBlocked: boolean;
  eventId?: number | null;
  reason?: string | null;
  onUpdate: () => void;
}

function AdminBlockDayModal({ isOpen, onClose, selectedDate, isBlocked, eventId, reason, onUpdate }: Props) {
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setNote(reason || '');
    }
  }, [isOpen, reason]);

  const handleApiError = async (err: any, defaultMessage: string) => {
    if (err instanceof HTTPException) {
        const errorJson = await err.response.json().catch(() => ({}));
        setError(errorJson.error || defaultMessage);
    } else {
        setError(err.message || defaultMessage);
    }
  };

  const handleBlock = async () => {
    setIsSubmitting(true);
    setError('');
    try {
      await api.admin['calendar-events'].$post({
        json: {
          title: note,
          start: format(selectedDate, 'yyyy-MM-dd'),
          end: format(selectedDate, 'yyyy-MM-dd'),
          type: 'blocked',
        }
      });
      onUpdate();
      onClose();
    } catch (err) {
      handleApiError(err, 'Failed to block date.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnblock = async () => {
    if (!eventId) {
        setError('Cannot unblock date: Event ID is missing.');
        return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      await api.admin['calendar-events'][':eventId'].$delete({
          param: { eventId: eventId.toString() }
      });
      onUpdate();
      onClose();
    } catch (err) {
      handleApiError(err, 'Failed to unblock date.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    // ... JSX is unchanged ...
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-tertiary-dark rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Manage Date: {format(selectedDate, 'MMMM do, yyyy')}</h2>
        {error && <div className="alert alert-danger">{error}</div>}
        <div className="mb-4">
          <label htmlFor="reason" className="block text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">
            Reason for blocking (optional)
          </label>
          <input
            id="reason"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="form-control mt-1"
            placeholder="e.g., Holiday, Team Off-site"
            disabled={isBlocked}
          />
        </div>
        <div className="flex justify-between items-center mt-6">
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          <div>
            {isBlocked ? (
              <button onClick={handleUnblock} className="btn btn-primary" disabled={isSubmitting}>
                {isSubmitting ? 'Unblocking...' : 'Unblock Date'}
              </button>
            ) : (
              <button onClick={handleBlock} className="btn btn-info" disabled={isSubmitting}>
                {isSubmitting ? 'Blocking...' : 'Block Date'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminBlockDayModal;
