import React, { useState, useEffect } from 'react';
import { api } from '../../../lib/api';
import { HTTPException } from 'hono/http-exception';
import type { User, InsertJob } from '@portal/shared';
import { format } from 'date-fns';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  selectedDate: Date | null;
}

interface LineItemFormState {
  id: number;
  item: string;
  amountInDollars: string;
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


function NewAddJobModal({ isOpen, onClose, onSave, selectedDate }: Props) {
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [recurrence, setRecurrence] = useState('none');
  const [due, setDue] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [jobType, setJobType] = useState<'job' | 'quote' | 'invoice'>('job');
  const [lineItems, setLineItems] = useState<LineItemFormState[]>([
    { id: Date.now(), item: '', amountInDollars: '' }
  ]);
  const [error, setError] = useState<string | null>(null);

  const { data: users, isLoading: isLoadingUsers } = useQuery<User[], Error>({
    queryKey: ['admin', 'users', 'customers'],
    queryFn: async () => {
        const res = await api.admin.users.$get();
        if (!res.ok) throw new HTTPException(res.status, { res });
        const data = await res.json();
        return data.users.filter((u: User) => u.role === 'customer' || u.role === 'guest');
    },
    enabled: isOpen,
  });

  const { mutate: createJob, isPending: isSubmitting } = useMutation({
    mutationFn: (payload: InsertJob) => {
      return api.admin.jobs.$post({ json: payload });
    },
    onSuccess: (res) => {
      if (!res.ok) {
        throw new HTTPException(res.status, { res });
      }
      queryClient.invalidateQueries({ queryKey: ['admin', 'jobs'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
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
      setTitle('');
      setDescription('');
      setSelectedUserId('');
      setLineItems([{ id: Date.now(), item: '', amountInDollars: '' }]);
      setJobType('job');
      setRecurrence('none');
      setDue('');
      setStart(selectedDate ? format(selectedDate, "yyyy-MM-dd'T'HH:mm") : '');
      setEnd('');
      setError(null);
    }
  }, [isOpen, selectedDate]);

  const handleLineItemChange = (id: number, field: 'item' | 'amountInDollars', value: string) => {
    setLineItems(lineItems.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const addLineItem = () => {
    setLineItems([...lineItems, { id: Date.now(), item: '', amountInDollars: '' }]);
  };

  const removeLineItem = (id: number) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter(item => item.id !== id));
    }
  };

  const handleSubmit = () => {
    setError(null);
    if (!selectedUserId || !title) {
      setError("Please select a customer and enter a title.");
      return;
    }

    const services = lineItems
      .map(li => ({
        notes: li.item,
        total_amount_cents: Math.round(parseFloat(li.amountInDollars) * 100),
      }))
      .filter(li => li.notes && !isNaN(li.total_amount_cents) && li.total_amount_cents >= 0);

    if (services.length === 0) {
        setError("Please add at least one valid line item.");
        return;
    }

    const payload: InsertJob = {
      user_id: selectedUserId,
      title,
      description,
      jobType,
      start: start ? new Date(start).toISOString() : new Date().toISOString(),
      services,
      // Optional fields
      ...(recurrence !== 'none' && { recurrence_pattern: recurrence }),
      ...(due && { due_date: new Date(due).toISOString() }),
      ...(end && { end: new Date(end).toISOString() }),
    };

    createJob(payload);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-base-100 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Create New {selectedDate && `for ${format(selectedDate, 'MMMM do, yyyy')}`}</h2>
            <button type="button" className="btn btn-sm btn-circle btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="flex-grow overflow-y-auto pr-2 space-y-4">
            {error && <div className="alert alert-error shadow-lg"><div><span>{error}</span></div></div>}
            <div className="form-control">
              <label className="label"><span className="label-text font-semibold">Creation Type</span></label>
              <div className="flex items-center space-x-4 mt-1">
                <label className="flex items-center"><input type="radio" name="jobType" value="job" checked={jobType === 'job'} onChange={() => setJobType('job')} className="radio radio-primary" /> <span className="label-text ml-2">Job</span></label>
                <label className="flex items-center"><input type="radio" name="jobType" value="quote" checked={jobType === 'quote'} onChange={() => setJobType('quote')} className="radio radio-primary" /> <span className="label-text ml-2">Quote</span></label>
                <label className="flex items-center"><input type="radio" name="jobType" value="invoice" checked={jobType === 'invoice'} onChange={() => setJobType('invoice')} className="radio radio-primary" /> <span className="label-text ml-2">Invoice</span></label>
              </div>
            </div>
            <div className="form-control">
              <label htmlFor="user" className="label"><span className="label-text">Customer</span></label>
              <select id="user" className="select select-bordered" value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} required disabled={isLoadingUsers}>
                <option value="" disabled>{isLoadingUsers ? "Loading..." : "Select a user..."}</option>
                {users?.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.name || user.company_name} ({user.email || user.phone})
                  </option>
                ))}
              </select>
            </div>
            <div className="form-control">
              <label htmlFor="title" className="label"><span className="label-text">Title</span></label>
              <input type="text" id="title" className="input input-bordered" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div className="form-control">
              <label htmlFor="description" className="label"><span className="label-text">Description</span></label>
              <textarea id="description" className="textarea textarea-bordered" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-control">
                <label htmlFor="start" className="label"><span className="label-text">Job Start Time</span></label>
                <input type="datetime-local" id="start" className="input input-bordered" value={start} onChange={(e) => setStart(e.target.value)} />
              </div>
              <div className="form-control">
                <label htmlFor="end" className="label"><span className="label-text">Job End Time</span></label>
                <input type="datetime-local" id="end" className="input input-bordered" value={end} onChange={(e) => setEnd(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-control">
                <label htmlFor="recurrence" className="label"><span className="label-text">Recurrence</span></label>
                <select id="recurrence" className="select select-bordered" value={recurrence} onChange={(e) => setRecurrence(e.target.value)}>
                  <option value="none">None</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div className="form-control">
                <label htmlFor="due" className="label"><span className="label-text">Due Date / Expiration</span></label>
                <input type="date" id="due" className="input input-bordered" value={due} onChange={(e) => setDue(e.target.value)} />
              </div>
            </div>
            <div className="divider">Line Items</div>
            {lineItems.map((item) => (
              <div key={item.id} className="flex items-center gap-2 mb-2">
                <input type="text" className="input input-bordered flex-grow" placeholder="Description" value={item.item} onChange={(e) => handleLineItemChange(item.id, 'item', e.target.value)} />
                <input type="number" step="0.01" className="input input-bordered w-32" placeholder="Price ($)" value={item.amountInDollars} onChange={(e) => handleLineItemChange(item.id, 'amountInDollars', e.target.value)} />
                <button className="btn btn-error btn-sm" onClick={() => removeLineItem(item.id)} disabled={lineItems.length <= 1}>X</button>
              </div>
            ))}
            <button className="btn btn-secondary mt-1" onClick={addLineItem}>Add Item</button>
        </div>
        <div className="pt-4 border-t border-base-300 flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <span className="loading loading-spinner"></span>}
            Create {jobType}
          </button>
        </div>
      </div>
    </div>
  );
}

export default NewAddJobModal;
