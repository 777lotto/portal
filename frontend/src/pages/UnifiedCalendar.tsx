import React, { useState, useEffect } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import enUS from 'date-fns/locale/en-US';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { useAuth } from '../hooks/useAuth';
import { apiGet, apiPost } from '../lib/api';
import type { Job } from '@portal/shared';
// UPDATE: Import the consolidated AddJobModal
import AddJobModal from '../components/modals/admin/AddJobModal';
import BookingModal from '../components/modals/BookingModal';

// --- Calendar Sync Modal Component (No changes here) ---
const CalendarSyncModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void; }) => {
  const { user } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const calendarUrl = token ? `${window.location.origin}/api/jobs/calendar/${token}/events.ics` : '';

  useEffect(() => {
    if (isOpen) {
      const fetchToken = async () => {
        setLoading(true);
        setError(null);
        setSuccessMessage(null);
        try {
          const response = await apiGet<{ token: string }>('/api/users/calendar-token');
          setToken(response.token);
        } catch (err: any) {
          setError(err.message || 'Failed to fetch calendar token.');
        } finally {
          setLoading(false);
        }
      };
      fetchToken();
    }
  }, [isOpen]);

  const handleCopy = () => {
    navigator.clipboard.writeText(calendarUrl).then(() => {
      setSuccessMessage('URL copied to clipboard!');
      setTimeout(() => setSuccessMessage(null), 3000);
    }, () => {
      setError('Failed to copy URL.');
      setTimeout(() => setError(null), 3000);
    });
  };

  const handleRegenerate = async () => {
    if (!window.confirm('Are you sure? Regenerating the URL will invalidate the old one.')) {
      return;
    }
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const response = await apiPost<{ token: string }>('/api/users/calendar-token');
      setToken(response.token);
      setSuccessMessage('Successfully generated a new calendar URL.');
    } catch (err: any) {
      setError(err.message || 'Failed to regenerate token.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-tertiary-dark rounded-lg shadow-xl w-full max-w-lg">
        <div className="p-4 border-b border-border-light dark:border-border-dark flex justify-between items-center">
          <h2 className="text-xl font-bold">Sync Your Calendar</h2>
          <button onClick={onClose} className="text-2xl font-bold">&times;</button>
        </div>
        <div className="p-4 space-y-4">
          {loading && <p>Loading...</p>}
          {error && <div className="bg-red-100 text-red-700 p-3 rounded">{error}</div>}
          {successMessage && <div className="bg-green-100 text-green-700 p-3 rounded">{successMessage}</div>}

          <p>You can subscribe to your jobs using any calendar application that supports iCalendar (.ics) feeds, like Google Calendar, Apple Calendar, or Outlook.</p>
          <p className="font-bold text-red-500">Warning: This URL is secret. Anyone who has it can see your job calendar.</p>

          <div>
            <label htmlFor="calendar-url" className="form-label">Your Personal Calendar Feed</label>
            <input
              id="calendar-url"
              type="text"
              readOnly
              value={calendarUrl}
              className="form-control"
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <button onClick={handleCopy} className="btn btn-primary" disabled={loading || !token}>Copy URL</button>
            <button onClick={handleRegenerate} className="btn btn-danger" disabled={loading}>Regenerate URL</button>
          </div>
        </div>
      </div>
    </div>
  );
};


// --- Main Calendar Page Component ---
const locales = {
  'en-US': enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

interface CalendarEvent {
  title: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  resource?: any;
}

export default function UnifiedCalendar() {
  const { user } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isAddJobModalOpen, setAddJobModalOpen] = useState(false);
  const [isBookingModalOpen, setBookingModalOpen] = useState(false);
  const [isSyncModalOpen, setSyncModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const fetchJobs = async () => {
    try {
      const jobs = await apiGet<Job[]>('/api/jobs');
      const calendarEvents = jobs.map((job) => ({
        title: job.title,
        start: new Date(job.start),
        end: new Date(job.end),
      }));
      setEvents(calendarEvents);
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const handleSelectSlot = ({ start }: { start: Date }) => {
    setSelectedDate(start);
    if (user?.role === 'admin') {
      setAddJobModalOpen(true);
    } else {
      setBookingModalOpen(true);
    }
  };

  const handleModalClose = () => {
    setAddJobModalOpen(false);
    setBookingModalOpen(false);
    fetchJobs(); // Refetch jobs when a modal is closed
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Calendar</h1>
        <button onClick={() => setSyncModalOpen(true)} className="btn btn-primary">
          Sync Calendar
        </button>
      </div>
      <div className="h-[80vh]">
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: '100%' }}
          onSelectSlot={handleSelectSlot}
          selectable
        />
      </div>

      {/* Render all modals */}
      <CalendarSyncModal isOpen={isSyncModalOpen} onClose={() => setSyncModalOpen(false)} />

      {/* UPDATE: Use the new AddJobModal */}
      {user?.role === 'admin' && (
        <AddJobModal
          isOpen={isAddJobModalOpen}
          onClose={handleModalClose}
          onSave={handleModalClose}
          selectedDate={selectedDate}
        />
      )}
      {user?.role !== 'admin' && (
        <BookingModal
          isOpen={isBookingModalOpen}
          onClose={handleModalClose}
          selectedDate={selectedDate}
        />
      )}
    </div>
  );
}
