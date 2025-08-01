import { useState, useEffect } from 'react';
// Import the new 'api' client.
import { api } from '../../../lib/api';
import { ApiError } from '../../../lib/fetchJson';
import type { User } from '@portal/shared';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  type: 'job' | 'quote';
}

// A simple interface for the line item state within this component.
interface LineItemState {
  notes: string;
  total_amount_cents: number;
}

function JobQuoteModal({ isOpen, onClose, onSave, type }: Props) {
  const [users, setUsers] = useState<User[]>([]);
  const [selecteduserId, setSelectedUserId] = useState<string>('');
  const [lineItems, setLineItems] = useState<LineItemState[]>([{ notes: '', total_amount_cents: 0 }]);
  const [title, setTitle] = useState('');
  const [dueDateDays, setDueDateDays] = useState<number>(30);
  const [expireDateDays, setExpireDateDays] = useState<number>(30);
  const [contactMethod, setContactMethod] = useState<'default' | 'email' | 'sms' | 'push'>('default');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const fetchUsers = async () => {
        try {
          // --- UPDATED ---
          const res = await api.admin.users.$get();
          if (!res.ok) throw new Error('Failed to fetch users');
          const allUsers = await res.json();
          // --- END UPDATE ---
          setUsers(allUsers.filter(u => u.role === 'customer'));
        } catch (err) {
          setError('Failed to load users.');
        }
      };
      fetchUsers();
    }
  }, [isOpen]);

  const handleLineItemChange = (index: number, field: 'notes' | 'total_amount_cents', value: string) => {
    const newLineItems = [...lineItems];
    if (field === 'total_amount_cents') {
      const price = parseFloat(value);
      newLineItems[index][field] = isNaN(price) ? 0 : Math.round(price * 100);
    } else {
      newLineItems[index][field] = value;
    }
    setLineItems(newLineItems);
  };

  const addLineItem = () => {
    setLineItems([...lineItems, { notes: '', total_amount_cents: 0 }]);
  };

  const removeLineItem = (index: number) => {
    const newLineItems = lineItems.filter((_, i) => i !== index);
    setLineItems(newLineItems);
  };

  const handleSubmit = async (isDraft: boolean) => {
    setError(null);
    if (!selecteduserId) {
      setError("Please select a user.");
      return;
    }
    setIsSubmitting(true);
    try {
      // --- UPDATED ---
      const payload = {
        user_id: selecteduserId,
        title,
        jobType: type, // Use the 'type' prop
        lineItems: lineItems.map(li => ({
            description: li.notes,
            quantity: 1,
            unit_total_amount_cents: li.total_amount_cents
        })),
        isDraft,
        // contactMethod, // Backend does not seem to support this field directly on job creation
        // dueDateDays and expireDateDays also need to be handled by the backend logic
      };

      const res = await api.admin.jobs.$post({ json: payload as any });
      if (!res.ok) {
        const errorData = await res.json();
        throw new ApiError(errorData.error || `Failed to create ${type}`, res.status);
      }
      // --- END UPDATE ---

      onSave();
      onClose();
    } catch (err: any) {
      setError(err.message || 'An unknown error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="absolute left-0 mt-2 w-[32rem] max-w-lg rounded-md shadow-lg z-20 card" tabIndex={-1}>
      <div className="card-header flex justify-between items-center">
        <h5 className="card-title text-xl">Add New {type === 'job' ? 'Job/Invoice' : 'Quote'}</h5>
        <button type="button" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl font-bold" onClick={onClose}>&times;</button>
      </div>
      <div className="card-body">
        {error && <div className="alert alert-danger">{error}</div>}
        <div className="mb-3">
          <label htmlFor="user" className="form-label">Customer</label>
          <select id="user" className="form-control" value={selecteduserId} onChange={(e) => setSelectedUserId(e.target.value)}>
            <option value="">Select a user</option>
            {users.map(user => (
              <option key={user.id} value={user.id.toString()}>
                {user.name || user.company_name} ({user.email || user.phone})
              </option>
            ))}
          </select>
        </div>
        <div className="mb-3">
          <label htmlFor="title" className="form-label">Title</label>
          <input type="text" id="title" className="form-control" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <hr className="my-3 border-border-light dark:border-border-dark" />
        <h6 className="font-semibold mb-2">Line Items</h6>
        {lineItems.map((item, index) => (
          <div key={index} className="flex items-center gap-2 mb-2">
            <div className="flex-grow">
              <input type="text" className="form-control" placeholder="Description" value={item.notes || ''} onChange={(e) => handleLineItemChange(index, 'notes', e.target.value)} />
            </div>
            <div className="w-28">
              <input type="number" step="0.01" className="form-control" placeholder="Price ($)" value={(item.total_amount_cents || 0) / 100} onChange={(e) => handleLineItemChange(index, 'total_amount_cents', e.target.value)} />
            </div>
            <div>
              <button className="btn btn-danger" onClick={() => removeLineItem(index)}>X</button>
            </div>
          </div>
        ))}
        <button className="btn btn-secondary mt-1" onClick={addLineItem}>Add Item</button>
        <hr className="my-3 border-border-light dark:border-border-dark" />
        {type === 'job' && (
          <div className="mb-3">
            <label htmlFor="dueDateDays" className="form-label">Payment Due In (days)</label>
            <input type="number" id="dueDateDays" className="form-control" value={dueDateDays} onChange={(e) => setDueDateDays(parseInt(e.target.value, 10))} />
          </div>
        )}
        {type === 'quote' && (
          <div className="mb-3">
            <label htmlFor="expireDateDays" className="form-label">Expires In (days)</label>
            <input type="number" id="expireDateDays" className="form-control" value={expireDateDays} onChange={(e) => setExpireDateDays(parseInt(e.target.value, 10))} />
          </div>
        )}
         <div className="mb-3">
            <label htmlFor="contactMethod" className="form-label">Send Via</label>
            <select id="contactMethod" className="form-control" value={contactMethod} onChange={(e) => setContactMethod(e.target.value as any)}>
                <option value="default">Customer's Preference</option>
                <option value="email">Email</option>
                <option value="sms">SMS</option>
                <option value="push">Web Push</option>
            </select>
        </div>
      </div>
      <div className="p-4 border-t border-border-light dark:border-border-dark flex justify-end gap-2 bg-gray-50 dark:bg-secondary-dark/50 rounded-b-lg">
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button type="button" className="btn btn-info" onClick={() => handleSubmit(true)} disabled={isSubmitting}>Save as Draft</button>
        <button type="button" className="btn btn-primary" onClick={() => handleSubmit(false)} disabled={isSubmitting}>
          {isSubmitting ? 'Sending...' : 'Save and Send'}
        </button>
      </div>
    </div>
  );
}

export default JobQuoteModal;
