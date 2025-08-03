import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { api } from '../../../lib/api';
import { HTTPException } from 'hono/http-exception';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date;
  isBlocked: boolean;
  eventId?: number | null;
  reason?: string | null;
  onUpdate: () => void;
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

function AdminBlockDayModal({ isOpen, onClose, selectedDate, isBlocked, eventId, reason, onUpdate }: Props) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setNote(reason || '');
      setError('');
    }
  }, [isOpen, reason]);

  const blockDateMutation = useMutation({
    mutationFn: (title: string) => {
      return api.admin['calendar-events'].$post({
        json: {
          title,
          start: format(selectedDate, 'yyyy-MM-dd'),
          end: format(selectedDate, 'yyyy-MM-dd'),
          type: 'blocked',
        }
      });
    },
    onSuccess: (res) => {
      if (!res.ok) throw new HTTPException(res.status, { res });
      queryClient.invalidateQueries({ queryKey: ['admin', 'calendar-events'] });
      onUpdate();
      onClose();
    },
    onError: async (err) => {
      const message = await getErrorMessage(err);
      setError(message);
    }
  });

  const unblockDateMutation = useMutation({
    mutationFn: (id: number) => {
      return api.admin['calendar-events'][':eventId'].$delete({
        param: { eventId: id.toString() }
      });
    },
    onSuccess: (res) => {
      if (!res.ok) throw new HTTPException(res.status, { res });
      queryClient.invalidateQueries({ queryKey: ['admin', 'calendar-events'] });
      onUpdate();
      onClose();
    },
    onError: async (err) => {
      const message = await getErrorMessage(err);
      setError(message);
    }
  });

  const handleBlock = () => {
    blockDateMutation.mutate(note);
  };

  const handleUnblock = () => {
    if (!eventId) {
        setError('Cannot unblock date: Event ID is missing.');
        return;
    }
    unblockDateMutation.mutate(eventId);
  };

  const isSubmitting = blockDateMutation.isPending || unblockDateMutation.isPending;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-base-100 rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Manage Date: {format(selectedDate, 'MMMM do, yyyy')}</h2>
        {error && <div className="alert alert-error shadow-lg"><div><span>{error}</span></div></div>}
        <div className="form-control mt-4">
          <label htmlFor="reason" className="label">
            <span className="label-text">Reason for blocking (optional)</span>
          </label>
          <input
            id="reason"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="input input-bordered"
            placeholder="e.g., Holiday, Team Off-site"
            disabled={isBlocked || isSubmitting}
          />
        </div>
        <div className="flex justify-between items-center mt-6">
          <button type="button" onClick={onClose} className="btn btn-ghost">
            Cancel
          </button>
          <div>
            {isBlocked ? (
              <button onClick={handleUnblock} className="btn btn-primary" disabled={isSubmitting}>
                {isSubmitting ? <span className="loading loading-spinner"></span> : 'Unblock Date'}
              </button>
            ) : (
              <button onClick={handleBlock} className="btn btn-info" disabled={isSubmitting}>
                {isSubmitting ? <span className="loading loading-spinner"></span> : 'Block Date'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminBlockDayModal;
