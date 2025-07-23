// frontend/src/components/RecurrenceRequestModal.tsx
import { useState, useEffect } from 'react';
import { requestRecurrence, getUnavailableRecurrenceDays } from '../lib/api';
import type { Job } from '@portal/shared';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  job: Job;
  onSuccess: () => void;
}

const weekDays = [
  { label: 'Sunday', value: 0 },
  { label: 'Monday', value: 1 },
  { label: 'Tuesday', value: 2 },
  { label: 'Wednesday', value: 3 },
  { label: 'Thursday', value: 4 },
  { label: 'Friday', value: 5 },
  { label: 'Saturday', value: 6 },
];

function RecurrenceRequestModal({ isOpen, onClose, job, onSuccess }: Props) {
  const [frequency, setFrequency] = useState(30);
  const [requestedDay, setRequestedDay] = useState<number | undefined>(new Date(job.start).getDay());
  const [unavailableDays, setUnavailableDays] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      getUnavailableRecurrenceDays().then(data => {
        setUnavailableDays(data.unavailableDays);
      });
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await requestRecurrence(job.id, { frequency, requested_day: requestedDay });
      onSuccess();
      onClose();
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
        <h2 className="text-xl font-bold mb-4">Request Recurrence for "{job.title}"</h2>
        {error && <div className="alert alert-danger">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="frequency" className="form-label">How often?</label>
            <div className="input-group">
              <span className="input-group-text">Once every</span>
              <input
                type="number"
                id="frequency"
                className="form-control"
                value={frequency}
                onChange={e => setFrequency(parseInt(e.target.value, 10))}
                min="1"
              />
              <span className="input-group-text">days</span>
            </div>
          </div>
          <div className="mb-4">
            <label htmlFor="requested_day" className="form-label">Preferred day of the week</label>
            <select
              id="requested_day"
              className="form-control"
              value={requestedDay ?? ''}
              onChange={e => {
                const value = e.target.value;
                setRequestedDay(value === '' ? undefined : parseInt(value, 10));
              }}
            >
              <option value="">Any day</option>
              {weekDays.map(day => (
                <option key={day.value} value={day.value} disabled={unavailableDays.includes(day.value)}>
                  {day.label} {unavailableDays.includes(day.value) ? '(Unavailable)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end items-center mt-6">
            <button type="button" onClick={onClose} className="btn btn-secondary mr-2">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default RecurrenceRequestModal;
