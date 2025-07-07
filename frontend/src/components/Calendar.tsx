// frontend/src/components/Calendar.tsx

import { useMemo, useCallback } from 'react';
import { Calendar as BigCalendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import enUS from 'date-fns/locale/en-US';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import useSWR from 'swr';
import { apiGet, getPublicAvailability } from '../lib/api';
import type { Job } from '@portal/shared';

// 1. Configure the modern date-fns localizer
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
  resource: Job;
}

// Helper to determine event color based on the status
const getEventColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'upcoming': return '#ffc107'; // Yellow
    case 'confirmed': return '#0d6efd'; // Blue
    case 'completed': return '#198754'; // Green
    case 'payment_pending': return '#fd7e14'; // Orange
    case 'past_due': return '#dc3545'; // Red
    case 'cancelled': return '#6c757d'; // Grey
    default: return '#6c757d'; // Default to grey
  }
};

function JobCalendar() {
  // Fetch both jobs and public availability
  const { data: jobs, error: jobsError, isLoading: jobsLoading } = useSWR<Job[]>('/api/jobs', apiGet);
  const { data: availability, error: availabilityError, isLoading: availabilityLoading } = useSWR('/api/public/availability', getPublicAvailability);

  // useMemo ensures the events array is only recalculated when the jobs data changes.
  const events = useMemo(() => {
    if (!jobs) return [];
    return jobs.map(job => ({
      title: job.title,
      start: new Date(job.start),
      end: new Date(job.end),
      resource: job,
    }));
  }, [jobs]);

  // useCallback memoizes the eventPropGetter function for performance.
  const eventPropGetter = useCallback(
    (event: CalendarEvent) => ({
      style: {
        backgroundColor: getEventColor(event.resource.status),
        borderColor: getEventColor(event.resource.status),
        color: 'white',
        borderRadius: '5px',
        opacity: 0.8
      },
    }),
    []
  );

  // NEW: Memoize the set of unavailable days
  const unavailableDaysSet = useMemo(() => {
    return new Set(availability?.unavailableDays || []);
  }, [availability]);

  // NEW: Add dayPropGetter to style the background of calendar days
  const dayPropGetter = useCallback((date: Date) => {
    const day = format(date, 'yyyy-MM-dd');
    if (unavailableDaysSet.has(day)) {
      return {
        style: {
          backgroundColor: 'rgba(52, 58, 64, 0.1)', // Light grey for unavailable
        },
      };
    }
    return {};
  }, [unavailableDaysSet]);

  // Update loading and error states
  if (jobsLoading || availabilityLoading) return <div className="text-center p-8">Loading calendar...</div>;
  if (jobsError || availabilityError) return <div className="rounded-md bg-red-100 p-4 text-sm text-red-700">{jobsError?.message || availabilityError?.message}</div>;

  return (
    <div className="bg-white dark:bg-tertiary-dark p-4 rounded-lg shadow" style={{ height: '85vh' }}>
      <BigCalendar
        localizer={localizer}
        events={events}
        eventPropGetter={eventPropGetter}
        dayPropGetter={dayPropGetter}
        startAccessor="start"
        endAccessor="end"
        style={{ height: '100%' }}
      />
    </div>
  );
}

export default JobCalendar;

