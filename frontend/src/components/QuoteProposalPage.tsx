// frontend/src/components/QuoteProposalPage.tsx
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { apiGet, apiPost } from '../lib/api';
import type { Job, Service } from '@portal/shared';

interface QuoteDetails extends Job {
    services: Service[];
    customerName?: string;
}

function QuoteProposalPage() {
    const { quoteId } = useParams<{ quoteId: string }>();
    const navigate = useNavigate();
    const { data: quote, error, mutate } = useSWR<QuoteDetails>(quoteId ? `/api/quotes/${quoteId}` : null, apiGet);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const [revisionReason, setRevisionReason] = useState('');
    const [isRevising, setIsRevising] = useState(false);

    const handleAccept = async () => {
        setActionError(null);
        setIsSubmitting(true);
        try {
            await apiPost(`/api/quotes/${quoteId}/accept`, {});
            mutate();
            navigate('/dashboard', { state: { message: 'Quote accepted successfully!' } });
        } catch (err: any) {
            setActionError(err.message || 'Failed to accept quote.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDecline = async () => {
        setActionError(null);
        setIsSubmitting(true);
        try {
            await apiPost(`/api/quotes/${quoteId}/decline`, {});
            mutate();
            navigate('/dashboard', { state: { message: 'Quote declined.' } });
        } catch (err: any) {
            setActionError(err.message || 'Failed to decline quote.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRevisionSubmit = async () => {
        if (!revisionReason) {
            setActionError('Please provide a reason for the revision.');
            return;
        }
        setActionError(null);
        setIsSubmitting(true);
        try {
            await apiPost(`/api/quotes/${quoteId}/revise`, { revisionReason });
            mutate();
            setIsRevising(false);
            navigate('/dashboard', { state: { message: 'Revision request submitted.' } });
        } catch (err: any) {
            setActionError(err.message || 'Failed to submit revision request.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (error) return <div className="rounded-md bg-red-100 p-4 text-sm text-red-700">Failed to load quote details.</div>;
    if (!quote) return <div className="text-center p-8">Loading...</div>;

    const total = quote.services.reduce((acc, service) => acc + (service.price_cents || 0), 0);

    const isActionable = quote.status === 'pending_quote';

    return (
        <div className="max-w-4xl mx-auto bg-white dark:bg-tertiary-dark shadow-lg rounded-lg p-8">
            <h1 className="text-3xl font-bold mb-2 text-text-primary-light dark:text-text-primary-dark">Quote Proposal</h1>
            <p className="text-text-secondary-light dark:text-text-secondary-dark mb-6">For: {quote.title}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div>
                    <h5 className="font-semibold">Status</h5>
                    <p className="capitalize">{quote.status.replace(/_/g, ' ')}</p>
                </div>
                <div>
                    <h5 className="font-semibold">Expires On</h5>
                    <p>{quote.expires_at ? new Date(quote.expires_at).toLocaleDateString() : 'N/A'}</p>
                </div>
            </div>

            <div className="mb-8">
                <h4 className="text-xl font-semibold mb-4 border-b pb-2">Line Items</h4>
                <div className="space-y-3">
                    {quote.services.map(service => (
                        <div key={service.id} className="flex justify-between items-center p-3 rounded-md bg-gray-50 dark:bg-gray-800">
                            <span>{service.notes}</span>
                            <span className="font-semibold">${((service.price_cents || 0) / 100).toFixed(2)}</span>
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
