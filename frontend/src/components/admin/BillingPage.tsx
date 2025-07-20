// 777lotto/portal/portal-fold/frontend/src/components/admin/BillingPage.tsx
import { useState, useEffect } from 'react';
import { adminImportInvoices, adminImportQuotes, adminGetJobsAndQuotes } from '../../lib/api';
import JobsAndQuotesTable from './JobsAndQuotesTable';
import type { JobWithDetails } from '@portal/shared';

function BillingPage() {
  const [isImporting, setIsImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [billingData, setBillingData] = useState<JobWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBillingData = async () => {
    setIsLoading(true);
    try {
      const data = await adminGetJobsAndQuotes();
      setBillingData(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBillingData();
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

  return (
    <div className="max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Billing</h1>
      {error && <div className="alert alert-danger">{error}</div>}
      {importMessage && <div className="alert alert-info">{importMessage}</div>}

      <div className="card">
        <div className="card-header">
          <h5 className="mb-0">Data Import</h5>
        </div>
        <div className="card-body flex gap-4">
          <button
            className="btn btn-secondary"
            onClick={handleInvoiceImportClick}
            disabled={isImporting}
          >
            {isImporting ? 'Importing...' : 'Import Stripe Invoices'}
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleQuoteImportClick}
            disabled={isImporting}
          >
            {isImporting ? 'Importing...' : 'Import Stripe Quotes'}
          </button>
        </div>
      </div>

      <div className="card mt-6">
        <div className="card-header">
            <h5 className="mb-0">All Jobs and Quotes</h5>
        </div>
        <div className="card-body">
            {isLoading ? (
                <p>Loading data...</p>
            ) : (
                <JobsAndQuotesTable data={billingData} />
            )}
        </div>
      </div>
    </div>
  );
}

export default BillingPage;
