// 777lotto/portal/portal-fold/frontend/src/components/admin/BillingPage.tsx

import { useState } from 'react';
import { adminImportInvoices, adminImportQuotes } from '../../lib/api';

function BillingPage() {
  const [isImporting, setIsImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
          <h5 className="mb-0">Imports</h5>
        </div>
        <div className="card-body">
          <div className="flex items-center gap-2">
            <button
              onClick={handleInvoiceImportClick}
              className="btn btn-secondary"
              disabled={isImporting}
            >
              {isImporting ? 'Importing...' : 'Import Stripe Invoices'}
            </button>
            <button
              onClick={handleQuoteImportClick}
              className="btn btn-secondary"
              disabled={isImporting}
            >
              {isImporting ? 'Importing...' : 'Import Stripe Quotes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BillingPage;
