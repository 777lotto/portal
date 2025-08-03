import { useState, useEffect } from 'react';
import { api } from '../../../lib/api';
import { HTTPException } from 'hono/http-exception';
import type { User, InsertJob } from '@portal/shared';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  type: 'job' | 'quote';
}

interface LineItemState {
  notes: string;
  total_amount_cents: number;
}

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

function JobQuoteModal({ isOpen, onClose, onSave, type }: Props) {
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [lineItems, setLineItems] = useState<LineItemState[]>([{ notes: '', total_amount_cents: 0 }]);
  const [title, setTitle] = useState('');
  const [dueDateDays, setDueDateDays] = useState<number>(30);
  const [expireDateDays, setExpireDateDays] = useState<number>(30);
  const [error, setError] = useState<string | null>(null);

  const { data: users, isLoading: isLoadingUsers } = useQuery<User[], Error>({
    queryKey: ['admin', 'users', 'customers'],
    queryFn: async () => {
        const res = await api.admin.users.$get();
        if (!res.ok) throw new HTTPException(res.status, { res });
        const data = await res.json();
        return data.users.filter((u: User) => u.role === 'customer');
    },
    enabled: isOpen,
  });

  const { mutate: createEntry, isPending: isSubmitting } = useMutation({
    mutationFn: (variables: { isDraft: boolean }) => {
      const payload: InsertJob = {
        user_id: selectedUserId,
        title,
        jobType: type,
        start: new Date().toISOString(), // Default start time
        services: lineItems.map(li => ({
            notes: li.notes,
            total_amount_cents: li.total_amount_cents
        })),
        isDraft: variables.isDraft,
        // Add due/expiry dates based on type
        ...(type === 'job' && { daysUntilDue: dueDateDays }),
        ...(type === 'quote' && { daysUntilDue: expireDateDays }),
      };
      return api.admin.jobs.$post({ json: payload });
    },
    onSuccess: (res) => {
      if (!res.ok) {
        throw new HTTPException(res.status, { res });
      }
      queryClient.invalidateQueries({ queryKey: ['admin', 'jobs'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'quotes'] });
      onSave();
      onClose();
    },
    onError: async (err) => {
      const message = await getErrorMessage(err);
      setError(message);
    }
  });

  useEffect(() => {
    if (isOpen) {
      setSelectedUserId('');
      setLineItems([{ notes: '', total_amount_cents: 0 }]);
      setTitle('');
      setError(null);
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

  const handleSubmit = (isDraft: boolean) => {
    setError(null);
    if (!selectedUserId || !title || lineItems.some(li => !li.notes)) {
      setError("Please select a customer, provide a title, and describe all line items.");
      return;
    }
    createEntry({ isDraft });
  };

  if (!isOpen) return null;

  return (
    <div className="absolute left-0 mt-2 w-[32rem] max-w-lg rounded-md shadow-lg z-20 card bg-base-100" tabIndex={-1}>
      <div className="card-body">
        <div className="flex justify-between items-center mb-4">
            <h5 className="card-title text-xl">Add New {type === 'job' ? 'Job/Invoice' : 'Quote'}</h5>
            <button type="button" className="btn btn-sm btn-circle btn-ghost" onClick={onClose}>✕</button>
        </div>
        {error && <div className="alert alert-error shadow-lg mb-4"><div><span>{error}</span></div></div>}
        <div className="form-control">
          <label htmlFor="user" className="label"><span className="label-text">Customer</span></label>
          <select id="user" className="select select-bordered" value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} disabled={isLoadingUsers}>
            <option value="">{isLoadingUsers ? 'Loading...' : 'Select a user'}</option>
            {users?.map(user => (
              <option key={user.id} value={user.id}>
                {user.name || user.company_name} ({user.email || user.phone})
              </option>
            ))}
          </select>
        </div>
        <div className="form-control mt-4">
          <label htmlFor="title" className="label"><span className="label-text">Title</span></label>
          <input type="text" id="title" className="input input-bordered" value={title} onChange={(e) => setTitle(e.target.value)} />
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
        <div className="divider my-4"></div>
        {type === 'job' && (
          <div className="form-control">
            <label htmlFor="dueDateDays" className="label"><span className="label-text">Payment Due In (days)</span></label>
            <input type="number" id="dueDateDays" className="input input-bordered" value={dueDateDays} onChange={(e) => setDueDateDays(parseInt(e.target.value, 10))} />
          </div>
        )}
        {type === 'quote' && (
          <div className="form-control">
            <label htmlFor="expireDateDays" className="label"><span className="label-text">Expires In (days)</span></label>
            <input type="number" id="expireDateDays" className="input input-bordered" value={expireDateDays} onChange={(e) => setExpireDateDays(parseInt(e.target.value, 10))} />
          </div>
        )}
      </div>
      <div className="p-4 border-t border-base-300 flex justify-end gap-2 bg-base-200/50 rounded-b-lg">
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button type="button" className="btn btn-info" onClick={() => handleSubmit(true)} disabled={isSubmitting}>Save as Draft</button>
        <button type="button" className="btn btn-primary" onClick={() => handleSubmit(false)} disabled={isSubmitting}>
          {isSubmitting && <span className="loading loading-spinner"></span>}
          Save and Send
        </button>
      </div>
    </div>
  );
}

export default JobQuoteModal;
