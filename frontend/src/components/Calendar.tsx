// frontend/src/components/Calendar.tsx - CORRECTED

import { useState, useEffect, useCallback } from 'react';
import { Calendar as BigCalendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { getJobs } from '../lib/api.js';
import type { Job } from '@portal/shared';

const localizer = momentLocalizer(moment);

interface CalendarEvent {
  title: string;
  start: Date;
  end: Date;
  resource: Job;
}

// Helper to determine event color based on the new status list
const getEventColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'upcoming':
      return '#ffc107'; // Yellow
    case 'confirmed':
      return '#0d6efd'; // Blue
    case 'completed': // This now means "completed and paid"
      return '#198754'; // Green
    case 'payment_pending': // New status for "job complete, payment incomplete"
      return '#fd7e14'; // Orange
    case 'past_due': // New status for "past due payment"
      return '#dc3545'; // Red
    case 'cancelled':
      return '#6c757d'; // Grey
    default:
      return '#6c757d'; // Default to grey
  }
};

function JobCalendar() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const jobs = await getJobs();
        const calendarEvents = jobs.map(job => ({
          title: job.title,
          start: new Date(job.start),
          end: new Date(job.end),
          resource: job
        }));
        setEvents(calendarEvents);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchJobs();
  }, []);

  if (isLoading) return <div className="container mt-4">Loading calendar...</div>;
  if (error) return <div className="container mt-4 alert alert-danger">{error}</div>;

  const eventPropGetter = useCallback(
    (event: CalendarEvent) => ({
      style: {
        backgroundColor: getEventColor(event.resource.status),
        borderColor: getEventColor(event.resource.status),
      },
    }),
    []
  );

  return (
    <div className="container mt-4" style={{ height: '80vh' }}>
      <h2>Job Calendar</h2>
      <BigCalendar
        localizer={localizer}
        events={events}
        eventPropGetter={eventPropGetter}
        startAccessor="start"
        endAccessor="end"
        style={{ height: '100%' }}
      />
    </div>
  );
}

export default JobCalendar;
