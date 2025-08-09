import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { adminImportInvoices, adminImportQuotes, adminGetAllJobDetails, markInvoiceAsPaid, apiPost } from '../../lib/api';
import type { JobWithDetails, LineItem, JobStatus } from '@portal/shared';
import AddJobModal from '../../admin/modals/AddJobModal';
import QuoteProposalModal from '../../components/modals/QuoteProposalModal';

function JobsPage() {
  const [isImporting, setIsImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jobsData, setJobsData] = useState<JobWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<JobWithDetails | null>(null);
  const [filter, setFilter] = useState('all');

  const fetchJobsData = async () => {
    setIsLoading(true);
    try {
      const data = await adminGetAllJobDetails();
      setJobsData(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchJobsData();
  }, []);

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
    } catch (err: any) {
        setError(`Import failed: ${err.message}`);
    } finally {
        setIsImporting(false);
    }
  };

  const filteredData = useMemo(() => {
    if (filter === 'all') return jobsData;
    return jobsData.filter(item => {
      if (filter === 'drafts') return item.status === 'quote_draft' || item.status === 'invoice_draft' || item.status === 'job_draft';
      if (filter === 'invoices') return item.stripe_invoice_id != null;
      if (filter === 'quotes') return item.stripe_quote_id != null && item.status !== 'quote_draft';
      if (filter === 'upcoming') return item.status === 'upcoming' || item.status === 'confirmed';
      return true;
    });
  }, [jobsData, filter]);

  const toggleRow = (id: string) => setExpandedRow(expandedRow === id ? null : id);

  const handleMarkAsPaid = async (invoiceId: string) => {
    if (!invoiceId || !window.confirm('Are you sure you want to mark this invoice as paid?')) return;
    setIsUpdating(invoiceId);
    try {
      await markInvoiceAsPaid(invoiceId);
      fetchJobsData();
    } catch (error: any) {
      alert(`Failed to mark as paid: ${error.message}`);
    } finally {
      setIsUpdating(null);
    }
  };

  const handleDeclineQuote = async () => {
    if (!selectedJob?.stripe_quote_id) return;
    try {
        await apiPost(`/api/quotes/${selectedJob.stripe_quote_id}/decline`, {});
        fetchJobsData();
        setIsQuoteModalOpen(false);
    } catch (err: any) {
        alert(`Failed to decline quote: ${err.message}`);
    }
  };

  const handleReviseQuote = async (revisionReason: string) => {
      if (!selectedJob?.stripe_quote_id) return;
      try {
          await apiPost(`/api/quotes/${selectedJob.stripe_quote_id}/revise`, { revisionReason });
          fetchJobsData();
          setIsQuoteModalOpen(false);
      } catch (err: any) {
          alert(`Failed to revise quote: ${err.message}`);
      }
  };

  const handleAcceptQuote = async () => {
      if (!selectedJob?.stripe_quote_id) return;
      try {
          await apiPost(`/api/quotes/${selectedJob.stripe_quote_id}/accept`, {});
          fetchJobsData();
          setIsQuoteModalOpen(false);
      } catch (err: any) {
          alert(`Failed to accept quote: ${err.message}`);
      }
  };

  const openQuoteModal = (job: JobWithDetails) => {
    setSelectedJob(job);
    setIsQuoteModalOpen(true);
  };

  // UPDATED: More specific status class handling to match JobDetail.tsx
  const getStatusClass = (status: JobStatus | 'quote_sent' | string): string => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'upcoming':
        return 'bg-blue-100 text-blue-800';
      case 'payment_needed':
        return 'bg-orange-100 text-orange-800';
      case 'payment_overdue':
        return 'bg-red-100 text-red-800';
      case 'complete':
      case 'paid': // legacy support
        return 'bg-green-100 text-green-800';
      case 'quote_draft':
      case 'quote_sent': // legacy support
        return 'bg-purple-100 text-purple-800';
      case 'invoice_draft':
        return 'bg-indigo-100 text-indigo-800';
      case 'canceled':
      case 'job_draft':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // ADDED: Helper function to format status text for display
  const formatStatus = (status: string): string => {
    if (!status) return '';
    return status
      .replace(/_/g, ' ')
      .replace(/\b\w/g, char => char.toUpperCase());
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
            <AddJobModal isOpen={isJobModalOpen} onClose={() => setIsJobModalOpen(false)} onSave={fetchJobsData} selectedDate={null} />
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
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusClass(item.status)}`}>{formatStatus(item.status)}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-text-primary-light dark:text-text-primary-dark">${((item.total_amount_cents || 0) / 100).toFixed(2)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <Link to={`/admin/jobs/${item.id}`} className="btn btn-sm btn-secondary mr-2">View</Link>
                            {item.status === 'pending_quote' && <button onClick={() => openQuoteModal(item)} className="btn btn-sm btn-primary">Respond to Quote</button>}
                            {item.stripe_invoice_id && item.status === 'payment_needed' && (
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
