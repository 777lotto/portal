// frontend/src/components/admin/AddJobModal.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet, adminCreateJobForUser } from '../../lib/api';
import type { User, Service } from '@portal/shared';
import { format } from 'date-fns';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  selectedDate: Date;
  jobType: 'quote' | 'job' | 'invoice';
}

function AddJobModal({ isOpen, onClose, onSave, selectedDate, jobType }: Props) {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [selecteduser_id, setSelecteduser_id] = useState<string>('');
  const [lineItems, setLineItems] = useState<Partial<Service>[]>([{ notes: '', total_amount_cents: 0 }]);
  const [title, setTitle] = useState('');
  const [daysUntilExpiry, setDaysUntilExpiry] = useState<number>(7);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setSelecteduser_id('');
      setLineItems([{ notes: '', total_amount_cents: 0 }]);
      setError(null);
      setDaysUntilExpiry(7);
      const fetchUsers = async () => {
        try {
          const allUsers = await apiGet<User[]>('/api/admin/users');
          setUsers(allUsers.filter(u => u.role === 'customer' || u.role === 'guest'));
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

  const handleSubmit = async (action: 'draft' | 'send_proposal' | 'send_invoice' | 'post') => {
    setError(null);
    if (!selecteduser_id || !title || lineItems.some(item => !item.notes)) {
      setError("Please select a customer, enter a title, and provide a description for all line items.");
      return;
    }
    setIsSubmitting(true);
    try {
      // Use the new, unified adminCreateJob function
      await adminCreateJob({
        user_id: selecteduser_id,
        jobType, // This comes from the component's props
        title,
        start: selectedDate.toISOString(),
        services: lineItems.map(item => ({
            notes: item.notes || '',
            total_amount_cents: item.total_amount_cents || 0
        })),
        isDraft: action === 'draft',
        action: action, // Pass the action for the backend to use
      });
      onSave();
      onClose();
    } catch (err: any) {
      setError(err.message || 'An unknown error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const modalTitle = {
    quote: 'New Quote',
    job: 'New Job',
    invoice: 'New Invoice',
  }[jobType];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-tertiary-dark rounded-lg p-6 w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">{modalTitle} for {format(selectedDate, 'MMMM do, yyyy')}</h2>
            <button type="button" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl font-bold" onClick={onClose}>&times;</button>
        </div>

        <div className="flex-grow overflow-y-auto pr-2">
            {error && <div className="alert alert-danger">{error}</div>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="mb-3">
                <label htmlFor="user" className="form-label">Customer</label>
                <select id="user" className="form-control" value={selecteduser_id} onChange={(e) => setSelecteduser_id(e.target.value)}>
                  <option value="">Select a user</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.name || user.company_name} ({user.email || user.phone})
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-3">
                <label htmlFor="title" className="form-label">{jobType === 'quote' ? 'Quote' : 'Job'} Title</label>
                <input type="text" id="title" className="form-control" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="mb-3">
                <label htmlFor="daysUntilExpiry" className="form-label">Days Until Due/Expiry</label>
                <input type="number" id="daysUntilExpiry" className="form-control" value={daysUntilExpiry} onChange={(e) => setDaysUntilExpiry(parseInt(e.target.value, 10))} />
              </div>
            </div>
            <hr className="my-3 border-border-light dark:border-border-dark" />
            <h6 className="font-semibold mb-2">Line Items</h6>
            {lineItems.map((item, index) => (
              <div key={index} className="flex items-center gap-2 mb-2">
                <div className="flex-grow">
                  <input type="text" className="form-control" placeholder="Description" value={item.notes || ''} onChange={(e) => handleLineItemChange(index, 'notes', e.target.value)} />
                </div>
                <div className="w-32">
                  <input type="number" step="0.01" className="form-control" placeholder="Price ($)" value={(item.total_amount_cents || 0) / 100} onChange={(e) => handleLineItemChange(index, 'total_amount_cents', e.target.value)} />
                </div>
                <div>
                  <button className="btn btn-danger" onClick={() => removeLineItem(index)}>X</button>
                </div>
              </div>
            ))}
            <button className="btn btn-secondary mt-1" onClick={addLineItem}>Add Item</button>
        </div>

        <div className="pt-4 border-t border-border-light dark:border-border-dark flex justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          {jobType === 'quote' && (
            <>
              <button type="button" className="btn btn-secondary" onClick={() => handleSubmit('draft')} disabled={isSubmitting}>Save as Draft</button>
              <button type="button" className="btn btn-info" onClick={() => handleSubmit('send_proposal')} disabled={isSubmitting}>Send Proposal</button>
              <button type="button" className="btn btn-primary" onClick={() => handleSubmit('send_finalized')} disabled={isSubmitting}>Send Finalized</button>
            </>
          )}
          {jobType === 'invoice' && (
            <>
              <button type="button" className="btn btn-secondary" onClick={() => handleSubmit('draft')} disabled={isSubmitting}>Save as Draft</button>
              <button type="button" className="btn btn-primary" onClick={() => handleSubmit('send_invoice')} disabled={isSubmitting}>Send Invoice</button>
            </>
          )}
          {jobType === 'job' && (
            <>
              <button type="button" className="btn btn-secondary" onClick={() => handleSubmit('draft')} disabled={isSubmitting}>Save as Draft</button>
              <button type="button" className="btn btn-primary" onClick={() => handleSubmit('post')} disabled={isSubmitting}>Post</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default AddJobModal;
