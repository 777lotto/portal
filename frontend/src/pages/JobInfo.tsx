// frontend/src/pages/JobInfo.tsx
import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Job, LineItem, Photo, Note } from '@portal/shared';
import RecurrenceRequestModal from '../components/modals/RecurrenceRequestModal';
import QuoteProposalModal from '../components/modals/QuoteProposalModal';
import { handleApiError } from '../lib/utils';

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

// --- REFACTORED: Data Fetching with a single useQuery ---
const fetchJobDetails = async (jobId: string) => {
  const [jobRes, lineItemsRes, photosRes, notesRes] = await Promise.all([
    api.jobs[':id'].$get({ param: { id: jobId } }),
    api.jobs[':id']['line-items'].$get({ param: { id: jobId } }),
    api.jobs[':id'].photos.$get({ param: { id: jobId } }),
    api.jobs[':id'].notes.$get({ param: { id: jobId } })
  ]);

  if (!jobRes.ok) throw await handleApiError(jobRes, 'Failed to fetch job details');
  if (!lineItemsRes.ok) throw await handleApiError(lineItemsRes, 'Failed to fetch line items');
  if (!photosRes.ok) throw await handleApiError(photosRes, 'Failed to fetch photos');
  if (!notesRes.ok) throw await handleApiError(notesRes, 'Failed to fetch notes');

  const jobData = await jobRes.json();
  const lineItemsData = await lineItemsRes.json();
  const photosData = await photosRes.json();
  const notesData = await notesRes.json();

  return {
    job: jobData.job as Job,
    lineItems: lineItemsData.lineItems as LineItem[],
    photos: photosData.photos as Photo[],
    notes: notesData.notes as Note[],
  };
};

function JobInfo() {
  const { id: jobId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [isRecurrenceModalOpen, setIsRecurrenceModalOpen] = useState(false);
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['jobDetails', jobId],
    queryFn: () => fetchJobDetails(jobId!),
    enabled: !!jobId,
  });

  const { job, lineItems, photos, notes } = data || {};

  const quoteActionMutation = useMutation({
    mutationFn: async ({ action, reason }: { action: 'accept' | 'decline' | 'revise', reason?: string }) => {
        if (!jobId) throw new Error("Job ID is missing");
        let res;
        switch (action) {
            case 'accept':
                res = await api.quotes[':quoteId'].accept.$post({ param: { quoteId: jobId } });
                break;
            case 'decline':
                res = await api.quotes[':quoteId'].decline.$post({ param: { quoteId: jobId } });
                break;
            case 'revise':
                if (!reason) throw new Error("Revision reason is required");
                res = await api.quotes[':quoteId'].revise.$post({ param: { quoteId: jobId }, json: { revisionReason: reason } });
                break;
        }
        if (!res.ok) throw await handleApiError(res, `Failed to ${action} quote.`);
        return action;
    },
    onSuccess: (action) => {
        queryClient.invalidateQueries({ queryKey: ['jobDetails', jobId] });
        setIsQuoteModalOpen(false);
        setSuccessMessage(`Quote successfully ${action}ed!`);
        setTimeout(() => setSuccessMessage(null), 5000);
    },
    onError: (err: Error) => {
        // Error is already a string from handleApiError
        // You could show it in a toast notification
        console.error(err);
        alert(err.message);
    }
  });

  const statusStyle = (status: string = '') => {
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
  if (error) return <div className="rounded-md bg-red-100 p-4 text-sm text-red-700">{(error as Error).message}</div>;
  if (!job) return <div className="text-center p-8"><h2>Job not found</h2></div>;

  const hasRecurrence = job.recurrence_rule && job.recurrence_rule !== 'none';

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
            queryClient.invalidateQueries({ queryKey: ['jobDetails', jobId] });
          }}
        />
      )}
      <QuoteProposalModal
          isOpen={isQuoteModalOpen}
          onClose={() => setIsQuoteModalOpen(false)}
          onConfirm={() => quoteActionMutation.mutate({ action: 'accept' })}
          onDecline={() => quoteActionMutation.mutate({ action: 'decline' })}
          onRevise={(reason) => quoteActionMutation.mutate({ action: 'revise', reason })}
          jobId={jobId!}
          isSubmitting={quoteActionMutation.isPending}
      />
      <div className="max-w-7xl mx-auto space-y-6">
        {successMessage && <div className="alert alert-success mb-4">{successMessage}</div>}
        <div className="card">
          <div className="card-header flex justify-between items-center">
            <div><h2 className="card-title">{job.job_title}</h2></div>
            <div className="flex items-center gap-2">
              {job.status === 'pending_quote' && (
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
                {job.job_description && (
                <div className="sm:col-span-2">
                    <dt className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">Description</dt>
                    <dd className="mt-1 text-sm">{job.job_description}</dd>
                </div>
                )}
                {hasRecurrence && (
                <div className="sm:col-span-1">
                    <dt className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">Recurrence</dt>
                    <dd className="mt-1 text-sm font-semibold">{parseRRule(job.recurrence_rule)}</dd>
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
                {lineItems && lineItems.length > 0 ? (
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
                {photos && photos.length > 0 ? (
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
                {notes && notes.length > 0 ? (
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
