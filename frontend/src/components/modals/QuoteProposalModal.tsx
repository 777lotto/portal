import React, { useState } from 'react';
import { api } from '../../lib/api';
import { HTTPException } from 'hono/http-exception';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface QuoteProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
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

const QuoteProposalModal: React.FC<QuoteProposalModalProps> = ({ isOpen, onClose, jobId }) => {
  const queryClient = useQueryClient();
  const [revisionReason, setRevisionReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['jobs'] });
    queryClient.invalidateQueries({ queryKey: ['quotes'] });
    queryClient.invalidateQueries({ queryKey: ['job', jobId] });
    onClose();
  };

  const handleError = async (err: unknown) => {
    const message = await getErrorMessage(err);
    setError(message);
  };

  const confirmMutation = useMutation({
    mutationFn: () => api.quotes[':quoteId'].accept.$post({ param: { quoteId: jobId } }),
    onSuccess: (res) => {
      if (!res.ok) throw new HTTPException(res.status, { res });
      handleSuccess();
    },
    onError: handleError,
  });

  const declineMutation = useMutation({
    mutationFn: () => api.quotes[':quoteId'].decline.$post({ param: { quoteId: jobId } }),
    onSuccess: (res) => {
      if (!res.ok) throw new HTTPException(res.status, { res });
      handleSuccess();
    },
    onError: handleError,
  });

  const reviseMutation = useMutation({
    mutationFn: (reason: string) => api.quotes[':quoteId'].revise.$post({ param: { quoteId: jobId }, json: { reason } }),
    onSuccess: (res) => {
      if (!res.ok) throw new HTTPException(res.status, { res });
      handleSuccess();
    },
    onError: handleError,
  });

  const handleRevise = () => {
    if (revisionReason.trim()) {
      reviseMutation.mutate(revisionReason);
    }
  };

  const isSubmitting = confirmMutation.isPending || declineMutation.isPending || reviseMutation.isPending;

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-base-100 p-6 rounded-lg shadow-xl w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Quote Proposal</h2>
        <p className="mb-4">What would you like to do with this quote?</p>

        {error && <div className="alert alert-error shadow-lg mb-4"><div><span>{error}</span></div></div>}

        <div className="form-control">
          <label htmlFor="revision-reason" className="label">
            <span className="label-text">Reason for Revision (if applicable)</span>
          </label>
          <textarea
            id="revision-reason"
            value={revisionReason}
            onChange={(e) => setRevisionReason(e.target.value)}
            className="textarea textarea-bordered"
            rows={3}
            placeholder="e.g., Please adjust the pricing for service X."
          />
        </div>

        <div className="flex justify-end space-x-2 mt-6">
          <button onClick={onClose} className="btn btn-ghost" disabled={isSubmitting}>
            Cancel
          </button>
          <button onClick={() => declineMutation.mutate()} className="btn btn-error" disabled={isSubmitting}>
            {declineMutation.isPending ? <span className="loading loading-spinner"></span> : "Decline"}
          </button>
          <button onClick={handleRevise} disabled={!revisionReason.trim() || isSubmitting} className="btn btn-warning">
            {reviseMutation.isPending ? <span className="loading loading-spinner"></span> : "Revise"}
          </button>
          <button onClick={() => confirmMutation.mutate()} className="btn btn-success">
            {confirmMutation.isPending ? <span className="loading loading-spinner"></span> : "Accept"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuoteProposalModal;
