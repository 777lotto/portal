import { useState, useEffect } from 'react';
import { apiPost } from '../../lib/api';
import type { User } from '@portal/shared';
import { format } from 'date-fns';

interface Product {
  id: string;
  name: string;
  description: string;
  timeframe: number | null;
}

const stripeProducts: Product[] = [
  {
    id: 'prod_gutter_cleaning',
    name: 'Gutter Cleaning',
    description: 'Thorough cleaning of all gutters and downspouts to ensure proper water flow and prevent blockages.',
    timeframe: 4,
  },
  {
    id: 'prod_gutter_install',
    name: 'Gutter Install',
    description: 'Professional installation of new, high-quality gutters tailored to your home\'s specific needs.',
    timeframe: 7,
  },
  {
    id: 'prod_pressure_washing',
    name: 'Pressure Washing',
    description: 'High-pressure washing for driveways, siding, and other surfaces to remove dirt, grime, and mildew.',
    timeframe: 6,
  },
  {
    id: 'prod_roof_repair',
    name: 'Roof Repair',
    description: 'Expert repair of leaks, damaged shingles, and other common roof issues to protect your home.',
    timeframe: 4,
  },
  {
    id: 'other',
    name: 'Other',
    description: 'Please describe the service you need.',
    timeframe: null,
  },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date;
  user?: User | null;
}

function BookingModal({ isOpen, onClose, selectedDate, user = null }: Props) {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [otherService, setOtherService] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) {
      setError('Please select a service.');
      return;
    }
    if (selectedProduct.id === 'other' && !otherService.trim()) {
      setError('Please describe the service you need.');
      return;
    }

    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    const lineItems = selectedProduct.id === 'other'
      ? [{ description: otherService, quantity: 1, unit_total_amount_cents: 0 }]
      : [{
          description: selectedProduct.name,
          quantity: 1,
          unit_total_amount_cents: 0,
          // You can add Stripe Price ID here if you have them
        }];

    try {
      await apiPost('/api/jobs', {
        title: selectedProduct.name,
        description: selectedProduct.id === 'other' ? otherService : selectedProduct.description,
        lineItems,
        jobType: 'quote',
        status: 'pending',
        start: selectedDate.toISOString(),
        user_id: user?.id,
      });
      setSuccess('Your booking request has been submitted successfully!');
      setTimeout(() => {
        onClose();
        setSuccess(null);
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'An unknown error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-tertiary-dark rounded-lg p-6 w-full max-w-lg">
        <h2 className="text-xl font-bold mb-4">Request a Booking for {format(selectedDate, 'MMMM do, yyyy')}</h2>
        {error && <div className="alert alert-danger">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="form-label font-semibold">Select a Service</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
              {stripeProducts.map(product => (
                <div key={product.id}
                  className={`p-4 border rounded-lg cursor-pointer ${selectedProduct?.id === product.id ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}
                  onClick={() => setSelectedProduct(product)}>
                  <h3 className="font-bold">{product.name}</h3>
                  <p className="text-sm text-gray-600">{product.description}</p>
                </div>
              ))}
            </div>
          </div>
          {selectedProduct?.id === 'other' && (
            <div className="mb-4">
              <label htmlFor="otherService" className="form-label font-semibold">Describe your request</label>
              <textarea
                id="otherService"
                value={otherService}
                onChange={(e) => setOtherService(e.target.value)}
                className="form-control mt-1"
                rows={3}
              ></textarea>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : 'Request Booking'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default BookingModal;
