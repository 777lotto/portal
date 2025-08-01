import 'react-big-calendar/lib/css/react-big-calendar.css';
import { Calendar as BigCalendar, momentLocalizer, Views } from 'react-big-calendar';
import moment from 'moment';
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import useSWR from 'swr';
import { format } from 'date-fns';

// Utilities and Hooks
import { apiGet } from '../lib/api';
import { useAuth } from '../hooks/useAuth';

// Shared Types
import { Job, CalendarEvent as ApiCalendarEvent } from '@portal/shared';

// Modals
import AddJobModal from '../components/modals/admin/AddJobModal';
import BlockDayModal from '../components/modals/admin/AdminBlockDayModal';
import BookingModal from '../components/modals/BookingModal';

const localizer = momentLocalizer(moment);

interface CalendarEvent {
  title: string;
  start: Date;
  end: Date;
  resource: Job | ApiCalendarEvent;
}

// Helper functions for SWR
const getPublicAvailability = (url: string) => apiGet<{ bookedDays: string[] }>(url);
const getCustomerAvailability = (url: string) => apiGet<{ bookedDays: string[], pendingDays: string[] }>(url);

export default function UnifiedCalendar() {
  const { user } = useAuth();
  const [modalState, setModalState] = useState({
    addJobModalOpen: false,
    blockDayModalOpen: false,
    bookingModalOpen: false,
  });
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(document.documentElement.classList.contains('dark'));

  // --- Data Fetching ---
  const { data: jobs, mutate: mutateJobs } = useSWR<Job[]>(user?.role === 'admin' ? '/api/jobs' : null, apiGet);
  const { data: availability } = useSWR(user ? '/api/availability' : '/api/public/availability', user ? getCustomerAvailability : getPublicAvailability);
  const { data: calendarEvents, mutate: mutateCalendarEvents } = useSWR<ApiCalendarEvent[]>(user?.role === 'admin' ? '/api/admin/calendar-events' : null, apiGet);

  // --- Dark Mode Change Detection ---
  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          const newIsDarkMode = document.documentElement.classList.contains('dark');
          if (isDarkMode !== newIsDarkMode) {
            setIsDarkMode(newIsDarkMode);
          }
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });

    return () => observer.disconnect();
  }, [isDarkMode]);

  // --- Memoized Event & Day Computations ---
  useEffect(() => {
    if (user?.role === 'admin' && jobs && calendarEvents) {
      const jobEvents: CalendarEvent[] = jobs.map(job => ({
        title: `${job.customer.firstName} ${job.customer.lastName}`,
        start: new Date(job.startTime),
        end: new Date(job.endTime),
        resource: job,
      }));

      const blockedEvents: CalendarEvent[] = calendarEvents
        .filter(event => event.type === 'blocked')
        .map(event => ({
          title: event.reason || 'Blocked',
          start: new Date(event.start),
          end: new Date(event.end),
          resource: event,
        }));
      setEvents([...jobEvents, ...blockedEvents]);
    }
  }, [jobs, calendarEvents, user]);

  const { bookedDaysSet, pendingDaysSet, adminBlockedDaysSet } = useMemo(() => {
    const bookedDays = new Set(availability?.bookedDays || []);
    const pendingDays = new Set(user ? (availability as any)?.pendingDays || [] : []);
    const adminBlocked = new Set(calendarEvents?.filter(e => e.type === 'blocked').map(e => e.start.split('T')[0]) || []);
    return { bookedDaysSet: bookedDays, pendingDaysSet: pendingDays, adminBlockedDaysSet: adminBlocked };
  }, [availability, calendarEvents, user]);

   // --- Calendar Prop Getters (with Tailwind) ---
  const dayPropGetter = useCallback((date: Date) => {
    const day = format(date, 'yyyy-MM-dd');
    let className = 'bg-gray-50 dark:bg-gray-800'; // Default day background with dark mode

    if (adminBlockedDaysSet.has(day)) {
      className = 'bg-red-200 dark:bg-red-900/40';
      if (user?.role !== 'admin') {
        className += ' cursor-not-allowed';
      }
    } else if (bookedDaysSet.has(day)) {
      className = 'bg-gray-300 dark:bg-gray-600 cursor-not-allowed';
    } else if (pendingDaysSet.has(day)) {
      className = 'bg-stripes-blue'; // Custom striped background
    }

    return {
      className: className,
      style: {
        cursor: user ? 'pointer' : 'default',
      }
    };
  }, [bookedDaysSet, pendingDaysSet, adminBlockedDaysSet, user]);

  const eventPropGetter = useCallback((event: CalendarEvent) => {
    const isJob = 'customer' in event.resource;
    const className = isJob
      ? 'bg-blue-500 hover:bg-blue-600 border-blue-500'
      : 'bg-gray-500 hover:bg-gray-600 border-gray-500';

    return {
      className: `${className} text-white p-1 rounded-lg`,
    };
  }, []);


  // --- Event Handlers ---
  const handleSelectSlot = useCallback((slotInfo: { start: Date }) => {
    const dateStr = format(slotInfo.start, 'yyyy-MM-dd');
    if (adminBlockedDaysSet.has(dateStr) || bookedDaysSet.has(dateStr)) {
      return;
    }
    setSelectedDate(slotInfo.start);
    if (user?.role === 'admin') {
      setModalState(prevState => ({ ...prevState, addJobModalOpen: true }));
    } else {
      setModalState(prevState => ({ ...prevState, bookingModalOpen: true }));
    }
  }, [user, adminBlockedDaysSet, bookedDaysSet]);

  const handleSelectEvent = (event: CalendarEvent) => {
    if ('customer' in event.resource) {
        setSelectedJob(event.resource);
    }
  };

  // --- Modal Management ---
  const handleCloseModals = () => {
    setModalState({ addJobModalOpen: false, blockDayModalOpen: false, bookingModalOpen: false });
    setSelectedDate(null);
    setSelectedJob(null);
  };

  const handleBlockDay = () => {
    setModalState({ addJobModalOpen: false, blockDayModalOpen: true, bookingModalOpen: false });
  };


  return (
    <div className="p-4 bg-white dark:bg-gray-900 rounded-lg shadow-md">
      <BigCalendar
        key={isDarkMode.toString()} // Force re-render on theme change
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        style={{ height: 'calc(100vh - 120px)' }}
        views={[Views.MONTH, Views.WEEK, Views.DAY]}
        selectable={!!user}
        onSelectSlot={handleSelectSlot}
        onSelectEvent={handleSelectEvent}
        dayPropGetter={dayPropGetter}
        eventPropGetter={eventPropGetter}
        className="font-sans"
      />

      {/* --- Modals --- */}
      {selectedDate && user?.role === 'admin' && (
        <>
          <AddJobModal isOpen={modalState.addJobModalOpen} onClose={handleCloseModals} onBlockDay={handleBlockDay} selectedDate={selectedDate} mutateJobs={mutateJobs} />
          <BlockDayModal isOpen={modalState.blockDayModalOpen} onClose={handleCloseModals} selectedDate={selectedDate} mutateCalendarEvents={mutateCalendarEvents} />
        </>
      )}
      {selectedDate && (user?.role !== 'admin') && (
          <BookingModal isOpen={modalState.bookingModalOpen} onClose={handleCloseModals} selectedDate={selectedDate} />
      )}
      {selectedJob && (
        <JobSummaryModal isOpen={!!selectedJob} onClose={() => setSelectedJob(null)} job={selectedJob} />
      )}
    </div>
  );
}
