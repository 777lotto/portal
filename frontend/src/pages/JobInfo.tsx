import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { HTTPException } from 'hono/http-exception';
import type { Job, LineItem, Photo, Note } from '@portal/shared';
import RecurrenceRequestModal from '../components/modals/RecurrenceRequestModal.js';
import QuoteProposalModal from '../components/modals/QuoteProposalModal.js';

const parseRRule = (rrule: string | null | undefined): string => {
    if (!rrule) return 'Not set';
    const parts = rrule.split(';');
    const rules: Record<string, string> = {};
    parts.forEach(part => {
        const [key, value] = part.split('=');
        if (key && value) rules[key] = value;
    });
    const frequency = rules.FREQ;
    const interval = rules.INTERVAL ? parseInt(rules.INTERVAL, 10) : 1;
    const byDay = rules.BYDAY;
    let description = 'Recurs';
    if (frequency === 'DAILY') description += interval > 1 ? ` every ${interval} days` : ' daily';
    else if (frequency === 'WEEKLY') description += interval > 1 ? ` every ${interval} weeks` : ' weekly';
    else if (frequency === 'MONTHLY') description += interval > 1 ? ` every ${interval} months` : ' monthly';
    if (byDay) {
        const dayMap: Record<string, string> = { SU: 'Sunday', MO: 'Monday', TU: 'Tuesday', WE: 'Wednesday', TH: 'Thursday', FR: 'Friday', SA: 'Saturday' };
        const days = byDay.split(',').map(d => dayMap[d]).join(', ');
        description += ` on ${days}`;
    }
    return description;
};

function JobInfo() {
  const { id: jobId } = useParams<{ id: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRecurrenceModalOpen, setIsRecurrenceModalOpen] = useState(false);
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchJobDetails = useCallback(async () => {
    if (!jobId) return;
    try {
      setError(null);

      // --- REFACTORED ---
      // Promise.all is much cleaner now. Hono client handles parsing.
      const [jobData, lineItemsData, photosData, notesData] = await Promise.all([
        api.jobs[':id'].$get({ param: { id: jobId } }),
        api.jobs[':id']['line-items'].$get({ param: { id: jobId } }),
        api.jobs[':id'].photos.$get({ param: { id: jobId } }),
        api.jobs[':id'].notes.$get({ param: { id: jobId } })
      ]);

      setJob(jobData);
      setLineItems(lineItemsData);
      setPhotos(photosData);
      setNotes(notesData);
    } catch (err: any) {
        if (err instanceof HTTPException) {
            const errorJson = await err.response.json();
            setError(errorJson.error || 'Failed to fetch job details.');
        } else {
            setError(err.message || 'An unknown error occurred.');
        }
    } finally {
      setIsLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    setIsLoading(true);
    fetchJobDetails();
  }, [jobId, fetchJobDetails]);

  const handleApiError = async (err: any, defaultMessage: string) => {
    if (err instanceof HTTPException) {
        const errorJson = await err.response.json();
        setError(errorJson.error || defaultMessage);
    } else {
        setError(err.message || defaultMessage);
    }
  };

  const handleAcceptQuote = async () => {
    if (!job?.id) return;
    try {
        await api.quotes[':quoteId'].accept.$post({ param: { quoteId: job.id } });
        fetchJobDetails();
        setIsQuoteModalOpen(false);
    } catch (err) {
        handleApiError(err, 'Failed to accept quote');
    }
  };

  const handleDeclineQuote = async () => {
      if (!job?.id) return;
      try {
          await api.quotes[':quoteId'].decline.$post({ param: { quoteId: job.id } });
          fetchJobDetails();
          setIsQuoteModalOpen(false);
      } catch (err) {
          handleApiError(err, 'Failed to decline quote');
      }
  };

  const handleReviseQuote = async (revisionReason: string) => {
      if (!job?.id) return;
      try {
          await api.quotes[':quoteId'].revise.$post({
            param: { quoteId: job.id },
            json: { revisionReason }
          });
          fetchJobDetails();
          setIsQuoteModalOpen(false);
      } catch (err) {
          handleApiError(err, 'Failed to revise quote');
      }
  };

  const statusStyle = (status: string) => {
      switch (status.toLowerCase()) {
        case 'upcoming': return 'bg-yellow-100 text-yellow-800';
        case 'confirmed': return 'bg-blue-100 text-blue-800';
        case 'completed':
        case 'paid':
             return 'bg-green-100 text-green-800';
        case 'payment_pending': return 'bg-orange-100 text-orange-800';
        case 'past_due': return 'bg-red-100 text-red-800';
        case 'cancelled': return 'bg-gray-100 text-gray-800';
        default: return 'bg-gray-100 text-gray-800';
      }
  };

  if (isLoading) return <div className="text-center p-8">Loading job details...</div>;
  if (error && !job) return <div className="rounded-md bg-red-100 p-4 text-sm text-red-700">{error}</div>;
  if (!job) return <div className="text-center p-8"><h2>Job not found</h2></div>;

  const hasRecurrence = job.recurrence && job.recurrence !== 'none';

  return (
    <>
      {isRecurrenceModalOpen && (
        <RecurrenceRequestModal
          isOpen={isRecurrenceModalOpen}
          onClose={() => setIsRecurrenceModalOpen(false)}
          job={job}
          onSuccess={() => {
            setSuccessMessage(`Your recurrence ${hasRecurrence ? 'update' : 'request'} has been submitted.`);
            setTimeout(() => setSuccessMessage(null), 5000);
            fetchJobDetails();
          }}
        />
      )}
      <QuoteProposalModal
          isOpen={isQuoteModalOpen}
          onClose={() => setIsQuoteModalOpen(false)}
          onConfirm={handleAcceptQuote}
          onDecline={handleDeclineQuote}
          onRevise={handleReviseQuote}
          jobId={jobId!}
      />
      {/* ... Rest of JSX is unchanged ... */}
      <div className="max-w-7xl mx-auto space-y-6">
        {error && <div className="alert alert-danger mb-4">{error}</div>}
        {successMessage && <div className="alert alert-success mb-4">{successMessage}</div>}
        <div className="card">
          <div className="card-header flex justify-between items-center">
            <div><h2 className="card-title">{job.title}</h2></div>
            <div className="flex items-center gap-2">
              {job.status === 'pending' && (
                <button className="btn btn-primary" onClick={() => setIsQuoteModalOpen(true)}>Respond to Quote</button>
              )}
              <button className="btn btn-primary" onClick={() => setIsRecurrenceModalOpen(true)}>
                  {hasRecurrence ? 'Alter Recurrence' : 'Request Recurrence'}
              </button>
            </div>
          </div>
          <div className="card-body">
            <dl className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2">
                <div className="sm:col-span-1">
                    <dt className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">Status</dt>
                    <dd className="mt-1 text-sm">
                    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${statusStyle(job.status)}`}>
                        {job.status.replace(/_/g, ' ')}
                    </span>
                    </dd>
                </div>
                <div className="sm:col-span-1">
                    <dt className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">Total Cost</dt>
                    <dd className="mt-1 text-sm font-semibold">${((job.total_amount_cents || 0) / 100).toFixed(2)}</dd>
                </div>
                {job.description && (
                <div className="sm:col-span-2">
                    <dt className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">Description</dt>
                    <dd className="mt-1 text-sm">{job.description}</dd>
                </div>
                )}
                {hasRecurrence && (
                <div className="sm:col-span-1">
                    <dt className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">Recurrence</dt>
                    <dd className="mt-1 text-sm font-semibold">{parseRRule(job.recurrence)}</dd>
                </div>
                )}
                {job.stripe_quote_id && (
                <div className="sm:col-span-1">
                    <dt className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">Quote</dt>
                    <dd className="mt-1 text-sm">
                        <a href={`https://dashboard.stripe.com/quotes/${job.stripe_quote_id}`} target="_blank" rel="noopener noreferrer" className="text-event-blue hover:underline">
                            View Quote
                        </a>
                    </dd>
                </div>
                )}
                {job.stripe_invoice_id && (
                <div className="sm:col-span-1">
                    <dt className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">Invoice</dt>
                    <dd className="mt-1 text-sm">
                        <Link to={`/pay-invoice/${job.stripe_invoice_id}`} className="text-event-blue hover:underline">
                            Pay Invoice
                        </Link>
                    </dd>
                </div>
                )}
            </dl>
          </div>
        </div>

        <div className="card">
            <div className="card-header"><h3 className="card-title text-xl">Service Line Items</h3></div>
            <div className="card-body">
                {lineItems.length > 0 ? (
                    <ul className="divide-y divide-border-light dark:divide-border-dark">
                        {lineItems.map(item => (
                            <li key={item.id} className="py-3 flex justify-between items-center">
                                <span>{item.description}</span>
                                <span className="font-medium">${((item.unit_total_amount_cents || 0) / 100).toFixed(2)} x {item.quantity}</span>
                            </li>
                        ))}
                    </ul>
                ) : <p>No service items found for this job.</p>}
            </div>
             <div className="card-footer bg-secondary-light dark:bg-secondary-dark p-4 flex justify-end">
                  <span className="text-lg font-bold">Total: ${((job.total_amount_cents || 0) / 100).toFixed(2)}</span>
             </div>
        </div>

        <div className="card">
            <div className="card-header"><h3 className="card-title text-xl">Photos</h3></div>
            <div className="card-body">
                {photos.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {photos.map(photo => (
                            <a key={photo.id} href={photo.url} target="_blank" rel="noopener noreferrer">
                                <img src={photo.url} alt={`Job photo taken on ${new Date(photo.createdAt).toLocaleDateString()}`} className="rounded-lg object-cover aspect-square"/>
                            </a>
                        ))}
                    </div>
                ) : <p>No photos found for this job.</p>}
            </div>
        </div>

        <div className="card">
            <div className="card-header"><h3 className="card-title text-xl">Notes</h3></div>
            <div className="card-body">
                {notes.length > 0 ? (
                    <ul className="space-y-4">
                        {notes.map(note => (
                            <li key={note.id} className="p-3 bg-secondary-light dark:bg-secondary-dark rounded-md">
                                <p className="text-sm">{note.content}</p>
                                <small className="text-text-secondary-light dark:text-text-secondary-dark">{new Date(note.createdAt).toLocaleString()}</small>
                            </li>
                        ))}
                    </ul>
                ) : <p>No notes found for this job.</p>}
            </div>
        </div>
      </div>
    </>
  );
}

export default JobInfo;
