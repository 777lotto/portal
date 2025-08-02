import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { api } from '../lib/api';
import { HTTPError } from 'hono/client';
import type { Job, LineItem } from '@portal/shared';

interface QuoteDetails extends Job {
    lineItems: LineItem[];
    customerName?: string;
}

// --- REFACTORED SWR Fetcher ---
// The fetcher now directly calls the api client. Hono handles JSON parsing and errors.
const quoteFetcher = (url: string) => {
    const quoteId = url.split('/').pop();
    if (!quoteId) throw new Error('Invalid quote ID');
    return api.quotes[':quoteId'].$get({ param: { quoteId } });
};

function QuoteProposalPage() {
    const { quoteId } = useParams<{ quoteId: string }>();
    const navigate = useNavigate();
    // SWR usage remains the same, but the fetcher is cleaner.
    const { data: quote, error, mutate } = useSWR<QuoteDetails>(quoteId ? `/api/quotes/${quoteId}` : null, quoteFetcher);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const [revisionReason, setRevisionReason] = useState('');
    const [isRevising, setIsRevising] = useState(false);

    // Generic error handler for API calls
    const handleApiError = async (err: any, defaultMessage: string) => {
        if (err instanceof HTTPError) {
            const errorJson = await err.response.json();
            setActionError(errorJson.error || defaultMessage);
        } else {
            setActionError(err.message || defaultMessage);
        }
    };

    const handleAccept = async () => {
        if (!quoteId) return;
        setActionError(null);
        setIsSubmitting(true);
        try {
            await api.quotes[':quoteId'].accept.$post({ param: { quoteId } });
            mutate(); // Re-fetch data
            navigate('/dashboard', { state: { message: 'Quote accepted successfully!' } });
        } catch (err) {
            handleApiError(err, 'Failed to accept quote.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDecline = async () => {
        if (!quoteId) return;
        setActionError(null);
        setIsSubmitting(true);
        try {
            await api.quotes[':quoteId'].decline.$post({ param: { quoteId } });
            mutate();
            navigate('/dashboard', { state: { message: 'Quote declined.' } });
        } catch (err) {
            handleApiError(err, 'Failed to decline quote.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRevisionSubmit = async () => {
        if (!quoteId || !revisionReason) {
            setActionError('Please provide a reason for the revision.');
            return;
        }
        setActionError(null);
        setIsSubmitting(true);
        try {
            await api.quotes[':quoteId'].revise.$post({
                param: { quoteId },
                json: { revisionReason }
            });
            mutate();
            setIsRevising(false);
            navigate('/dashboard', { state: { message: 'Revision request submitted.' } });
        } catch (err) {
            handleApiError(err, 'Failed to submit revision request.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (error) return <div className="rounded-md bg-red-100 p-4 text-sm text-red-700">Failed to load quote details.</div>;
    if (!quote) return <div className="text-center p-8">Loading...</div>;

    const total = quote.lineItems.reduce((acc, item) => acc + (item.unit_total_amount_cents || 0) * item.quantity, 0);
    const isActionable = quote.status === 'pending';

    return (
        <div className="max-w-4xl mx-auto bg-white dark:bg-tertiary-dark shadow-lg rounded-lg p-8">
            <h1 className="text-3xl font-bold mb-2 text-text-primary-light dark:text-text-primary-dark">Quote Proposal</h1>
            <p className="text-text-secondary-light dark:text-text-secondary-dark mb-6">For: {quote.title}</p>

            {/* ... Rest of JSX is unchanged ... */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div>
                    <h5 className="font-semibold">Status</h5>
                    <p className="capitalize">{quote.status.replace(/_/g, ' ')}</p>
                </div>
                <div>
                    <h5 className="font-semibold">Expires On</h5>
                    <p>{quote.due ? new Date(quote.due).toLocaleDateString() : 'N/A'}</p>
                </div>
            </div>

            <div className="mb-8">
                <h4 className="text-xl font-semibold mb-4 border-b pb-2">Line Items</h4>
                <div className="space-y-3">
                    {quote.lineItems.map(item => (
                        <div key={item.id} className="flex justify-between items-center p-3 rounded-md bg-gray-50 dark:bg-gray-800">
                            <span>{item.description}</span>
                            <span className="font-semibold">${((item.unit_total_amount_cents || 0) / 100).toFixed(2)}</span>
                        </div>
                    ))}
                </div>
                <div className="flex justify-end items-center mt-4 pr-3">
                    <span className="text-lg font-bold">Total:</span>
                    <span className="text-lg font-bold ml-4">${(total / 100).toFixed(2)}</span>
                </div>
            </div>

            {actionError && <div className="alert alert-danger mb-4">{actionError}</div>}

            {isActionable && (
                <div className="flex items-center justify-end space-x-4">
                    <button onClick={() => setIsRevising(true)} className="btn btn-secondary" disabled={isSubmitting}>Request Revision</button>
                    <button onClick={handleDecline} className="btn btn-danger" disabled={isSubmitting}>Decline</button>
                    <button onClick={handleAccept} className="btn btn-primary" disabled={isSubmitting}>Accept Quote</button>
                </div>
            )}

            {isRevising && (
                <div className="mt-6 p-4 border-t">
                    <h4 className="text-lg font-semibold mb-2">Request Revision</h4>
                    <textarea
                        className="form-control w-full"
                        rows={3}
                        placeholder="Please describe the changes you'd like..."
                        value={revisionReason}
                        onChange={(e) => setRevisionReason(e.target.value)}
                    ></textarea>
                    <div className="flex justify-end space-x-3 mt-3">
                        <button onClick={() => setIsRevising(false)} className="btn btn-secondary">Cancel</button>
                        <button onClick={handleRevisionSubmit} className="btn btn-primary" disabled={isSubmitting}>Submit Request</button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default QuoteProposalPage;
