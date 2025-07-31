// frontend/src/components/admin/InvoiceEditor.tsx
import { useState, useEffect } from 'react';
import type { StripeInvoice, StripeInvoiceItem } from '@portal/shared';
import { getInvoice, addInvoiceItem, deleteInvoiceItem, finalizeInvoice } from '../../lib/api';

interface Props {
  invoiceId: string;
  onFinalize: () => void;
}

export function InvoiceEditor({ invoiceId, onFinalize }: Props) {
  const [invoice, setInvoice] = useState<StripeInvoice | null>(null);
  const [newItem, setNewItem] = useState({ description: '', amount: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoice = async () => {
    setIsLoading(true);
    try {
      const data = await getInvoice(invoiceId);
      setInvoice(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoice();
  }, [invoiceId]);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.description || !newItem.amount) return;
    setIsUpdating(true);
    setError(null);
    try {
      const amountInCents = Math.round(parseFloat(newItem.amount) * 100);
      await addInvoiceItem(invoiceId, { description: newItem.description, amount: amountInCents });
      setNewItem({ description: '', amount: '' });
      await fetchInvoice(); // Re-fetch to show the new item
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!window.confirm('Are you sure you want to delete this line item?')) return;
    setIsUpdating(true);
    setError(null);
    try {
      await deleteInvoiceItem(invoiceId, itemId);
      await fetchInvoice(); // Re-fetch to show the updated list
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleFinalize = async () => {
    if (!window.confirm('This will finalize the invoice and send it to the customer. Are you sure?')) return;
    setIsUpdating(true);
    setError(null);
    try {
      await finalizeInvoice(invoiceId);
      onFinalize(); // Notify parent component
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) return <div>Loading Invoice...</div>;
  if (error) return <div className="alert alert-danger">{error}</div>;
  if (!invoice) return <div>Invoice not found.</div>;

  return (
    <div className="mt-4 border border-info p-4 rounded-lg">
      <h6 className="font-bold text-lg">Editing Draft Invoice: {invoice.id}</h6>
      <p>Status: <span className="badge bg-secondary">{invoice.status}</span></p>

      {/* Line Items List */}
      <div className="my-4">
        <strong>Line Items:</strong>
        {invoice.lines.data.length === 0 ? (
          <p className="text-muted">No items yet.</p>
        ) : (
          <ul className="list-group">
            {invoice.lines.data.map((item: StripeInvoiceItem) => (
              <li key={item.id} className="list-group-item d-flex justify-content-between align-items-center">
                <span>{item.description} - ${(item.amount / 100).toFixed(2)}</span>
                <button className="btn btn-sm btn-danger" onClick={() => handleDeleteItem(item.id)} disabled={isUpdating}>X</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Add New Item Form */}
      <form onSubmit={handleAddItem} className="row g-3 align-items-end mb-4">
        <div className="col-md-6">
          <label htmlFor="description" className="form-label">Description</label>
          <input
            type="text"
            className="form-control"
            id="description"
            value={newItem.description}
            onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
            required
          />
        </div>
        <div className="col-md-4">
          <label htmlFor="amount" className="form-label">Amount ($)</label>
          <input
            type="number"
            className="form-control"
            id="amount"
            step="0.01"
            value={newItem.amount}
            onChange={(e) => setNewItem({ ...newItem, amount: e.target.value })}
            required
          />
        </div>
        <div className="col-md-2">
          <button type="submit" className="btn btn-info w-100" disabled={isUpdating}>Add</button>
        </div>
      </form>

      {/* Actions */}
      <div className="d-flex justify-content-end gap-2">
        <button className="btn btn-success" onClick={handleFinalize} disabled={isUpdating || invoice.lines.data.length === 0}>
          {isUpdating ? 'Finalizing...' : 'Finalize & Send'}
        </button>
      </div>
    </div>
  );
}
