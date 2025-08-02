import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useInView } from 'react-intersection-observer';
import { api } from '../../lib/api';
import { HTTPException } from 'hono/http-exception';
import type { JobWithDetails, JobStatus, LineItem } from '@portal/shared';
import NewAddJobModal from '../../components/modals/admin/NewAddJobModal';
import QuoteProposalModal from '../../components/modals/QuoteProposalModal';

// --- REPAIRED React Query Fetcher ---
// The queryFn now correctly gets the response and parses the JSON.
const fetchJobs = async ({ pageParam = 1, queryKey }: any) => {
  const [_key, filters] = queryKey;
  const res = await api.admin.jobs.$get({
    query: {
      page: pageParam.toString(),
      ...filters,
    },
  });
  if (!res.ok) {
    throw new Error('Failed to fetch jobs');
  }
  return await res.json();
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
    getNextPageParam: (lastPage: JobWithDetails[], allPages) => {
      // Assuming the API returns an array of jobs for each page.
      // If the last page has items, there might be a next page.
      return lastPage.length > 0 ? allPages.length + 1 : undefined;
    },
  });

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleApiError = async (err: any, defaultMessage: string) => {
    if (err instanceof HTTPException) {
        const errorJson = await err.response.json();
        setError(errorJson.error || defaultMessage);
    } else {
        setError(err.message || defaultMessage);
    }
  };

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
    } catch (err) {
      handleApiError(err, 'Import failed');
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
    } catch (err) {
        handleApiError(err, 'Import failed');
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
    } catch (err) {
      handleApiError(err, 'Failed to mark as paid');
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
    } catch (err) {
        handleApiError(err, 'Failed to decline quote');
    }
  };

  const handleReviseQuote = async (revisionReason: string) => {
      if (!selectedJob?.stripe_quote_id) return;
      try {
          await api.quotes[':quoteId'].revise.$post({ param: { quoteId: selectedJob.stripe_quote_id }, json: { revisionReason } });
          queryClient.invalidateQueries({ queryKey: ['adminJobs'] });
          setIsQuoteModalOpen(false);
      } catch (err) {
          handleApiError(err, 'Failed to revise quote');
      }
  };

  const handleAcceptQuote = async () => {
      if (!selectedJob?.stripe_quote_id) return;
      try {
          await api.quotes[':quoteId'].accept.$post({ param: { quoteId: selectedJob.stripe_quote_id } });
          queryClient.invalidateQueries({ queryKey: ['adminJobs'] });
          setIsQuoteModalOpen(false);
      } catch (err) {
          handleApiError(err, 'Failed to accept quote');
      }
  };

  const jobs = useMemo(() => data?.pages.flatMap(page => page) ?? [], [data]);
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
      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">{error}</div>}
      {importMessage && <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded relative" role="alert">{importMessage}</div>}

      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4 mb-6">
        <h5 className="mb-2 font-semibold">Data Import</h5>
        <div className="flex gap-4">
          <button className="btn btn-secondary" onClick={handleInvoiceImportClick} disabled={isImporting}>{isImporting ? 'Importing...' : 'Import Stripe Invoices'}</button>
          <button className="btn btn-secondary" onClick={handleQuoteImportClick} disabled={isImporting}>{isImporting ? 'Importing...' : 'Import Stripe Quotes'}</button>
          <div className="relative">
            <button className="btn btn-primary" onClick={() => setIsJobModalOpen(true)}>Add Job</button>
            <NewAddJobModal isOpen={isJobModalOpen} onClose={() => setIsJobModalOpen(false)} onSave={() => queryClient.invalidateQueries({ queryKey: ['adminJobs'] })} selectedDate={null} />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
        <div className="p-4 border-b dark:border-gray-700">
          <h5 className="mb-0 font-semibold">All Jobs and Quotes</h5>
        </div>
        <div className="p-4">
            <div className="flex items-center space-x-4 mb-4">
                <input type="text" placeholder="Search..." value={filters.search} onChange={e => setFilters({...filters, search: e.target.value})} className="form-input w-full md:w-1/3" />
                <select value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})} className="form-select">
                    <option value="">All Statuses</option>
                    {jobStatuses.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                </select>
            </div>
            {queryStatus === 'pending' ? <p>Loading jobs...</p> : queryStatus === 'error' ? <p>Error loading jobs: {queryError.message}</p> : (
              <div className="overflow-x-auto w-full">
                {selectedJob && (
                  <QuoteProposalModal isOpen={isQuoteModalOpen} onClose={() => setIsQuoteModalOpen(false)} onConfirm={handleAcceptQuote} onDecline={handleDeclineQuote} onRevise={handleReviseQuote} jobId={selectedJob.id} />
                )}
                <table className="w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th scope="col" className="w-12 px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"></th>
                      <th scope="col" className="w-1/4 px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Customer</th>
                      <th scope="col" className="w-1/3 px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Job/Quote Title</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Date</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Total Amount</th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {jobs.map((item) => (
                      <React.Fragment key={item.id}>
                        <tr className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer" onClick={() => toggleRow(item.id)}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            {(item.line_items || []).length > 0 && <span className="text-xl text-gray-500">{expandedRow === item.id ? '−' : '+'}</span>}
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">{item.customerName}</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">{item.customerAddress}</div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{item.title}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{new Date(item.createdAt || Date.now()).toLocaleDateString()}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusClass(item.status)}`}>{item.status.replace(/_/g, ' ')}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900 dark:text-white">${((item.total_amount_cents || 0) / 100).toFixed(2)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <Link to={`/admin/jobs/${item.id}`} className="btn btn-sm btn-secondary mr-2">View</Link>
                            {item.status === 'pending_quote' && <button onClick={(e) => { e.stopPropagation(); openQuoteModal(item); }} className="btn btn-sm btn-primary">Respond to Quote</button>}
                            {item.stripe_invoice_id && item.status !== 'paid' && item.status !== 'completed' && !item.status.includes('quote') && (
                              <button onClick={(e) => { e.stopPropagation(); handleMarkAsPaid(item.stripe_invoice_id!); }} className="btn btn-sm btn-success" disabled={isUpdating === item.stripe_invoice_id}>
                                {isUpdating === item.stripe_invoice_id ? 'Updating...' : 'Mark Paid'}
                              </button>
                            )}
                          </td>
                        </tr>
                        {expandedRow === item.id && (
                          <tr className="bg-gray-50 dark:bg-gray-900/50">
                            <td colSpan={7} className="px-6 py-4">
                              <div className="pl-8">
                                <h4 className="text-md font-semibold mb-2 text-gray-800 dark:text-gray-200">Line Items</h4>
                                {(item.line_items || []).length > 0 ? (
                                  <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
                                    <thead className="bg-gray-100 dark:bg-gray-700">
                                      <tr>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Description</th>
                                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Amount</th>
                                      </tr>
                                    </thead>
                                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                      {(item.line_items || []).map((line_item: LineItem) => (
                                        <tr key={line_item.id}>
                                          <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{line_item.description}</td>
                                          <td className="px-4 py-2 whitespace-nowrap text-right text-sm text-gray-900 dark:text-white">${((line_item.unit_total_amount_cents || 0) / 100).toFixed(2)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                ) : <p className="text-sm text-gray-500 dark:text-gray-400">No line items for this entry.</p>}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
                <div ref={ref} className="text-center p-4">
                  {isFetchingNextPage ? 'Loading more...' : hasNextPage ? 'Scroll to load more' : 'Nothing more to load.'}
                </div>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}

export default JobsPage;
