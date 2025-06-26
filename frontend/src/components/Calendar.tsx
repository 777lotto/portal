import { useState, useEffect } from 'react';
import { Calendar as BigCalendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { getJobs } from '../lib/api';
import type { Job } from '@portal/shared';

const localizer = momentLocalizer(moment);

interface CalendarEvent {
  title: string;
  start: Date;
  end: Date;
  resource: Job;
}

function JobCalendar() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setError("Not authenticated.");
      setIsLoading(false);
      return;
    }

    const fetchJobs = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const jobs = await getJobs(token);
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

  return (
    <div className="container mt-4" style={{ height: '80vh' }}>
      <h2>Job Calendar</h2>
      <BigCalendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        style={{ height: '100%' }}
      />
    </div>
  );
}

export default JobCalendar;
