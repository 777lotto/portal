import { useState, useEffect } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { apiGet } from '../lib/api';
import { Job } from '@portal/shared';

// Setup the localizer for Big Calendar
const localizer = momentLocalizer(moment);

// Convert Job to Calendar Event format
interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  resource: Job; // Store the original job data
}

export default function JobCalendar() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const token = localStorage.getItem('token')!;

  useEffect(() => {
    async function fetchJobs() {
      try {
        setLoading(true);
        const jobs = await apiGet('/jobs', token);

        // Convert jobs to calendar events
        const calendarEvents = jobs.map((job: Job) => ({
          id: job.id,
          title: job.title,
          start: new Date(job.start),
          end: new Date(job.end),
          allDay: false,
          resource: job,
        }));

        setEvents(calendarEvents);
      } catch (err: any) {
        setError(err.message || 'Failed to load calendar events');
      } finally {
        setLoading(false);
      }
    }

    fetchJobs();
  }, [token]);

  const handleSelectEvent = (event: CalendarEvent) => {
    // Navigate to job detail page
    window.location.href = `/jobs/${event.id}`;
  };

  if (loading) return <div>Loading calendar...</div>;
  if (error) return <div style={{ color: 'red' }}>{error}</div>;

  return (
    <div style={{ height: '600px', padding: '1rem' }}>
      <h1>Your Service Schedule</h1>
      <div style={{ height: 'calc(100% - 60px)' }}>
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ width: '100%', height: '100%' }}
          onSelectEvent={handleSelectEvent}
          views={['month', 'week', 'day', 'agenda']}
          defaultView="month"
        />
      </div>
    </div>
  );
}
