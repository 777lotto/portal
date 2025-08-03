import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { HTTPException } from 'hono/http-exception';
import { format } from 'date-fns';
import StyledDigitInput from '../forms/StyledDigitInput';
import type { User, LineItem } from '@portal/shared';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date;
  user?: User | null;
}

const getErrorMessage = async (error: unknown): Promise<React.ReactNode> => {
  if (error instanceof HTTPException) {
    try {
      const data = await error.response.json();
      if (error.response.status === 409 && data.details?.code === 'LOGIN_REQUIRED') {
        return (
          <span>
            An account already exists with this information. Please <Link to="/auth" className="link link-primary font-bold">log in</Link> to book.
          </span>
        );
      }
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

function BookingModal({ isOpen, onClose, selectedDate, user = null }: Props) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', address: '' });
  const [selectedLineItems, setSelectedLineItems] = useState<LineItem[]>([]);
  const [error, setError] = useState<React.ReactNode>('');
  const [success, setSuccess] = useState('');

  const { data: lineItemOptions, isLoading: isLoadingLineItems } = useQuery<LineItem[], Error>({
    queryKey: ['line-items'],
    queryFn: async () => {
      const res = await api['line-items'].$get();
      if (!res.ok) throw new HTTPException(res.status, { res });
      return res.json();
    },
    enabled: isOpen,
  });

  const { mutate: submitBooking, isPending: isSubmitting } = useMutation({
    mutationFn: async () => {
      if (user) {
        // Authenticated user booking
        return api.jobs.$post({
          json: {
            title: selectedLineItems.map(s => s.description).join(', '),
            lineItems: selectedLineItems.map(s => ({ id: s.id, description: s.description, quantity: s.quantity, unit_total_amount_cents: s.unit_total_amount_cents })),
            start: selectedDate.toISOString(),
            jobType: 'job',
          }
        });
      } else {
        // Public user booking
        return api.public.booking.$post({
            json: {
                ...formData,
                date: format(selectedDate, 'yyyy-MM-dd'),
                services: selectedLineItems.map(({description}) => ({name: description, duration: 1})),
            }
        });
      }
    },
    onSuccess: (res) => {
      if (!res.ok) throw new HTTPException(res.status, { res });
      setSuccess(user ? 'Your booking has been scheduled!' : 'Your booking request has been sent! We will contact you shortly to confirm.');
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'jobs'] });
      setTimeout(() => {
        onClose();
        setSuccess('');
      }, 3000);
    },
    onError: async (err) => {
      const message = await getErrorMessage(err);
      setError(message);
    }
  });

  useEffect(() => {
    if (isOpen) {
      if (user) {
        setFormData({
          name: user.name || '', email: user.email || '',
          phone: user.phone || '', address: user.address || '',
        });
      } else {
        setFormData({ name: '', email: '', phone: '', address: '' });
      }
      setSelectedLineItems([]);
      setError('');
      setSuccess('');
    }
  }, [isOpen, user]);

  const handleLineItemChange = (lineItem: LineItem) => {
    setSelectedLineItems(prev =>
      prev.some(s => s.id === lineItem.id)
        ? prev.filter(s => s.id !== lineItem.id)
        : [...prev, lineItem]
    );
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedLineItems.length === 0) {
      setError('Please select at least one service.');
      return;
    }
    setError('');
    submitBooking();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-base-100 rounded-lg p-6 w-full max-w-lg max-h-full overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">Request Booking for {format(selectedDate, 'MMMM do, yyyy')}</h2>
        {error && <div className="alert alert-error shadow-lg"><div>{error}</div></div>}
        {success && <div className="alert alert-success shadow-lg"><div><span>{success}</span></div></div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label"><span className="label-text font-bold">Services</span></label>
            {isLoadingLineItems ? <span className="loading loading-spinner"></span> : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                {lineItemOptions?.map(lineItem => (
                  <label key={lineItem.id} className="flex items-center space-x-2 p-2 border rounded-md cursor-pointer">
                    <input type="checkbox" className="checkbox" onChange={() => handleLineItemChange(lineItem)} checked={selectedLineItems.some(s => s.id === lineItem.id)} />
                    <span>{lineItem.description}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input name="name" placeholder="Full Name" value={formData.name} onChange={handleChange} className="input input-bordered" required readOnly={!!user} />
            <input name="email" type="email" placeholder="Email Address" value={formData.email} onChange={handleChange} className="input input-bordered" required readOnly={!!user} />
            <div className="md:col-span-2">
              <StyledDigitInput
                id="phone"
                label="Phone Number"
                value={formData.phone}
                onChange={(value) => setFormData(prev => ({ ...prev, phone: value }))}
                digitCount={10}
                format="phone"
                autoComplete="tel"
                readOnly={!!user}
              />
            </div>
            <input name="address" placeholder="Service Address" value={formData.address} onChange={handleChange} className="input input-bordered md:col-span-2" required readOnly={!!user} />
          </div>
          <div className="flex justify-end space-x-4">
            <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting && <span className="loading loading-spinner"></span>}
              {user ? 'Schedule Booking' : 'Request Booking'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default BookingModal;
