import 'react-big-calendar/lib/css/react-big-calendar.css';
import { Calendar as BigCalendar, momentLocalizer, Views } from 'react-big-calendar';
import moment from 'moment';
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import useSWR from 'swr';
import { format } from 'date-fns';

// Utilities and Hooks
import { api } from '../lib/api';
import { ApiError } from '../lib/fetchJson';
import { useAuth } from '../hooks/useAuth';

// Shared Types
import { Job, CalendarEvent as ApiCalendarEvent } from '@portal/shared';

// Modals
import NewAddJobModal from '../components/modals/admin/NewAddJobModal';
import AdminBlockDayModal from '../components/modals/admin/AdminBlockDayModal';
import BookingModal from '../components/modals/BookingModal';
// NOTE: JobSummaryModal was not provided, so it's commented out for now.
// import JobSummaryModal from '../components/modals/JobSummaryModal';

const localizer = momentLocalizer(moment);

interface CalendarDisplayEvent {
  title: string;
  start: Date;
  end: Date;
  resource: Job | ApiCalendarEvent;
}

// --- SWR Fetcher Functions ---
const fetcher = async (url: string) => {
    // This is a generic fetcher that can be adapted
    const route = url.replace('/api/', '').split('/');
    let res;
    if (route[0] === 'admin') {
        // @ts-ignore
        res = await api.admin[route[1]].$get();
    } else {
        // @ts-ignore
        res = await api[route[0]].$get();
    }
    if (!res.ok) throw new Error('Failed to fetch data');
    return res.json();
};

const getPublicAvailability = () => fetcher('/api/public/availability');
const getCustomerAvailability = () => fetcher('/api/availability');
const getAdminCalendarEvents = () => fetcher('/api/admin/calendar-events');
const getAllAdminJobs = () => fetcher('/api/admin/jobs');


export default function UnifiedCalendar({ onSelectSlot: onSelectSlotProp, isCustomer }: { onSelectSlot?: (slotInfo: { start: Date }) => void, isCustomer?: boolean }) {
  const { user } = useAuth();
  const [modalState, setModalState] = useState({
    addJobModalOpen: false,
    blockDayModalOpen: false,
    bookingModalOpen: false,
  });
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEventForBlock, setSelectedEventForBlock] = useState<ApiCalendarEvent | null>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [events, setEvents] = useState<CalendarDisplayEvent[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(document.documentElement.classList.contains('dark'));

  // --- Data Fetching ---
  const { data: jobs, mutate: mutateJobs } = useSWR<Job[]>(user?.role === 'admin' ? '/api/admin/jobs' : null, getAllAdminJobs);
  const { data: availability } = useSWR(user ? '/api/availability' : '/api/public/availability', user ? getCustomerAvailability : getPublicAvailability);
  const { data: calendarEvents, mutate: mutateCalendarEvents } = useSWR<ApiCalendarEvent[]>(user?.role === 'admin' ? '/api/admin/calendar-events' : null, getAdminCalendarEvents);

  // --- Dark Mode Change Detection ---
  useEffect(() => {
    const observer = new MutationObserver(() => {
        setIsDarkMode(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // --- Memoized Event & Day Computations ---
  useEffect(() => {
    if (user?.role === 'admin' && jobs && calendarEvents) {
      const jobEvents: CalendarDisplayEvent[] = jobs.map(job => ({
        title: job.title || 'Untitled Job',
        start: new Date(job.start),
        end: new Date(job.end),
        resource: job,
      }));

      const blockedEvents: CalendarDisplayEvent[] = calendarEvents
        .filter(event => event.type === 'blocked')
        .map(event => ({
          title: event.title || 'Blocked',
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

   // --- Calendar Prop Getters ---
  const dayPropGetter = useCallback((date: Date) => {
    const day = format(date, 'yyyy-MM-dd');
    let className = '';

    if (adminBlockedDaysSet.has(day)) {
      className = 'admin-blocked-day';
    } else if (bookedDaysSet.has(day)) {
      className = 'darker-day';
    } else if (pendingDaysSet.has(day)) {
      className = 'bg-stripes-blue';
    } else {
      className = 'lighter-day';
    }
    return { className };
  }, [bookedDaysSet, pendingDaysSet, adminBlockedDaysSet]);

  const eventPropGetter = useCallback((event: CalendarDisplayEvent) => {
    const isJob = 'user_id' in event.resource && event.resource.type !== 'blocked';
    const className = isJob
      ? 'bg-event-blue hover:bg-event-blue/90 border-event-blue'
      : 'bg-gray-500 hover:bg-gray-600 border-gray-500';
    return { className: `${className} text-white p-1 rounded-lg` };
  }, []);

  // --- Event Handlers ---
  const handleSelectSlot = useCallback((slotInfo: { start: Date }) => {
    if (onSelectSlotProp) {
        onSelectSlotProp(slotInfo);
        return;
    }
    const dateStr = format(slotInfo.start, 'yyyy-MM-dd');
    if (adminBlockedDaysSet.has(dateStr) || bookedDaysSet.has(dateStr)) return;

    setSelectedDate(slotInfo.start);
    if (user?.role === 'admin') {
      setModalState(prevState => ({ ...prevState, addJobModalOpen: true }));
    } else {
      setModalState(prevState => ({ ...prevState, bookingModalOpen: true }));
    }
  }, [user, adminBlockedDaysSet, bookedDaysSet, onSelectSlotProp]);

  const handleSelectEvent = (event: CalendarDisplayEvent) => {
    if (user?.role === 'admin' && event.resource.type === 'blocked') {
        setSelectedDate(event.start);
        setSelectedEventForBlock(event.resource as ApiCalendarEvent);
        setModalState(prevState => ({ ...prevState, blockDayModalOpen: true }));
    } else if ('user_id' in event.resource) {
        // This would open a Job Summary modal, which was not provided.
        // setSelectedJob(event.resource as Job);
    }
  };

  // --- Modal Management ---
  const handleCloseModals = () => {
    setModalState({ addJobModalOpen: false, blockDayModalOpen: false, bookingModalOpen: false });
    setSelectedDate(null);
    setSelectedJob(null);
    setSelectedEventForBlock(null);
  };

  const refreshData = () => {
      mutateJobs();
      mutateCalendarEvents();
  }

  return (
    <div className="p-4 bg-white dark:bg-gray-900 rounded-lg shadow-md">
      <BigCalendar
        key={isDarkMode.toString()}
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
          <NewAddJobModal isOpen={modalState.addJobModalOpen} onClose={handleCloseModals} onSave={refreshData} selectedDate={selectedDate} />
          <AdminBlockDayModal
            isOpen={modalState.blockDayModalOpen}
            onClose={handleCloseModals}
            selectedDate={selectedDate}
            isBlocked={!!selectedEventForBlock}
            eventId={selectedEventForBlock?.id}
            reason={selectedEventForBlock?.title}
            onUpdate={refreshData}
          />
        </>
      )}
      {selectedDate && !user && (
          <BookingModal isOpen={modalState.bookingModalOpen} onClose={handleCloseModals} selectedDate={selectedDate} />
      )}
      {/* {selectedJob && (
        <JobSummaryModal isOpen={!!selectedJob} onClose={() => setSelectedJob(null)} job={selectedJob} />
      )} */}
    </div>
  );
}
