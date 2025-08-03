import { useState, useEffect } from 'react';
import { api } from '../../../lib/api';
import { HTTPException } from 'hono/http-exception';
import type { User } from '@portal/shared';
import { format } from 'date-fns';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  selectedDate: Date;
  jobType: 'quote' | 'job' | 'invoice';
}

interface LineItemState {
  notes: string;
  total_amount_cents: number;
}

// Helper to extract a user-friendly error message.
const getErrorMessage = async (error: unknown): Promise<string> => {
  if (error instanceof HTTPException) {
    try {
      const data = await error.response.json();
      return data.message || data.error || 'An unexpected error occurred.';
    } catch (e) {
      return 'An unexpected error occurred parsing the error response.';
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unknown error occurred.';
};

function AddJobModal({ isOpen, onClose, onSave, selectedDate, jobType }: Props) {
  const queryClient = useQueryClient();

  // Form state
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [lineItems, setLineItems] = useState<LineItemState[]>([{ notes: '', total_amount_cents: 0 }]);
  const [title, setTitle] = useState('');
  const [daysUntilExpiry, setDaysUntilExpiry] = useState<number>(7);
  const [error, setError] = useState<string | null>(null);

  // Fetch users using TanStack Query
  const { data: users, isLoading: isLoadingUsers } = useQuery<User[], Error>({
    queryKey: ['admin', 'users'],
    queryFn: async () => {
        const res = await api.admin.users.$get();
        if (!res.ok) {
            throw new HTTPException(res.status, { res });
        }
        const data = await res.json();
        // Filter for customers and guests as they are the ones who can have jobs
        return data.users.filter((u: User) => u.role === 'customer' || u.role === 'guest');
    },
    enabled: isOpen, // Only fetch when the modal is open
  });

  // Mutation for creating a job
  const { mutate: createJob, isPending: isSubmitting } = useMutation({
    mutationFn: (variables: { action: 'draft' | 'send_proposal' | 'send_invoice' | 'post' | 'send_finalized' }) => {
      return api.admin.jobs.$post({
        json: {
          user_id: selectedUserId,
          jobType,
          title,
          start: selectedDate.toISOString(),
          services: lineItems.map(item => ({
              notes: item.notes || '',
              total_amount_cents: item.total_amount_cents || 0
          })),
          isDraft: variables.action === 'draft',
          action: variables.action,
          // Note: The backend might need to calculate the expiry based on this
          daysUntilDue: daysUntilExpiry,
        }
      });
    },
    onSuccess: (res) => {
      if (!res.ok) {
        // If the server responds with an error status, throw it to the onError handler
        throw new HTTPException(res.status, { res });
      }
      // On success, invalidate queries that are now stale
      queryClient.invalidateQueries({ queryKey: ['admin', 'jobs'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] }); // For any general job lists
      onSave();
      onClose();
    },
    onError: async (err) => {
      const message = await getErrorMessage(err);
      setError(message);
    },
  });

  // Effect to reset form state when the modal is opened
  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setSelectedUserId('');
      setLineItems([{ notes: '', total_amount_cents: 0 }]);
      setError(null);
      setDaysUntilExpiry(7);
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
    if (lineItems.length > 1) {
        const newLineItems = lineItems.filter((_, i) => i !== index);
        setLineItems(newLineItems);
    }
  };

  const handleSubmit = (action: 'draft' | 'send_proposal' | 'send_invoice' | 'post' | 'send_finalized') => {
    setError(null);
    if (!selectedUserId || !title || lineItems.some(item => !item.notes)) {
      setError("Please select a customer, enter a title, and provide a description for all line items.");
      return;
    }
    createJob({ action });
  };

  if (!isOpen) return null;

  const modalTitle = {
    quote: 'New Quote',
    job: 'New Job',
    invoice: 'New Invoice',
  }[jobType];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-base-100 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">{modalTitle} for {format(selectedDate, 'MMMM do, yyyy')}</h2>
            <button type="button" className="btn btn-sm btn-circle btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="flex-grow overflow-y-auto pr-2">
            {error && <div className="alert alert-error shadow-lg mb-4"><div><span>{error}</span></div></div>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-control">
                <label className="label"><span className="label-text">Customer</span></label>
                <select className="select select-bordered" value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} disabled={isLoadingUsers}>
                  <option value="">{isLoadingUsers ? 'Loading...' : 'Select a user'}</option>
                  {users?.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.name || user.company_name} ({user.email || user.phone})
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">{jobType === 'quote' ? 'Quote' : 'Job'} Title</span></label>
                <input type="text" className="input input-bordered" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">Days Until Due/Expiry</span></label>
                <input type="number" className="input input-bordered" value={daysUntilExpiry} onChange={(e) => setDaysUntilExpiry(parseInt(e.target.value, 10))} />
              </div>
            </div>
            <div className="divider my-4">Line Items</div>
            {lineItems.map((item, index) => (
              <div key={index} className="flex items-center gap-2 mb-2">
                <input type="text" className="input input-bordered flex-grow" placeholder="Description" value={item.notes || ''} onChange={(e) => handleLineItemChange(index, 'notes', e.target.value)} />
                <input type="number" step="0.01" className="input input-bordered w-32" placeholder="Price ($)" value={(item.total_amount_cents || 0) / 100} onChange={(e) => handleLineItemChange(index, 'total_amount_cents', e.target.value)} />
                <button className="btn btn-error btn-sm" onClick={() => removeLineItem(index)} disabled={lineItems.length <= 1}>X</button>
              </div>
            ))}
            <button className="btn btn-secondary mt-1" onClick={addLineItem}>Add Item</button>
        </div>
        <div className="pt-4 border-t border-base-300 flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          {jobType === 'quote' && (
            <>
              <button type="button" className="btn" onClick={() => handleSubmit('draft')} disabled={isSubmitting}>Save as Draft</button>
              <button type="button" className="btn btn-info" onClick={() => handleSubmit('send_proposal')} disabled={isSubmitting}>Send Proposal</button>
              <button type="button" className="btn btn-primary" onClick={() => handleSubmit('send_finalized')} disabled={isSubmitting}>Send Finalized</button>
            </>
          )}
          {jobType === 'invoice' && (
            <>
              <button type="button" className="btn" onClick={() => handleSubmit('draft')} disabled={isSubmitting}>Save as Draft</button>
              <button type="button" className="btn btn-primary" onClick={() => handleSubmit('send_invoice')} disabled={isSubmitting}>Send Invoice</button>
            </>
          )}
          {jobType === 'job' && (
            <>
              <button type="button" className="btn" onClick={() => handleSubmit('draft')} disabled={isSubmitting}>Save as Draft</button>
              <button type="button" className="btn btn-primary" onClick={() => handleSubmit('post')} disabled={isSubmitting}>Post</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default AddJobModal;
