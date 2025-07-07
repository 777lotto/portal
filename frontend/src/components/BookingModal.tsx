import { useState } from 'react';
import { createPublicBooking } from '../lib/api';
import { format } from 'date-fns';

// Add the global window type definition for the Turnstile callback
// This should match the working implementation in your other forms.
declare global {
  interface Window {
    onTurnstileSuccess?: (token: string) => void;
  }
}

interface ServiceOption {
  id: string;
  name: string;
  duration: number; // in hours
}

const serviceOptions: ServiceOption[] = [
    { id: 'gc-res', name: 'Gutter Cleaning (Residential)', duration: 2 },
    { id: 'gc-com', name: 'Gutter Cleaning (Commercial)', duration: 8 },
    { id: 'pw-res', name: 'Pressure Washing (Residential)', duration: 4 },
    { id: 'pw-com', name: 'Pressure Washing (Commercial)', duration: 8 },
    { id: 'rg-res', name: 'Roof or Gutter Repair (Residential)', duration: 3 },
    { id: 'rg-com', name: 'Roof or Gutter Repair (Commercial)', duration: 4 },
    { id: 'gi-res', name: 'Gutter Install (Residential)', duration: 8 },
    { id: 'gi-com', name: 'Gutter Install (Commercial)', duration: 8 },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date;
}

function BookingModal({ isOpen, onClose, selectedDate }: Props) {
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', address: '' });
  const [selectedServices, setSelectedServices] = useState<ServiceOption[]>([]);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // This hook creates the callback function that your Zaraz script calls
  useEffect(() => {
    if (isOpen) {
      window.onTurnstileSuccess = (token: string) => {
        setTurnstileToken(token);
      };
    }
    // Cleanup the function when the component unmounts or the modal closes
    return () => {
      delete window.onTurnstileSuccess;
    };
  }, [isOpen]); // Re-run the effect if the modal is opened

  const handleServiceChange = (service: ServiceOption) => {
    setSelectedServices(prev =>
      prev.some(s => s.id === service.id)
        ? prev.filter(s => s.id !== service.id)
        : [...prev, service]
    );
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedServices.length === 0) {
      setError('Please select at least one service.');
      return;
    }
    // Check for the turnstile token before allowing submission
    if (!turnstileToken) {
      setError("Please wait for the security check to complete.");
      return;
    }
    setError('');
    setSuccess('');
    setIsSubmitting(true);

    try {
      await createPublicBooking({
        ...formData,
        date: format(selectedDate, 'yyyy-MM-dd'),
        services: selectedServices.map(({name, duration}) => ({name, duration})),
        'cf-turnstile-response': turnstileToken,
      });
      setSuccess('Your booking request has been sent! We will contact you shortly to confirm.');
      setTimeout(() => {
        onClose();
        setSuccess('');
        setTurnstileToken('');
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'An unknown error occurred.');
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
          {/* Services Selection */}
          <div className="mb-4">
            <label className="font-bold">Services</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
              {serviceOptions.map(service => (
                <label key={service.id} className="flex items-center space-x-2 p-2 border rounded-md">
                  <input type="checkbox" onChange={() => handleServiceChange(service)} />
                  <span>{service.name} ({service.duration} hrs)</span>
                </label>
              ))}
            </div>
          </div>

          {/* User Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <input name="name" placeholder="Full Name" onChange={handleChange} className="form-control" required />
            <input name="email" type="email" placeholder="Email Address" onChange={handleChange} className="form-control" required />
            <input name="phone" type="tel" placeholder="Phone Number" onChange={handleChange} className="form-control" required />
            <input name="address" placeholder="Service Address" onChange={handleChange} className="form-control md:col-span-2" required />
          </div>

          {/* This container will be populated by your Zaraz script */}
          <div className="mb-3 d-flex justify-content-center" id="turnstile-container"></div>

          <div className="flex justify-end space-x-4">
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
            {/* The button is disabled until the turnstile token is received */}
            <button type="submit" className="btn btn-primary" disabled={isSubmitting || !turnstileToken}>
              {isSubmitting ? 'Submitting...' : 'Request Booking'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default BookingModal;
