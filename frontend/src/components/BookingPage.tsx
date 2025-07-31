
import { useState } from 'react';
import UnifiedCalenedar from './UnifiedCalenedar';
import BookingModal from './modals/BookingModal';
import { useAuth } from '../hooks/useAuth';

const CalendarLegend = () => (
  <div className="mb-4 flex space-x-4 p-2 rounded-md bg-secondary-light dark:bg-secondary-dark">
    <div className="flex items-center"><span className="inline-block w-4 h-4 bg-gray-300 mr-2"></span> Unavailable</div>
    <div className="flex items-center"><span className="inline-block w-4 h-4 bg-stripes-blue mr-2"></span> Pending</div>
    <div className="flex items-center"><span className="inline-block w-4 h-4 bg-primary-light dark:bg-tertiary-dark border mr-2"></span> Available</div>
  </div>
);

const BookingTutorial = ({ onClose }: { onClose: () => void }) => (
    <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4 mb-4 relative" role="alert">
      <button onClick={onClose} className="absolute top-0 right-0 mt-2 mr-2 text-blue-500 hover:text-blue-700">
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      <p className="font-bold">How to book your next service:</p>
      <ol className="list-decimal list-inside">
        <li>Click on an available day on the calendar.</li>
        <li>Select the service(s) you need.</li>
        <li>Confirm your details and submit the request.</li>
      </ol>
    </div>
  );

function BookingPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const { user, isLoading, error, token } = useAuth();
  const [showTutorial, setShowTutorial] = useState(true);

  const handleSelectSlot = (slotInfo: { start: Date }) => {
    setSelectedDate(slotInfo.start);
    setModalOpen(true);
  };

  if (isLoading) return <div className="text-center p-8">Loading...</div>;
  if (error) return <div className="rounded-md bg-event-red/10 p-4 text-sm text-event-red">{error}</div>;

  return (
    <div className="container mt-4">
      <h1 className="text-3xl font-bold mb-4">{token ? 'Schedule Your Next Service' : 'Book a Service'}</h1>
      {token && <CalendarLegend />}
      {token && showTutorial && <BookingTutorial onClose={() => setShowTutorial(false)} />}
      <p className="mb-4">Select an available day on the calendar to start your booking request.</p>
      <UnifiedCalenedar onSelectSlot={handleSelectSlot} isCustomer={!!token} />
      {selectedDate && (
        <BookingModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          selectedDate={selectedDate}
          user={user}
        />
      )}
    </div>
  );
}

export default BookingPage;
