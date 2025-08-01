import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useInView } from 'react-intersection-observer';

// Import the new 'api' client.
import { api } from '../../lib/api';
import { ApiError } from '../../lib/fetchJson';
import type { JobWithDetails, LineItem, JobStatus } from '@portal/shared';
import NewAddJobModal from '../../components/modals/admin/NewAddJobModal';
import QuoteProposalModal from '../../components/modals/QuoteProposalModal';

// --- RPC Fetcher for React Query ---
const fetchJobs = async ({ pageParam = 1, queryKey }: any) => {
  const [_key, filters] = queryKey;
  const res = await api.admin.jobs.$get({
    query: {
      page: pageParam.toString(),
      ...filters,
    },
  });
  if (!res.ok) throw new Error('Failed to fetch jobs');
  return res.json();
};

const allJobStatuses: JobStatus[] = [
    'pending', 'upcoming', 'payment_needed', 'payment_overdue', 'complete',
    'canceled', 'quote_draft', 'invoice_draft', 'job_draft'
];
const jobStatuses = [...new Set(allJobStatuses)];

function JobsPage() {
  const [isImporting, setIsImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<JobWithDetails | null>(null);
  const [filters, setFilters] = useState({ status: '', search: '' });

  const queryClient = useQueryClient();
  const { ref, inView } = useInView();

  const {
    data,
    error: queryError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status: queryStatus,
  } = useInfiniteQuery({
    queryKey: ['adminJobs', filters],
    queryFn: fetchJobs,
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      // Assuming the API returns an empty array when there are no more results
      return lastPage.length > 0 ? allPages.length + 1 : undefined;
    },
  });

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // --- UPDATED Handlers ---
  const handleInvoiceImportClick = async () => {
    if (!window.confirm("This will import paid Stripe invoices as jobs. Continue?")) return;
    setIsImporting(true);
    setImportMessage(null);
    setError(null);
    try {
      const res = await api.admin.invoices.import.$post({});
      const result = await res.json();
      setImportMessage(`Invoice import complete! ${result.imported} created, ${result.skipped} skipped.`);
      queryClient.invalidateQueries({ queryKey: ['adminJobs'] });
    } catch (err: any) {
      setError(`Import failed: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  const handleQuoteImportClick = async () => {
    if (!window.confirm("This will import accepted Stripe quotes as jobs. Continue?")) return;
    setIsImporting(true);
    setImportMessage(null);
    setError(null);
    try {
        const res = await api.admin.quotes.import.$post({});
        const result = await res.json();
        setImportMessage(`Quote import complete! ${result.imported} imported, ${result.skipped} skipped.`);
        queryClient.invalidateQueries({ queryKey: ['adminJobs'] });
    } catch (err: any) {
        setError(`Import failed: ${err.message}`);
    } finally {
        setIsImporting(false);
    }
  };

  const handleMarkAsPaid = async (invoiceId: string) => {
    if (!invoiceId || !window.confirm('Are you sure?')) return;
    setIsUpdating(invoiceId);
    try {
      await api.admin.invoices[':invoiceId']['mark-as-paid'].$post({ param: { invoiceId } });
      queryClient.invalidateQueries({ queryKey: ['adminJobs'] });
    } catch (error: any) {
      alert(`Failed to mark as paid: ${error.message}`);
    } finally {
      setIsUpdating(null);
    }
  };

  const handleDeclineQuote = async () => {
    if (!selectedJob?.stripe_quote_id) return;
    try {
        await api.quotes[':quoteId'].decline.$post({ param: { quoteId: selectedJob.stripe_quote_id } });
        queryClient.invalidateQueries({ queryKey: ['adminJobs'] });
        setIsQuoteModalOpen(false);
    } catch (err: any) {
        alert(`Failed to decline quote: ${err.message}`);
    }
  };

  const handleReviseQuote = async (revisionReason: string) => {
      if (!selectedJob?.stripe_quote_id) return;
      try {
          await api.quotes[':quoteId'].revise.$post({ param: { quoteId: selectedJob.stripe_quote_id }, json: { revisionReason } });
          queryClient.invalidateQueries({ queryKey: ['adminJobs'] });
          setIsQuoteModalOpen(false);
      } catch (err: any) {
          alert(`Failed to revise quote: ${err.message}`);
      }
  };

  const handleAcceptQuote = async () => {
      if (!selectedJob?.stripe_quote_id) return;
      try {
          await api.quotes[':quoteId'].accept.$post({ param: { quoteId: selectedJob.stripe_quote_id } });
          queryClient.invalidateQueries({ queryKey: ['adminJobs'] });
          setIsQuoteModalOpen(false);
      } catch (err: any) {
          alert(`Failed to accept quote: ${err.message}`);
      }
  };

  const jobsData = useMemo(() => data?.pages.flatMap(page => page) ?? [], [data]);
  const toggleRow = (id: string) => setExpandedRow(expandedRow === id ? null : id);
  const openQuoteModal = (job: JobWithDetails) => {
    setSelectedJob(job);
    setIsQuoteModalOpen(true);
  };
  const getStatusClass = (status: string) => {
    if (status.includes('quote')) return 'bg-purple-100 text-purple-800';
    if (status.includes('pending') || status === 'open' || status === 'upcoming') return 'bg-yellow-100 text-yellow-800';
    if (status === 'paid' || status === 'completed' || status === 'complete') return 'bg-green-100 text-green-800';
    if (status === 'past_due' || status === 'payment_overdue') return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="w-full p-4">
      <h1 className="text-2xl font-bold mb-4">Jobs</h1>
      {(error || queryError) && <div className="alert alert-danger">{error || (queryError as Error).message}</div>}
      {importMessage && <div className="alert alert-info">{importMessage}</div>}

      <div className="card">
        <div className="card-header"><h5 className="mb-0">Data Management</h5></div>
        <div className="card-body flex gap-4">
          <button className="btn btn-secondary" onClick={handleInvoiceImportClick} disabled={isImporting}>{isImporting ? 'Importing...' : 'Import Stripe Invoices'}</button>
          <button className="btn btn-secondary" onClick={handleQuoteImportClick} disabled={isImporting}>{isImporting ? 'Importing...' : 'Import Stripe Quotes'}</button>
          <div className="relative">
            <button className="btn btn-primary" onClick={() => setIsJobModalOpen(true)}>Add Job</button>
            <NewAddJobModal isOpen={isJobModalOpen} onClose={() => setIsJobModalOpen(false)} onSave={() => queryClient.invalidateQueries({ queryKey: ['adminJobs'] })} selectedDate={null} />
          </div>
        </div>
      </div>

      <div className="card mt-6">
        <div className="card-header"><h5 className="mb-0">All Jobs and Quotes</h5></div>
        <div className="card-body">
            <div className="flex items-center space-x-4 mb-4">
                <input
                    type="text"
                    placeholder="Search by job or client..."
                    value={filters.search}
                    onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                    className="form-control w-full max-w-xs"
                />
                <select
                    value={filters.status}
                    onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                    className="form-control"
                >
                    <option value="">All Statuses</option>
                    {jobStatuses.map(status => (
                        <option key={status} value={status}>
                            {status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </option>
                    ))}
                </select>
            </div>

            {queryStatus === 'pending' ? <p>Loading data...</p> : (
              <div className="overflow-x-auto w-full">
                {selectedJob && (
                  <QuoteProposalModal isOpen={isQuoteModalOpen} onClose={() => setIsQuoteModalOpen(false)} onConfirm={handleAcceptQuote} onDecline={handleDeclineQuote} onRevise={handleReviseQuote} jobId={selectedJob.id} />
                )}
                <table className="w-full divide-y divide-border-light dark:divide-border-dark">
                  <thead className="bg-secondary-light dark:bg-secondary-dark">
                    <tr>
                      <th scope="col" className="w-12 px-6 py-3"></th>
                      <th scope="col" className="w-1/4 px-6 py-3 text-left text-xs font-medium uppercase">Customer</th>
                      <th scope="col" className="w-1/3 px-6 py-3 text-left text-xs font-medium uppercase">Job/Quote Title</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase">Date</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase">Status</th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium uppercase">Total</th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-primary-light dark:bg-tertiary-dark divide-y divide-border-light dark:divide-border-dark">
                    {jobsData.map((item) => (
                      <React.Fragment key={item.id}>
                        <tr className="hover:bg-secondary-light/50 dark:hover:bg-secondary-dark/50 cursor-pointer" onClick={() => toggleRow(item.id)}>
                          <td className="px-6 py-4">
                            {(item.line_items || []).length > 0 && <span className="text-xl">{expandedRow === item.id ? '−' : '+'}</span>}
                          </td>
                          <td className="px-6 py-4">
                            <div>{item.customerName}</div>
                            <div className="text-sm text-gray-500">{item.customerAddress}</div>
                          </td>
                          <td className="px-6 py-4">{item.title}</td>
                          <td className="px-6 py-4">{new Date(item.createdAt || Date.now()).toLocaleDateString()}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusClass(item.status)}`}>{item.status.replace(/_/g, ' ')}</span>
                          </td>
                          <td className="px-6 py-4 text-right">${((item.total_amount_cents || 0) / 100).toFixed(2)}</td>
                          <td className="px-6 py-4 text-right">
                            <Link to={`/admin/jobs/${item.id}`} className="btn btn-sm btn-secondary mr-2">View</Link>
                            {item.status === 'pending_quote' && <button onClick={(e) => { e.stopPropagation(); openQuoteModal(item); }} className="btn btn-sm btn-primary">Respond</button>}
                            {item.stripe_invoice_id && item.status === 'payment_needed' && (
                              <button onClick={(e) => { e.stopPropagation(); handleMarkAsPaid(item.stripe_invoice_id!); }} className="btn btn-sm btn-success" disabled={isUpdating === item.stripe_invoice_id}>
                                {isUpdating === item.stripe_invoice_id ? '...' : 'Mark Paid'}
                              </button>
                            )}
                          </td>
                        </tr>
                        {expandedRow === item.id && (
                          <tr className="bg-gray-50 dark:bg-black/20">
                            <td colSpan={7} className="px-6 py-4">
                              <div className="pl-8">
                                <h4 className="text-md font-semibold mb-2">Line Items</h4>
                                {(item.line_items || []).length > 0 ? (
                                  <table className="min-w-full">
                                    {/* ... table content ... */}
                                  </table>
                                ) : <p>No line items for this entry.</p>}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
                <div ref={ref} className="flex justify-center items-center h-16">
                    {isFetchingNextPage ? 'Loading more...' : hasNextPage ? 'Scroll to load more' : 'End of list.'}
                </div>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}

export default JobsPage;
