import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
// Import the new hooks and query client
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useInView } from 'react-intersection-observer';

// --- FIXED: Corrected import statement to match your project structure ---
import { adminImportInvoices, adminImportQuotes, adminGetJobsAndQuotes, markInvoiceAsPaid, apiPost } from '../../lib/api';
import type { JobWithDetails, LineItem, JobStatus } from '@portal/shared';
import NewAddJobModal from '../../components/modals/admin/NewAddJobModal';
import QuoteProposalModal from '../../components/modals/QuoteProposalModal';

// --- FIXED: Rewrote fetchJobs to use standard fetch instead of the non-existent 'api' client ---
const fetchJobs = async ({ pageParam = 1, filters }) => {
  const params = new URLSearchParams({
    page: pageParam.toString(),
  });
  if (filters.status) {
    params.append('status', filters.status);
  }
  if (filters.search) {
    params.append('search', filters.search);
  }

  // Assuming cookie-based auth, call the endpoint for the paginated/filtered route directly.
  const res = await fetch(`/api/admin/jobs?${params.toString()}`);

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Failed to fetch jobs: ${res.statusText} - ${errorBody}`);
  }
  const data = await res.json();
  // Assuming the API wrapper returns data in a { success: boolean, data: any } structure
  return data.data || [];
};


// --- NEW: List of statuses for the filter dropdown ---
const allJobStatuses: JobStatus[] = [
    'pending', 'upcoming', 'payment_needed', 'payment_overdue', 'complete',
    'canceled', 'quote_draft', 'invoice_draft', 'job_draft', 'pending_quote', 'open', 'paid', 'past_due'
];
// Create a unique set of statuses
const jobStatuses = [...new Set(allJobStatuses)];


function JobsPage() {
  // --- All original state is kept ---
  const [isImporting, setIsImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<JobWithDetails | null>(null);

  // --- REPLACED: Old client-side filter is replaced with new server-side filter state ---
  const [filters, setFilters] = useState({ status: '', search: '' });

  // --- NEW: React Query and Intersection Observer hooks ---
  const queryClient = useQueryClient();
  const { ref, inView } = useInView();

  const {
    data,
    error: queryError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status: queryStatus, // Renamed to avoid conflict with 'status' property on jobs
  } = useInfiniteQuery({
    queryKey: ['adminJobs', filters], // Query is re-run when filters change
    queryFn: ({ pageParam }) => fetchJobs({ pageParam, filters }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.length > 0 ? allPages.length + 1 : undefined;
    },
  });

  // --- NEW: Effect for infinite scroll ---
  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // --- UPDATED: Import handlers now invalidate the query cache to refresh data ---
  const handleInvoiceImportClick = async () => {
    if (!window.confirm("This will import paid Stripe invoices as jobs. This may take a moment. Continue?")) {
      return;
    }
    setIsImporting(true);
    setImportMessage(null);
    setError(null);
    try {
      const result = await adminImportInvoices();
      let messageText = `Invoice import complete! ${result.imported} jobs created, ${result.skipped} skipped.`;
      if (result.errors && result.errors.length > 0) {
        messageText += ` Errors: ${result.errors.join(', ')}`;
      }
      setImportMessage(messageText);
      queryClient.invalidateQueries({ queryKey: ['adminJobs'] }); // Invalidate and refetch
    } catch (err: any) {
      setError(`Import failed: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  const handleQuoteImportClick = async () => {
    if (!window.confirm("This will import accepted Stripe quotes as jobs. This may take a moment. Continue?")) {
        return;
    }
    setIsImporting(true);
    setImportMessage(null);
    setError(null);
    try {
        const result = await adminImportQuotes();
        let messageText = `Quote import complete! ${result.imported} quotes imported, ${result.skipped} skipped.`;
        if (result.errors && result.errors.length > 0) {
            messageText += ` Errors: ${result.errors.join(', ')}`;
        }
        setImportMessage(messageText);
        queryClient.invalidateQueries({ queryKey: ['adminJobs'] }); // Invalidate and refetch
    } catch (err: any) {
        setError(`Import failed: ${err.message}`);
    } finally {
        setIsImporting(false);
    }
  };

  // --- NEW: Combined data from all pages ---
  const jobsData = useMemo(() => data?.pages.flatMap(page => page) ?? [], [data]);

  const toggleRow = (id: string) => setExpandedRow(expandedRow === id ? null : id);

  // --- UPDATED: Mark as paid now invalidates query cache ---
  const handleMarkAsPaid = async (invoiceId: string) => {
    if (!invoiceId || !window.confirm('Are you sure you want to mark this invoice as paid?')) return;
    setIsUpdating(invoiceId);
    try {
      await markInvoiceAsPaid(invoiceId);
      queryClient.invalidateQueries({ queryKey: ['adminJobs'] }); // Invalidate and refetch
    } catch (error: any) {
      alert(`Failed to mark as paid: ${error.message}`);
    } finally {
      setIsUpdating(null);
    }
  };

  // --- All other handlers are kept as they were ---
  const handleDeclineQuote = async () => {
    if (!selectedJob?.stripe_quote_id) return;
    try {
        await apiPost(`/api/quotes/${selectedJob.stripe_quote_id}/decline`, {});
        queryClient.invalidateQueries({ queryKey: ['adminJobs'] });
        setIsQuoteModalOpen(false);
    } catch (err: any) {
        alert(`Failed to decline quote: ${err.message}`);
    }
  };

  const handleReviseQuote = async (revisionReason: string) => {
      if (!selectedJob?.stripe_quote_id) return;
      try {
          await apiPost(`/api/quotes/${selectedJob.stripe_quote_id}/revise`, { revisionReason });
          queryClient.invalidateQueries({ queryKey: ['adminJobs'] });
          setIsQuoteModalOpen(false);
      } catch (err: any) {
          alert(`Failed to revise quote: ${err.message}`);
      }
  };

  const handleAcceptQuote = async () => {
      if (!selectedJob?.stripe_quote_id) return;
      try {
          await apiPost(`/api/quotes/${selectedJob.stripe_quote_id}/accept`, {});
          queryClient.invalidateQueries({ queryKey: ['adminJobs'] });
          setIsQuoteModalOpen(false);
      } catch (err: any) {
          alert(`Failed to accept quote: ${err.message}`);
      }
  };

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
      {/* Display errors from either source */}
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
            {/* --- REPLACED: Old filter buttons are replaced with new controls --- */}
            <div className="flex items-center space-x-4 mb-4">
                <input
                    type="text"
                    placeholder="Search by job or client..."
                    value={filters.search}
                    onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                    className="input input-bordered w-full max-w-xs"
                />
                <select
                    value={filters.status}
                    onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                    className="select select-bordered"
                >
                    <option value="">All Statuses</option>
                    {jobStatuses.map(status => (
                        <option key={status} value={status}>
                            {status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </option>
                    ))}
                </select>
            </div>

            {/* --- UPDATED: Loading state check --- */}
            {queryStatus === 'pending' ? <p>Loading data...</p> : (
              <div className="overflow-x-auto w-full">
                {selectedJob && (
                  <QuoteProposalModal isOpen={isQuoteModalOpen} onClose={() => setIsQuoteModalOpen(false)} onConfirm={handleAcceptQuote} onDecline={handleDeclineQuote} onRevise={handleReviseQuote} jobId={selectedJob.id} />
                )}
                <table className="w-full divide-y divide-border-light dark:divide-border-dark">
                  <thead className="bg-secondary-light dark:bg-secondary-dark">
                    <tr>
                      <th scope="col" className="w-12 px-6 py-3 text-left text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wider"></th>
                      <th scope="col" className="w-1/4 px-6 py-3 text-left text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wider">Customer</th>
                      <th scope="col" className="w-1/3 px-6 py-3 text-left text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wider">Job/Quote Title</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wider">Date</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wider">Status</th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wider">Total Amount</th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  {/* --- UPDATED: Map over new `jobsData` from useInfiniteQuery --- */}
                  <tbody className="bg-primary-light dark:bg-tertiary-dark divide-y divide-border-light dark:divide-border-dark">
                    {jobsData.map((item) => (
                      <React.Fragment key={item.id}>
                        <tr className="hover:bg-secondary-light/50 dark:hover:bg-secondary-dark/50 cursor-pointer" onClick={() => toggleRow(item.id)}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            {(item.line_items || []).length > 0 && <span className="text-xl text-text-secondary-light dark:text-text-secondary-dark">{expandedRow === item.id ? '−' : '+'}</span>}
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">{item.customerName}</div>
                            <div className="text-sm text-text-secondary-light dark:text-text-secondary-dark">{item.customerAddress}</div>
                          </td>
                          <td className="px-6 py-4 text-sm text-text-primary-light dark:text-text-primary-dark">{item.title}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary-light dark:text-text-secondary-dark">{new Date(item.createdAt || Date.now()).toLocaleDateString()}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusClass(item.status)}`}>{item.status.replace(/_/g, ' ')}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-text-primary-light dark:text-text-primary-dark">${((item.total_amount_cents || 0) / 100).toFixed(2)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <Link to={`/admin/jobs/${item.id}`} className="btn btn-sm btn-secondary mr-2">View</Link>
                            {item.status === 'pending_quote' && <button onClick={(e) => { e.stopPropagation(); openQuoteModal(item); }} className="btn btn-sm btn-primary">Respond to Quote</button>}
                            {item.stripe_invoice_id && item.status === 'payment_needed' && (
                              <button onClick={(e) => { e.stopPropagation(); handleMarkAsPaid(item.stripe_invoice_id!); }} className="btn btn-sm btn-success" disabled={isUpdating === item.stripe_invoice_id}>
                                {isUpdating === item.stripe_invoice_id ? 'Updating...' : 'Mark Paid'}
                              </button>
                            )}
                          </td>
                        </tr>
                        {expandedRow === item.id && (
                          <tr className="bg-gray-50 dark:bg-black/20">
                            <td colSpan={7} className="px-6 py-4">
                              <div className="pl-8">
                                <h4 className="text-md font-semibold mb-2 text-text-primary-light dark:text-text-primary-dark">Line Items</h4>
                                {(item.line_items || []).length > 0 ? (
                                  <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
                                    <thead className="bg-gray-100 dark:bg-secondary-dark">
                                      <tr>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wider">Description</th>
                                        <th className="px-4 py-2 text-right text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wider">Amount</th>
                                      </tr>
                                    </thead>
                                    <tbody className="bg-white dark:bg-tertiary-dark divide-y divide-gray-200 dark:divide-border-dark">
                                      {(item.line_items || []).map((line_item: LineItem) => (
                                        <tr key={line_item.id}>
                                          <td className="px-4 py-2 whitespace-nowrap text-sm text-text-secondary-light dark:text-text-secondary-dark">{line_item.description}</td>
                                          <td className="px-4 py-2 whitespace-nowrap text-right text-sm text-text-primary-light dark:text-text-primary-dark">${((line_item.unit_total_amount_cents || 0) / 100).toFixed(2)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                ) : <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">No line items for this entry.</p>}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
                {/* --- NEW: Infinite scroll trigger and status message --- */}
                <div ref={ref} className="flex justify-center items-center h-16">
                    {isFetchingNextPage
                        ? 'Loading more jobs...'
                        : hasNextPage
                        ? 'Scroll to load more'
                        : jobsData.length > 0
                        ? 'You have reached the end of the list.'
                        : 'No jobs found for the selected filters.'
                    }
                </div>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}

export default JobsPage;
