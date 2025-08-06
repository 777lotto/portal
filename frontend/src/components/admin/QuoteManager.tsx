// frontend/src/components/admin/QuoteManager.tsx
import { useState } from 'react';
import { apiPost } from '../../lib/api';
import type { Job } from '@portal/shared';

interface Props {
  job: Job;
  onQuoteCreated: () => void; // Callback to refresh parent component
}

export function QuoteManager({ job, onQuoteCreated }: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateQuote = async () => {
    if (!window.confirm("This will create a new quote for this job and notify the customer. Are you sure?")) {
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      // This endpoint needs to be created in the backend
      await apiPost(`/api/admin/jobs/${job.id}/quote`, {});
      onQuoteCreated();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="card mt-4">
      <div className="card-body">
        <h5 className="card-title">Quoting</h5>
        {error && <div className="alert alert-danger">{error}</div>}

        {job.stripe_quote_id ? (
          <div>
            <p>A quote has already been created for this job.</p>
            <p><strong>Quote ID:</strong> {job.stripe_quote_id}</p>
            <p><strong>Status:</strong> {job.status}</p>
          </div>
        ) : (
          <div>
            <p>This job does not have a quote yet. Add services to this job and then create a quote.</p>
            <button
              onClick={handleCreateQuote}
              className="btn btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating Quote...' : 'Create and Send Quote'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
