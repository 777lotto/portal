import 'react-big-calendar/lib/css/react-big-calendar.css';
import { Calendar as BigCalendar, momentLocalizer, Views } from 'react-big-calendar';
import moment from 'moment';
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import useSWR from 'swr';
import { format } from 'date-fns';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { Job, CalendarEvent as ApiCalendarEvent } from '@portal/shared';
import NewAddJobModal from '../components/modals/admin/NewAddJobModal';
import AdminBlockDayModal from '../components/modals/admin/AdminBlockDayModal';
import BookingModal from '../components/modals/BookingModal';

const localizer = momentLocalizer(moment);

interface CalendarDisplayEvent {
  title: string;
  start: Date;
  end: Date;
  resource: Job | ApiCalendarEvent;
}

// --- REFACTORED SWR Fetcher Functions ---
const publicAvailabilityFetcher = () => api.public.availability.$get();
const customerAvailabilityFetcher = () => api.availability.$get();
const adminCalendarEventsFetcher = () => api.admin['calendar-events'].$get();
const adminJobsFetcher = () => api.admin.jobs.$get();

export default function UnifiedCalendar({ onSelectSlot: onSelectSlotProp }: { onSelectSlot?: (slotInfo: { start: Date }) => void }) {
  const { user } = useAuth();
  const [modalState, setModalState] = useState({ addJobModalOpen: false, blockDayModalOpen: false, bookingModalOpen: false });
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEventForBlock, setSelectedEventForBlock] = useState<ApiCalendarEvent | null>(null);
  const [events, setEvents] = useState<CalendarDisplayEvent[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(document.documentElement.classList.contains('dark'));

  // --- Data Fetching with new SWR fetchers ---
  const { data: jobs, mutate: mutateJobs } = useSWR<Job[]>(user?.role === 'admin' ? '/api/admin/jobs' : null, adminJobsFetcher);
  const { data: availability } = useSWR(user ? '/api/availability' : '/api/public/availability', user ? customerAvailabilityFetcher : publicAvailabilityFetcher);
  const { data: calendarEvents, mutate: mutateCalendarEvents } = useSWR<ApiCalendarEvent[]>(user?.role === 'admin' ? '/api/admin/calendar-events' : null, adminCalendarEventsFetcher);

  useEffect(() => {
    const observer = new MutationObserver(() => setIsDarkMode(document.documentElement.classList.contains('dark')));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

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

  const dayPropGetter = useCallback((date: Date) => {
    const day = format(date, 'yyyy-MM-dd');
    let className = '';
    if (adminBlockedDaysSet.has(day)) className = 'admin-blocked-day';
    else if (bookedDaysSet.has(day)) className = 'darker-day';
    else if (pendingDaysSet.has(day)) className = 'bg-stripes-blue';
    else className = 'lighter-day';
    return { className };
  }, [bookedDaysSet, pendingDaysSet, adminBlockedDaysSet]);

  const eventPropGetter = useCallback((event: CalendarDisplayEvent) => {
    const isJob = 'user_id' in event.resource && event.resource.type !== 'blocked';
    const className = isJob ? 'bg-blue-500 hover:bg-blue-600 border-blue-500' : 'bg-gray-500 hover:bg-gray-600 border-gray-500';
    return { className: `${className} text-white p-1 rounded-lg` };
  }, []);

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
    }
    // Logic for selecting a job event can be added here
  };

  const handleCloseModals = () => {
    setModalState({ addJobModalOpen: false, blockDayModalOpen: false, bookingModalOpen: false });
    setSelectedDate(null);
    setSelectedEventForBlock(null);
  };

  const refreshData = () => {
      if (user?.role === 'admin') {
        mutateJobs();
        mutateCalendarEvents();
      }
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
        selectable={true}
        onSelectSlot={handleSelectSlot}
        onSelectEvent={handleSelectEvent}
        dayPropGetter={dayPropGetter}
        eventPropGetter={eventPropGetter}
        className="font-sans"
      />

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
      {selectedDate && (
          <BookingModal isOpen={modalState.bookingModalOpen} onClose={handleCloseModals} selectedDate={selectedDate} />
      )}
    </div>
  );
}
