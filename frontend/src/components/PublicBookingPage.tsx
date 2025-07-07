import { useState } from 'react';
import BookingCalendar from './BookingCalendar';
import BookingModal from './BookingModal';

function PublicBookingPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const handleSelectSlot = (slotInfo: { start: Date }) => {
    setSelectedDate(slotInfo.start);
    setModalOpen(true);
  };

  return (
    <div className="container mt-4">
      <h1 className="text-3xl font-bold mb-4">Book a Service</h1>
      <p className="mb-4">Select an available day on the calendar to start your booking request.</p>
      <BookingCalendar onSelectSlot={handleSelectSlot} />
      {selectedDate && (
        <BookingModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          selectedDate={selectedDate}
        />
      )}
    </div>
  );
}

export default PublicBookingPage;
