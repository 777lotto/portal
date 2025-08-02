import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useInView } from 'react-intersection-observer';
import { api } from '../../lib/api';
import { HTTPError } from 'hono/client';
import type { JobWithDetails, JobStatus } from '@portal/shared';
import NewAddJobModal from '../../components/modals/admin/NewAddJobModal';
import QuoteProposalModal from '../../components/modals/QuoteProposalModal';

// --- REFACTORED React Query Fetcher ---
// The queryFn now directly calls the api client.
const fetchJobs = ({ pageParam = 1, queryKey }: any) => {
  const [_key, filters] = queryKey;
  return api.admin.jobs.$get({
    query: {
      page: pageParam.toString(),
      ...filters,
    },
  });
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
      return lastPage.length > 0 ? allPages.length + 1 : undefined;
    },
  });

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleApiError = async (err: any, defaultMessage: string) => {
    if (err instanceof HTTPError) {
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
      const result = await api.admin.invoices.import.$post({});
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
        const result = await api.admin.quotes.import.$post({});
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

  // Handlers for Quote Modal
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
      {error && <div className="alert alert-danger">{error}</div>}
      {importMessage && <div className="alert alert-info">{importMessage}</div>}

      <div className="card">
        <div className="card-header"><h5 className="mb-0">Data Import</h5></div>
        <div className="card-body flex gap-4">
          <button className="btn btn-secondary" onClick={handleInvoiceImportClick} disabled={isImporting}>{isImporting ? 'Importing...' : 'Import Stripe Invoices'}</button>
          <button className="btn btn-secondary" onClick={handleQuoteImportClick} disabled={isImporting}>{isImporting ? 'Importing...' : 'Import Stripe Quotes'}</button>
          <div className="relative">
            <button className="btn btn-primary" onClick={() => setIsJobModalOpen(true)}>Add Job</button>
            <NewAddJobModal isOpen={isJobModalOpen} onClose={() => setIsJobModalOpen(false)} onSave={fetchJobsData} selectedDate={null} />
          </div>
        </div>
      </div>

      <div className="card mt-6">
        <div className="card-header"><h5 className="mb-0">All Jobs and Quotes</h5></div>
        <div className="card-body">
            {isLoading ? <p>Loading data...</p> : (
              <div className="overflow-x-auto w-full">
                <div className="flex space-x-2 mb-4">
                  <button onClick={() => setFilter('all')} className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}>All</button>
                  <button onClick={() => setFilter('drafts')} className={`btn ${filter === 'drafts' ? 'btn-primary' : 'btn-secondary'}`}>Drafts</button>
                  <button onClick={() => setFilter('invoices')} className={`btn ${filter === 'invoices' ? 'btn-primary' : 'btn-secondary'}`}>Invoices</button>
                  <button onClick={() => setFilter('quotes')} className={`btn ${filter === 'quotes' ? 'btn-primary' : 'btn-secondary'}`}>Quotes</button>
                  <button onClick={() => setFilter('upcoming')} className={`btn ${filter === 'upcoming' ? 'btn-primary' : 'btn-secondary'}`}>Upcoming</button>
                </div>
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
                  <tbody className="bg-primary-light dark:bg-tertiary-dark divide-y divide-border-light dark:divide-border-dark">
                    {filteredData.map((item) => (
                      <>
                        <tr key={item.id} className="hover:bg-secondary-light/50 dark:hover:bg-secondary-dark/50 cursor-pointer" onClick={() => toggleRow(item.id)}>
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
                            {item.status === 'pending_quote' && <button onClick={() => openQuoteModal(item)} className="btn btn-sm btn-primary">Respond to Quote</button>}
                            {item.stripe_invoice_id && item.status !== 'paid' && item.status !== 'completed' && !item.status.includes('quote') && (
                              <button onClick={() => handleMarkAsPaid(item.stripe_invoice_id!)} className="btn btn-sm btn-success" disabled={isUpdating === item.stripe_invoice_id}>
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
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}

export default JobsPage;
