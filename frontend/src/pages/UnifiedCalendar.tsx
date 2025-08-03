// frontend/src/pages/UnifiedCalendar.tsx
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { Calendar as BigCalendar, momentLocalizer, Views } from 'react-big-calendar';
import moment from 'moment';
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { Job, CalendarEvent as ApiCalendarEvent, Availability } from '@portal/shared';
import NewAddJobModal from '../components/modals/admin/NewAddJobModal';
import AdminBlockDayModal from '../components/modals/admin/AdminBlockDayModal';
import BookingModal from '../components/modals/BookingModal';
import { handleApiError } from '../lib/utils';

const localizer = momentLocalizer(moment);

interface CalendarDisplayEvent {
  title: string;
  start: Date;
  end: Date;
  resource: Job | ApiCalendarEvent;
}

// --- REFACTORED: Data fetching with useQuery ---
const fetchAdminData = async () => {
  const [jobsRes, eventsRes] = await Promise.all([
    api.admin.jobs.$get(),
    api.admin['calendar-events'].$get()
  ]);
  if (!jobsRes.ok) throw await handleApiError(jobsRes, 'Failed to fetch jobs');
  if (!eventsRes.ok) throw await handleApiError(eventsRes, 'Failed to fetch calendar events');
  const jobsData = await jobsRes.json();
  const eventsData = await eventsRes.json();
  return { jobs: jobsData.jobs as Job[], calendarEvents: eventsData.events as ApiCalendarEvent[] };
};

const fetchAvailability = async (isLoggedIn: boolean) => {
  const res = isLoggedIn ? await api.availability.$get() : await api.public.availability.$get();
  if (!res.ok) throw await handleApiError(res, 'Failed to fetch availability');
  const data = await res.json();
  return data.availability as Availability;
};


export default function UnifiedCalendar({ onSelectSlot: onSelectSlotProp }: { onSelectSlot?: (slotInfo: { start: Date }) => void }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [modalState, setModalState] = useState({ addJobModalOpen: false, blockDayModalOpen: false, bookingModalOpen: false });
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEventForBlock, setSelectedEventForBlock] = useState<ApiCalendarEvent | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(document.documentElement.classList.contains('dark'));

  // --- Data Fetching with new useQuery hooks ---
  const { data: adminData } = useQuery({
    queryKey: ['adminCalendarData'],
    queryFn: fetchAdminData,
    enabled: user?.role === 'admin',
  });

  const { data: availability } = useQuery({
    queryKey: ['availability', !!user],
    queryFn: () => fetchAvailability(!!user),
  });

  useEffect(() => {
    const observer = new MutationObserver(() => setIsDarkMode(document.documentElement.classList.contains('dark')));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const events = useMemo<CalendarDisplayEvent[]>(() => {
    if (user?.role !== 'admin' || !adminData) return [];

    const { jobs, calendarEvents } = adminData;
    const jobEvents: CalendarDisplayEvent[] = jobs.map(job => ({
      title: job.job_title || 'Untitled Job',
      start: new Date(job.job_start_time),
      end: new Date(job.job_end_time),
      resource: job,
    }));
    const blockedEvents: CalendarDisplayEvent[] = calendarEvents
      .filter(event => event.type === 'blocked')
      .map(event => ({
        title: event.title || 'Blocked',
        start: new Date(event.start_time),
        end: new Date(event.end_time),
        resource: event,
      }));
    return [...jobEvents, ...blockedEvents];
  }, [adminData, user]);

  const { bookedDaysSet, pendingDaysSet, adminBlockedDaysSet } = useMemo(() => {
    const bookedDays = new Set(availability?.bookedDays || []);
    const pendingDays = new Set(availability?.pendingDays || []);
    const adminBlocked = new Set(adminData?.calendarEvents?.filter(e => e.type === 'blocked').map(e => format(new Date(e.start_time), 'yyyy-MM-dd')) || []);
    return { bookedDaysSet: bookedDays, pendingDaysSet: pendingDays, adminBlockedDaysSet: adminBlocked };
  }, [availability, adminData]);

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
      queryClient.invalidateQueries({ queryKey: ['adminCalendarData'] });
      queryClient.invalidateQueries({ queryKey: ['availability'] });
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
