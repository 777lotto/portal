// frontend/src/components/admin/AddJobModal.tsx
import { useState, useEffect } from 'react';
// MODIFICATION: Import adminCreateJobForUser instead of apiPost
import { apiGet, adminCreateJobForUser } from '../../lib/api';
import type { User, Service } from '@portal/shared';
import { format } from 'date-fns';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  selectedDate: Date;
}

function AddJobModal({ isOpen, onClose, onSave, selectedDate }: Props) {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [lineItems, setLineItems] = useState<Partial<Service>[]>([{ notes: '', price_cents: 0 }]);
  const [title, setTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setSelectedUserId('');
      setLineItems([{ notes: '', price_cents: 0 }]);
      setError(null);
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

  const handleLineItemChange = (index: number, field: 'notes' | 'price_cents', value: string) => {
    const newLineItems = [...lineItems];
    if (field === 'price_cents') {
        const price = parseFloat(value);
        newLineItems[index][field] = isNaN(price) ? 0 : Math.round(price * 100);
    } else {
      newLineItems[index][field] = value;
    }
    setLineItems(newLineItems);
  };

  const addLineItem = () => {
    setLineItems([...lineItems, { notes: '', price_cents: 0 }]);
  };

  const removeLineItem = (index: number) => {
    const newLineItems = lineItems.filter((_, i) => i !== index);
    setLineItems(newLineItems);
  };

  const handleSubmit = async () => {
    setError(null);
    if (!selectedUserId || !title || lineItems.some(item => !item.notes)) {
      setError("Please select a customer, enter a title, and provide a description for all line items.");
      return;
    }
    setIsSubmitting(true);
    try {
      // MODIFICATION START: Use the correct API function and payload structure
      const payload = {
        title,
        start: selectedDate.toISOString(),
        services: lineItems.map(item => ({
            notes: item.notes || '',
            price_cents: item.price_cents || 0
        }))
      };
      await adminCreateJobForUser(selectedUserId, payload);
      // MODIFICATION END
      onSave();
      onClose();
    } catch (err: any) {
      // Use the error message from the log if available
      if (err.message && err.message.includes('D1_ERROR')) {
          setError('Failed to create job: The database operation timed out. Please try again.');
      } else {
          setError(err.message || 'An unknown error occurred.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-tertiary-dark rounded-lg p-6 w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Add Job for {format(selectedDate, 'MMMM do, yyyy')}</h2>
            <button type="button" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl font-bold" onClick={onClose}>&times;</button>
        </div>

        <div className="flex-grow overflow-y-auto pr-2">
            {error && <div className="alert alert-danger">{error}</div>}
            <div className="mb-3">
              <label htmlFor="user" className="form-label">Customer</label>
              <select id="user" className="form-control" value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}>
                <option value="">Select a user</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.name || user.company_name} ({user.email || user.phone})
                  </option>
                ))}
              </select>
            </div>
            <div className="mb-3">
              <label htmlFor="title" className="form-label">Job Title</label>
              <input type="text" id="title" className="form-control" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <hr className="my-3 border-border-light dark:border-border-dark" />
            <h6 className="font-semibold mb-2">Line Items</h6>
            {lineItems.map((item, index) => (
              <div key={index} className="flex items-center gap-2 mb-2">
                <div className="flex-grow">
                  <input type="text" className="form-control" placeholder="Description" value={item.notes || ''} onChange={(e) => handleLineItemChange(index, 'notes', e.target.value)} />
                </div>
                <div className="w-32">
                  <input type="number" step="0.01" className="form-control" placeholder="Price ($)" value={(item.price_cents || 0) / 100} onChange={(e) => handleLineItemChange(index, 'price_cents', e.target.value)} />
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
          <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Job'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AddJobModal;
