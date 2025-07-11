// frontend/src/components/Calendar.tsx

import { useMemo, useCallback, useState, useEffect } from 'react';
import { Calendar as BigCalendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import enUS from 'date-fns/locale/en-US';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import useSWR from 'swr';
import { apiGet, getPublicAvailability, getBlockedDates } from '../lib/api';
import type { Job, BlockedDate } from '@portal/shared';
import AdminBlockDayModal from './AdminBlockDayModal';
import { jwtDecode } from 'jwt-decode';

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
  resource: Job | { type: 'blocked'; reason?: string | null };
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

// ADDED: UserPayload interface
interface UserPayload {
  role: 'customer' | 'admin';
}

function JobCalendar() {
  const [user, setUser] = useState<UserPayload | null>(null);
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    date: Date | null;
    isBlocked: boolean;
    reason?: string | null;
  }>({ isOpen: false, date: null, isBlocked: false });

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const decodedUser = jwtDecode<UserPayload>(token);
        setUser(decodedUser);
      } catch (e) {
        console.error("Invalid token:", e);
      }
    }
  }, []);


  // Fetch jobs and public availability
  const { data: jobs, error: jobsError, isLoading: jobsLoading } = useSWR<Job[]>('/api/jobs', apiGet);
  const { data: availability, error: availabilityError, isLoading: availabilityLoading } = useSWR('/api/public/availability', getPublicAvailability);
  // NEW: Fetch blocked dates if the user is an admin
  const { data: blockedDates, isLoading: blockedDatesLoading, mutate: mutateBlockedDates } = useSWR(
    user?.role === 'admin' ? '/api/admin/blocked-dates' : null,
    apiGet<BlockedDate[]>
  );


  // useMemo to create a set of admin-blocked date strings for quick lookups
  const adminBlockedDaysSet = useMemo(() => {
    return new Set(blockedDates?.map(d => d.date) || []);
  }, [blockedDates]);

  // useMemo for events needs to be updated to include blocked dates as all-day events for admins
  const events = useMemo(() => {
    const jobEvents = (jobs || []).map(job => ({
      title: job.title,
      start: new Date(job.start),
      end: new Date(job.end),
      resource: job,
    }));

    // For admins, create visible all-day events for blocked dates
    if (user?.role === 'admin') {
      const blockedEvents = (blockedDates || []).map(blocked => ({
        title: `BLOCKED: ${blocked.reason || 'No reason'}`,
        start: new Date(blocked.date + 'T00:00:00'), // Make it an all-day event
        end: new Date(blocked.date + 'T23:59:59'),
        allDay: true,
        resource: { type: 'blocked', reason: blocked.reason },
      }));
      return [...jobEvents, ...blockedEvents];
    }

    return jobEvents;
  }, [jobs, blockedDates, user]);

  // useCallback memoizes the eventPropGetter function for performance.
  const eventPropGetter = useCallback(
    (event: CalendarEvent) => {
      // Custom style for admin-blocked events
      if (typeof event.resource !== 'string' && 'type' in event.resource && event.resource.type === 'blocked') {
        return {
          style: {
            backgroundColor: '#6c757d', // Grey for blocked
            borderColor: '#6c757d',
            color: 'white',
            borderRadius: '5px',
          },
        };
      }
      // Existing job styling
      if (typeof event.resource !== 'string' && 'status' in event.resource) {
        return {
          style: {
            backgroundColor: getEventColor(event.resource.status),
            borderColor: getEventColor(event.resource.status),
            color: 'white',
            borderRadius: '5px',
            opacity: 0.8
          },
        };
      }
      return {};
    },
    []
  );

  // UPDATED: Memoize the set of booked days from the new data structure
  const bookedDaysSet = useMemo(() => {
    return new Set(availability?.bookedDays || []);
  }, [availability]);

  // UPDATED: Add dayPropGetter to apply CSS classes for styling
  const dayPropGetter = useCallback((date: Date) => {
    const day = format(date, 'yyyy-MM-dd');
    const props: { className?: string, style?: React.CSSProperties } = {};

    if (adminBlockedDaysSet.has(day)) {
        // New class for admin-blocked days
        props.className = 'admin-blocked-day';
    } else if (bookedDaysSet.has(day)) {
        props.className = 'darker-day';
    } else {
        props.className = 'lighter-day';
    }

    // Add pointer cursor for admins on all days to indicate clickability
    if(user?.role === 'admin') {
        props.style = { cursor: 'pointer' };
    }

    return props;
  }, [bookedDaysSet, adminBlockedDaysSet, user]);


  // NEW: Handler for when a calendar slot is clicked
  const handleSelectSlot = useCallback((slotInfo: { start: Date }) => {
    if (user?.role === 'admin') {
      const dateStr = format(slotInfo.start, 'yyyy-MM-dd');
      const existingBlock = blockedDates?.find(d => d.date === dateStr);
      setModalState({
        isOpen: true,
        date: slotInfo.start,
        isBlocked: !!existingBlock,
        reason: existingBlock?.reason,
      });
    }
    // Non-admins can't do anything by clicking an empty slot
  }, [user, blockedDates]);


  // Update loading and error states
  if (jobsLoading || availabilityLoading || blockedDatesLoading) return <div className="text-center p-8">Loading calendar...</div>;
  if (jobsError || availabilityError) return <div className="rounded-md bg-red-100 p-4 text-sm text-red-700">{jobsError?.message || availabilityError?.message}</div>;

  return (
    <>
      {modalState.isOpen && modalState.date && (
        <AdminBlockDayModal
          isOpen={modalState.isOpen}
          onClose={() => setModalState({ isOpen: false, date: null, isBlocked: false })}
          selectedDate={modalState.date}
          isBlocked={modalState.isBlocked}
          reason={modalState.reason}
          onUpdate={() => {
            // Re-fetch the data to update the UI
            mutateBlockedDates();
          }}
        />
      )}
      <div className="bg-white dark:bg-tertiary-dark p-4 rounded-lg shadow" style={{ height: '85vh' }}>
        <BigCalendar
          localizer={localizer}
          events={events}
          eventPropGetter={eventPropGetter}
          dayPropGetter={dayPropGetter}
          startAccessor="start"
          endAccessor="end"
          style={{ height: '100%' }}
          selectable={user?.role === 'admin'} // Make calendar selectable only for admins
          onSelectSlot={handleSelectSlot}
        />
      </div>
    </>
  );
}

export default JobCalendar;
