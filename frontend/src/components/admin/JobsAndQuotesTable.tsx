import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { JobWithDetails, Service } from '@portal/shared';
import { markInvoiceAsPaid, apiPost } from '../../lib/api';
import QuoteProposalModal from '../QuoteProposalModal';

interface Props {
  data: JobWithDetails[];
  onUpdate: () => void;
}

function JobsAndQuotesTable({ data, onUpdate }: Props) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<JobWithDetails | null>(null);
  const [filter, setFilter] = useState('all'); // 'all', 'drafts', 'invoices', 'quotes', 'upcoming'

  const filteredData = useMemo(() => {
    if (filter === 'all') {
      return data;
    }
    return data.filter(item => {
      if (filter === 'drafts') {
        return item.status === 'quote_draft' || item.status === 'invoice_draft';
      }
      if (filter === 'invoices') {
        return item.stripe_invoice_id != null;
      }
      if (filter === 'quotes') {
        return item.stripe_quote_id != null && item.status !== 'quote_draft';
      }
      if (filter === 'upcoming') {
        return item.status === 'upcoming' || item.status === 'confirmed';
      }
      return true;
    });
  }, [data, filter]);

  const toggleRow = (id: string) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  const handleMarkAsPaid = async (invoiceId: string) => {
    if (!invoiceId) {
        alert('This job does not have an invoice to mark as paid.');
        return;
    }
    if (!window.confirm('Are you sure you want to mark this invoice as paid?')) {
      return;
    }
    setIsUpdating(invoiceId);
    try {
      await markInvoiceAsPaid(invoiceId);
      onUpdate(); // Refresh the data
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
        onUpdate();
        setIsQuoteModalOpen(false);
    } catch (err: any) {
        alert(`Failed to decline quote: ${err.message}`);
    }
  };

  const handleReviseQuote = async (revisionReason: string) => {
      if (!selectedJob?.stripe_quote_id) return;
      try {
          await apiPost(`/api/quotes/${selectedJob.stripe_quote_id}/revise`, { revisionReason });
          onUpdate();
          setIsQuoteModalOpen(false);
      } catch (err: any) {
          alert(`Failed to revise quote: ${err.message}`);
      }
  };

  const handleAcceptQuote = async () => {
      if (!selectedJob?.stripe_quote_id) return;
      try {
          await apiPost(`/api/quotes/${selectedJob.stripe_quote_id}/accept`, {});
          onUpdate();
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
    if (status.includes('pending') || status === 'open') return 'bg-yellow-100 text-yellow-800';
    if (status === 'paid' || status === 'completed') return 'bg-green-100 text-green-800';
    if (status === 'past_due') return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="overflow-x-auto w-full">
      <div className="flex space-x-2 mb-4">
        <button onClick={() => setFilter('all')} className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}>All</button>
        <button onClick={() => setFilter('drafts')} className={`btn ${filter === 'drafts' ? 'btn-primary' : 'btn-secondary'}`}>Drafts</button>
        <button onClick={() => setFilter('invoices')} className={`btn ${filter === 'invoices' ? 'btn-primary' : 'btn-secondary'}`}>Invoices</button>
        <button onClick={() => setFilter('quotes')} className={`btn ${filter === 'quotes' ? 'btn-primary' : 'btn-secondary'}`}>Quotes</button>
        <button onClick={() => setFilter('upcoming')} className={`btn ${filter === 'upcoming' ? 'btn-primary' : 'btn-secondary'}`}>Upcoming</button>
      </div>
      {selectedJob && (
        <QuoteProposalModal
            isOpen={isQuoteModalOpen}
            onClose={() => setIsQuoteModalOpen(false)}
            onConfirm={handleAcceptQuote}
            onDecline={handleDeclineQuote}
            onRevise={handleReviseQuote}
            jobId={selectedJob.id}
        />
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
                  {item.services.length > 0 && (
                    <span className="text-xl text-text-secondary-light dark:text-text-secondary-dark">{expandedRow === item.id ? '−' : '+'}</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">{item.customerName}</div>
                  <div className="text-sm text-text-secondary-light dark:text-text-secondary-dark">{item.customerAddress}</div>
                </td>
                <td className="px-6 py-4 text-sm text-text-primary-light dark:text-text-primary-dark">{item.title}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary-light dark:text-text-secondary-dark">{new Date(item.createdAt || Date.now()).toLocaleDateString()}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusClass(item.status)}`}>
                    {item.status.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
                  ${((item.total_amount_cents || 0) / 100).toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <Link to={`/admin/jobs/${item.id}`} className="btn btn-sm btn-secondary mr-2">
                    View
                  </Link>
                  {item.status === 'pending_quote' && (
                    <button
                      onClick={() => openQuoteModal(item)}
                      className="btn btn-sm btn-primary"
                    >
                      Respond to Quote
                    </button>
                  )}
                  {item.stripe_invoice_id && item.status !== 'paid' && item.status !== 'completed' && !item.status.includes('quote') && (
                    <button
                      onClick={() => handleMarkAsPaid(item.stripe_invoice_id as string)}
                      className="btn btn-sm btn-success"
                      disabled={isUpdating === item.stripe_invoice_id}
                    >
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
                      {item.services.length > 0 ? (
                        <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
                           <thead className="bg-gray-100 dark:bg-secondary-dark">
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wider">Description</th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wider">Amount</th>
                              </tr>
                           </thead>
                           <tbody className="bg-white dark:bg-tertiary-dark divide-y divide-gray-200 dark:divide-border-dark">
                              {item.services.map((service: Service) => (
                                <tr key={service.id}>
                                  <td className="px-4 py-2 whitespace-nowrap text-sm text-text-secondary-light dark:text-text-secondary-dark">{service.notes}</td>
                                  <td className="px-4 py-2 whitespace-nowrap text-right text-sm text-text-primary-light dark:text-text-primary-dark">${((service.price_cents || 0) / 100).toFixed(2)}</td>
                                </tr>
                              ))}
                           </tbody>
                        </table>
                      ) : (
                        <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">No line items for this entry.</p>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default JobsAndQuotesTable;
