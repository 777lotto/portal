import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPublicBooking, getLineItems, createJob } from '../../lib/api';
import { ApiError } from '../../lib/fetchJson';
import { format } from 'date-fns';
import StyledDigitInput from '../forms/StyledDigitInput';
import type { User, LineItem } from '@portal/shared';

declare global {
  interface Window {
    onTurnstileSuccess?: (token: string) => void;
  }
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date;
  user?: User | null;
}

function BookingModal({ isOpen, onClose, selectedDate, user = null }: Props) {
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', address: '' });
  const [lineItemOptions, setLineItemOptions] = useState<LineItem[]>([]);
  const [selectedLineItems, setSelectedLineItems] = useState<LineItem[]>([]);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [error, setError] = useState<React.ReactNode>('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (user) {
        setFormData({
          name: user.name || '',
          email: user.email || '',
          phone: user.phone || '',
          address: user.address || '',
        });
      }

      const fetchLineItems = async () => {
        try {
          const lineItems = await getLineItems();
          setLineItemOptions(lineItems);
        } catch (err) {
          setError('Failed to load services. Please try again.');
        }
      };
      fetchLineItems();

      if (!user) {
        window.onTurnstileSuccess = (token: string) => {
          setTurnstileToken(token);
        };
      }
    }
    return () => {
      if (!user) {
        delete window.onTurnstileSuccess;
      }
    };
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedLineItems.length === 0) {
      setError('Please select at least one service.');
      return;
    }
    if (!user && !turnstileToken) {
      setError("Please wait for the security check to complete.");
      return;
    }

    setError('');
    setSuccess('');
    setIsSubmitting(true);

    try {
      if (user) {
        // Logic for existing customer
        await createJob({
          title: selectedLineItems.map(s => s.description).join(', '),
          lineItems: selectedLineItems.map(s => ({ id: s.id, description: s.description, quantity: s.quantity, unit_total_amount_cents: s.unit_total_amount_cents })),
        });
        setSuccess('Your booking has been scheduled!');
      } else {
        // Logic for public booking
        await createPublicBooking({
          ...formData,
          date: format(selectedDate, 'yyyy-MM-dd'),
          services: selectedLineItems.map(({description}) => ({name: description, duration: 1})),
          'cf-turnstile-response': turnstileToken,
        });
        setSuccess('Your booking request has been sent! We will contact you shortly to confirm.');
      }

      setTimeout(() => {
        onClose();
        setSuccess('');
        if(!user) setTurnstileToken('');
      }, 3000);
    } catch (err: any) {
      if (err instanceof ApiError && err.details?.code) {
        if (err.details.code === 'LOGIN_REQUIRED') {
          setError(
            <span>
              An account already exists. Please <Link to="/auth" className="text-primary font-bold">log in</Link> to book.
            </span>
          );
        } else {
          setError(err.message);
        }
      } else {
        setError(err.message || 'An unknown error occurred.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-tertiary-dark rounded-lg p-6 w-full max-w-lg max-h-full overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">Request Booking for {format(selectedDate, 'MMMM do, yyyy')}</h2>
        {error && <div className="alert alert-danger">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="font-bold">Services</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
              {lineItemOptions.map(lineItem => (
                <label key={lineItem.id} className="flex items-center space-x-2 p-2 border rounded-md">
                  <input type="checkbox" onChange={() => handleLineItemChange(lineItem)} />
                  <span>{lineItem.description}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <input name="name" placeholder="Full Name" value={formData.name} onChange={handleChange} className="form-control" required readOnly={!!user} />
            <input name="email" type="email" placeholder="Email Address" value={formData.email} onChange={handleChange} className="form-control" required readOnly={!!user} />

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

            <input name="address" placeholder="Service Address" value={formData.address} onChange={handleChange} className="form-control md:col-span-2" required readOnly={!!user} />
          </div>

          {!user && (
            <div className="mb-3 d-flex justify-content-center" id="turnstile-container"></div>
          )}

          <div className="flex justify-end space-x-4">
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting || (!user && !turnstileToken)}>
              {isSubmitting ? 'Submitting...' : (user ? 'Schedule Booking' : 'Request Booking')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default BookingModal;
