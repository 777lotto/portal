import React, { useState, useEffect } from 'react';
import { apiGet, adminCreateJob } from '../../lib/api'; // Using your actual API functions
import type { User } from '@portal/shared'; // Using your actual shared types
import { format, isValid, parseISO } from 'date-fns';

// Props interface based on your existing file
interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  selectedDate: Date | null;
}

// Interface for the line item state within this component
interface LineItemFormState {
  id: number; // A temporary ID for React key purposes
  item: string;
  amountInDollars: string;
}

function NewAddJobModal({ isOpen, onClose, onSave, selectedDate }: Props) {
  // State for all form fields
  const [users, setUsers] = useState<User[]>([]);
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

  // State for submission status and errors
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form state when the modal is opened
  useEffect(() => {
    if (isOpen) {
      // Reset all fields to their default values
      setTitle('');
      setDescription('');
      setSelectedUserId('');
      setLineItems([{ id: Date.now(), item: '', amountInDollars: '' }]);
      setJobType('job');
      setRecurrence('none');
      setError(null);

      // Set start date from selectedDate, but clear time
      if (selectedDate && isValid(selectedDate)) {
        const date = new Date(selectedDate);
        date.setHours(9, 0, 0, 0); // Default to 9:00 AM
        // Format for datetime-local input: YYYY-MM-DDTHH:mm
        const formattedDate = format(date, "yyyy-MM-dd'T'HH:mm");
        setStart(formattedDate);
        setEnd('');
        setDue('');
      } else {
        setStart('');
        setEnd('');
        setDue('');
      }


      const fetchUsers = async () => {
        try {
          const allUsers = await apiGet<User[]>('/api/admin/users');
          // Filter for customers/guests as in your original file
          setUsers(allUsers.filter(u => u.role === 'customer' || u.role === 'guest'));
        } catch (err) {
          console.error("Failed to load users:", err);
          setError('Failed to load users.');
        }
      };
      fetchUsers();
    }
  }, [isOpen, selectedDate]);

  // Handlers for dynamically managing line items
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

  // Main submission handler
  const handleSubmit = async () => {
    setError(null);
    if (!selectedUserId || !title) {
      setError("Please select a customer and enter a title.");
      return;
    }

    // Construct the payload that matches our backend's Zod schema
    const payload = {
  user_id: selectedUserId,
  title,
  description,
  jobType,
  recurrence,
  due: due || null,
  start: start ? new Date(start).toISOString() : null,
  end: end ? new Date(end).toISOString() : null,
  lineItems: lineItems
    .map(li => ({
      description: li.item, // Changed from 'item'
      unit_total_amount_cents: Math.round(parseFloat(li.amountInDollars) * 100), // Changed from 'amountInDollars' and converted
      quantity: 1, // Added default quantity
    }))
    .filter(li => li.description && !isNaN(li.unit_total_amount_cents) && li.unit_total_amount_cents >= 0),
    };

    if (payload.lineItems.length === 0) {
        setError("Please add at least one valid line item.");
        return;
    }

    setIsSubmitting(true);
    try {
      // Use the imported adminCreateJob function with the new payload
      await adminCreateJob(payload);
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      {/* Modal panel with flex-col and max-height */}
      <div className="bg-white dark:bg-tertiary-dark rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex-shrink-0 p-4 border-b border-border-light dark:border-border-dark flex justify-between items-center">
            <h2 className="text-xl font-bold">Create New {selectedDate && `for ${format(selectedDate, 'MMMM do, yyyy')}`}</h2>
            <button type="button" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl font-bold" onClick={onClose}>&times;</button>
        </div>

        {/* Modal Body - Scrollable */}
        <div className="flex-grow p-4 overflow-y-auto space-y-4">
            {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">{error}</div>}

            {/* Job Type Selection */}
            <div>
              <label className="form-label font-semibold">Creation Type</label>
              <div className="flex items-center space-x-4 mt-1">
                <label className="flex items-center"><input type="radio" name="jobType" value="job" checked={jobType === 'job'} onChange={() => setJobType('job')} className="mr-2" /> Job</label>
                <label className="flex items-center"><input type="radio" name="jobType" value="quote" checked={jobType === 'quote'} onChange={() => setJobType('quote')} className="mr-2" /> Quote</label>
                <label className="flex items-center"><input type="radio" name="jobType" value="invoice" checked={jobType === 'invoice'} onChange={() => setJobType('invoice')} className="mr-2" /> Invoice</label>
              </div>
            </div>

            {/* Customer and Title */}
            <div>
              <label htmlFor="user" className="form-label">Customer</label>
              <select id="user" className="form-control" value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} required>
                <option value="" disabled>Select a user...</option>
                {users.map(user => (
                  <option key={user.id} value={user.id.toString()}>
                    {user.name || user.company_name} ({user.email || user.phone})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="title" className="form-label">Title</label>
              <input type="text" id="title" className="form-control" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div>
              <label htmlFor="description" className="form-label">Description</label>
              <textarea id="description" className="form-control" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>

            {/* Date/Time Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="start" className="form-label">Job Start Time</label>
                <input type="datetime-local" id="start" className="form-control" value={start} onChange={(e) => setStart(e.target.value)} />
              </div>
              <div>
                <label htmlFor="end" className="form-label">Job End Time</label>
                <input type="datetime-local" id="end" className="form-control" value={end} onChange={(e) => setEnd(e.target.value)} />
              </div>
            </div>

            {/* Recurrence and Due Date */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="recurrence" className="form-label">Recurrence</label>
                <select id="recurrence" className="form-control" value={recurrence} onChange={(e) => setRecurrence(e.target.value)}>
                  <option value="none">None</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div>
                <label htmlFor="due" className="form-label">Due Date / Expiration</label>
                <input type="date" id="due" className="form-control" value={due} onChange={(e) => setDue(e.target.value)} />
              </div>
            </div>

            <hr className="my-3 border-border-light dark:border-border-dark" />
            <h6 className="font-semibold mb-2">Line Items</h6>
            {lineItems.map((item) => (
              <div key={item.id} className="flex items-center gap-2 mb-2">
                <div className="flex-grow">
                  <input type="text" className="form-control" placeholder="Description" value={item.item} onChange={(e) => handleLineItemChange(item.id, 'item', e.target.value)} />
                </div>
                <div className="w-32">
                  <input type="number" step="0.01" className="form-control" placeholder="Price ($)" value={item.amountInDollars} onChange={(e) => handleLineItemChange(item.id, 'amountInDollars', e.target.value)} />
                </div>
                <div>
                  <button className="btn btn-danger" onClick={() => removeLineItem(item.id)}>X</button>
                </div>
              </div>
            ))}
            <button className="btn btn-secondary mt-1" onClick={addLineItem}>Add Item</button>
        </div>

        {/* Modal Footer - Sticky */}
        <div className="flex-shrink-0 p-4 border-t border-border-light dark:border-border-dark flex justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Creating...' : `Create ${jobType}`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default NewAddJobModal;
