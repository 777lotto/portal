// frontend/src/pages/QuoteProposalPage.tsx
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Job, LineItem } from '@portal/shared';
import { handleApiError } from '../lib/utils';

interface QuoteDetails extends Job {
    lineItems: LineItem[];
    customerName?: string;
}

// --- REFACTORED: Data fetching with useQuery ---
const fetchQuote = async (quoteId: string): Promise<QuoteDetails> => {
    const res = await api.quotes[':quoteId'].$get({ param: { quoteId } });
    if (!res.ok) throw await handleApiError(res, 'Failed to fetch quote details');
    const data = await res.json();
    return data.quote;
};

function QuoteProposalPage() {
    const { quoteId } = useParams<{ quoteId: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [revisionReason, setRevisionReason] = useState('');
    const [isRevising, setIsRevising] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);

    const { data: quote, isLoading, error } = useQuery({
        queryKey: ['quote', quoteId],
        queryFn: () => fetchQuote(quoteId!),
        enabled: !!quoteId,
    });

    // --- REFACTORED: Actions with useMutation ---
    const handleActionMutation = useMutation({
        mutationFn: ({ action, reason }: { action: 'accept' | 'decline' | 'revise', reason?: string }) => {
            if (!quoteId) throw new Error("Quote ID is missing");
            switch (action) {
                case 'accept':
                    return api.quotes[':quoteId'].accept.$post({ param: { quoteId } });
                case 'decline':
                    return api.quotes[':quoteId'].decline.$post({ param: { quoteId } });
                case 'revise':
                    if (!reason) throw new Error("Revision reason is required");
                    return api.quotes[':quoteId'].revise.$post({ param: { quoteId }, json: { revisionReason: reason } });
            }
        },
        onSuccess: async (res, { action }) => {
            if (!res.ok) {
                const apiError = await handleApiError(res, `Failed to ${action} quote.`);
                throw apiError;
            }
            queryClient.invalidateQueries({ queryKey: ['quote', quoteId] });
            let message = '';
            if (action === 'accept') message = 'Quote accepted successfully!';
            else if (action === 'decline') message = 'Quote declined.';
            else if (action === 'revise') message = 'Revision request submitted.';
            navigate('/dashboard', { state: { message } });
        },
        onError: (err: Error) => {
            setActionError(err.message);
        }
    });

    if (isLoading) return <div className="text-center p-8">Loading...</div>;
    if (error) return <div className="rounded-md bg-red-100 p-4 text-sm text-red-700">{(error as Error).message}</div>;
    if (!quote) return <div className="text-center p-8">Quote not found.</div>;

    const total = quote.lineItems.reduce((acc, item) => acc + (item.unit_total_amount_cents || 0) * item.quantity, 0);
    const isActionable = quote.status === 'pending_quote';

    return (
        <div className="max-w-4xl mx-auto bg-white dark:bg-tertiary-dark shadow-lg rounded-lg p-8">
            <h1 className="text-3xl font-bold mb-2 text-text-primary-light dark:text-text-primary-dark">Quote Proposal</h1>
            <p className="text-text-secondary-light dark:text-text-secondary-dark mb-6">For: {quote.job_title}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div>
                    <h5 className="font-semibold">Status</h5>
                    <p className="capitalize">{quote.status.replace(/_/g, ' ')}</p>
                </div>
                <div>
                    <h5 className="font-semibold">Expires On</h5>
                    <p>{quote.quote_due_date ? new Date(quote.quote_due_date).toLocaleDateString() : 'N/A'}</p>
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
                    <button onClick={() => setIsRevising(true)} className="btn btn-secondary" disabled={handleActionMutation.isPending}>Request Revision</button>
                    <button onClick={() => handleActionMutation.mutate({ action: 'decline' })} className="btn btn-danger" disabled={handleActionMutation.isPending}>Decline</button>
                    <button onClick={() => handleActionMutation.mutate({ action: 'accept' })} className="btn btn-primary" disabled={handleActionMutation.isPending}>Accept Quote</button>
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
                        <button onClick={() => handleActionMutation.mutate({ action: 'revise', reason: revisionReason })} className="btn btn-primary" disabled={handleActionMutation.isPending}>
                            {handleActionMutation.isPending ? 'Submitting...' : 'Submit Request'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default QuoteProposalPage;
