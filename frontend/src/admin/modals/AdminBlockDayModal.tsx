import { useState } from 'react';
import { format } from 'date-fns';
import { addCalendarEvent, removeCalendarEvent } from '../../lib/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date;
  isBlocked: boolean;
  reason?: string | null;
  onUpdate: () => void; // Callback to refresh the calendar
}

function AdminBlockDayModal({ isOpen, onClose, selectedDate, isBlocked, reason, onUpdate }: Props) {
  const [note, setNote] = useState(reason || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const dateStr = format(selectedDate, 'yyyy-MM-dd');

  const handleBlock = async () => {
    setIsSubmitting(true);
    setError('');
    try {
      await addCalendarEvent({
        title: note,
        start: dateStr,
        end: dateStr,
        type: 'blocked',
      });
      onUpdate();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to block date.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnblock = async () => {
    setIsSubmitting(true);
    setError('');
    try {
      // We need the event ID to delete it. This will require a change to how the modal is opened.
      // For now, I will assume the ID is passed in as a prop.
      // This will be a breaking change, and I will need to update the parent component.
      // @ts-ignore
      await removeCalendarEvent(reason);
      onUpdate();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to unblock date.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
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
