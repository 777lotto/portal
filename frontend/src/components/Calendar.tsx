// frontend/src/components/Calendar.tsx
import { useMemo, useCallback, useState, useEffect } from 'react';
import { Calendar as BigCalendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, parseISO } from 'date-fns';
import enUS from 'date-fns/locale/en-US';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import useSWR from 'swr';
import { apiGet, getPublicAvailability } from '../lib/api';
import type { Job, CalendarEvent, JobRecurrenceRequest } from '@portal/shared';
import AdminBlockDayModal from './AdminBlockDayModal';
import InitialJobTypeModal from './admin/InitialJobTypeModal';
import AddJobModal from './admin/AddJobModal';
import RecurrenceRequestModal from './RecurrenceRequestModal.js';
import { jwtDecode } from 'jwt-decode';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AdminRecurrenceRequestModal from './admin/AdminRecurrenceRequestModal';

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
  resource: Job | { type: 'blocked'; reason?: string | null };
}

// New component for the Job Summary Modal
function JobSummaryModal({
  job,
  onClose,
  onRecurrenceClick,
}: {
  job: Job;
  onClose: () => void;
  onRecurrenceClick: () => void;
}) {
    const navigate = useNavigate();

    const handleView = () => {
        if (job.status.includes('quote')) {
            navigate(`/quotes/${job.id}`);
        } else if (job.status.includes('invoice')) {
            navigate(`/invoices/${job.id}`);
        } else {
            navigate(`/jobs/${job.id}`);
        }
    };

    const viewButtonText = () => {
        if (job.status.includes('quote')) {
            return 'View Quote';
        } else if (job.status.includes('invoice')) {
            return 'View Invoice';
        } else {
            return 'View Job';
        }
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-tertiary-dark rounded-lg p-6 w-full max-w-md">
                <h2 className="text-xl font-bold mb-4">{job.title}</h2>
                <p className="mb-2"><strong>Status:</strong> {job.status.replace(/_/g, ' ')}</p>
                <div className="flex justify-end items-center mt-6">
                    <button type="button" onClick={onClose} className="btn btn-secondary mr-2">
                      Close
                    </button>
                    <button onClick={onRecurrenceClick} className="btn btn-info mr-2">
                        Request Recurrence
                    </button>
                    <button onClick={handleView} className="btn btn-primary">
                        {viewButtonText()}
                    </button>
                </div>
            </div>
        </div>
    );
}


const getEventColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'upcoming': return '#ffc107'; // Yellow
    case 'confirmed': return '#0d6efd'; // Blue
    case 'completed': return '#198754'; // Green
    case 'payment_pending': return '#fd7e14'; // Orange
    case 'past_due': return '#dc3545'; // Red
    case 'cancelled': return '#6c757d'; // Grey
    case 'draft_quote': return '#a9a9a9'; // Dark Grey
    case 'proposal_sent': return '#add8e6'; // Light Blue
    case 'finalized_quote': return '#90ee90'; // Light Green
    case 'draft_job': return '#d3d3d3'; // Light Grey
    case 'draft_invoice': return '#d3d3d3'; // Light Grey
    case 'sent_invoice': return '#ffa500'; // Orange
    default: return '#6c757d';
  }
};

const legendItems = [
    { status: 'Upcoming', color: '#ffc107' },
    { status: 'Confirmed', color: '#0d6efd' },
    { status: 'Completed', color: '#198754' },
    { status: 'Payment Pending', color: '#fd7e14' },
    { status: 'Past Due', color: '#dc3545' },
    { status: 'Cancelled', color: '#6c757d' },
    { status: 'Draft Quote', color: '#a9a9a9' },
    { status: 'Proposal Sent', color: '#add8e6' },
    { status: 'Finalized Quote', color: '#90ee90' },
    { status: 'Draft Job', color: '#d3d3d3' },
    { status: 'Draft Invoice', color: '#d3d3d3' },
    { status: 'Sent Invoice', color: '#ffa500' },
  ];

  const availabilityItems = [
      { label: 'High Availability', className: 'lighter-day' },
      { label: 'Low Availability', className: 'darker-day' },
      { label: 'Admin Blocked', className: 'admin-blocked-day' },
  ]

function CalendarLegend() {
    return (
      <div className="p-4 rounded-lg shadow bg-white dark:bg-tertiary-dark mt-6">
        <h3 className="text-lg font-bold mb-4">Calendar Legend</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-semibold mb-3 text-text-primary-light dark:text-text-primary-dark">Job Status</h4>
            <div className="flex flex-col space-y-2">
              {legendItems.map(item => (
                <div key={item.status} className="flex items-center">
                  <div className="w-4 h-4 rounded-full mr-3" style={{ backgroundColor: item.color }}></div>
                  <span className="text-sm text-text-secondary-light dark:text-text-secondary-dark">{item.status}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="font-semibold mb-3 text-text-primary-light dark:text-text-primary-dark">Day Availability</h4>
            <div className="flex flex-col space-y-2">
              {availabilityItems.map(item => (
                <div key={item.label} className="flex items-center">
                  <div className={`w-4 h-4 rounded-sm mr-3 border border-gray-300 dark:border-gray-600 ${item.className}`}></div>
                  <span className="text-sm text-text-secondary-light dark:text-text-secondary-dark">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

interface UserPayload {
  role: 'customer' | 'admin';
}

function JobCalendar() {
  const [user, setUser] = useState<UserPayload | null>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [jobForRecurrence, setJobForRecurrence] = useState<Job | null>(null);
  const [isRecurrenceModalOpen, setIsRecurrenceModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [adminRecurrenceRequest, setAdminRecurrenceRequest] = useState<JobRecurrenceRequest | null>(null);


  // State management for all modals
  const [modalState, setModalState] = useState<{
    initialJobTypeModalOpen: boolean;
    blockModalOpen: boolean;
    addJobModalOpen: boolean;
    selectedDate: Date | null;
    isBlocked: boolean;
    reason?: string | null;
    jobType: 'quote' | 'job' | 'invoice' | null;
  }>({
    initialJobTypeModalOpen: false,
    blockModalOpen: false,
    addJobModalOpen: false,
    selectedDate: null,
    isBlocked: false,
    jobType: null,
  });

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

  const { data: jobs, error: jobsError, isLoading: jobsLoading, mutate: mutateJobs } = useSWR<Job[]>('/api/jobs', apiGet);
  const { data: availability, error: availabilityError, isLoading: availabilityLoading } = useSWR('/api/public/availability', getPublicAvailability);
  const { data: calendarEvents, isLoading: calendarEventsLoading, mutate: mutateCalendarEvents } = useSWR(
    user?.role === 'admin' ? '/api/admin/calendar-events' : null,
    apiGet<CalendarEvent[]>
  );
    const { data: recurrenceRequests, mutate: mutateRecurrenceRequests } = useSWR(
    user?.role === 'admin' ? '/api/admin/recurrence-requests' : null,
    apiGet<JobRecurrenceRequest[]>
  );

  const recurrenceRequestId = searchParams.get('recurrence_request_id');

  useEffect(() => {
    if (recurrenceRequestId && recurrenceRequests) {
      const request = recurrenceRequests.find(r => r.id.toString() === recurrenceRequestId);
      if (request) {
        setAdminRecurrenceRequest(request);
      }
    }
  }, [recurrenceRequestId, recurrenceRequests]);

  const adminBlockedDaysSet = useMemo(() => {
    return new Set(calendarEvents?.filter(e => e.type === 'blocked').map(e => e.start.split('T')[0]) || []);
  }, [calendarEvents]);

  const events: CalendarEvent[] = useMemo(() => {
    const jobEvents = (jobs || []).map((job): CalendarEvent => ({
      title: job.title,
      start: parseISO(job.created_at), // Assuming created_at for start
      end: parseISO(job.due), // Assuming due for end
      allDay: false,
      resource: job,
    }));

    if (user?.role === 'admin') {
      const blockedEvents = (calendarEvents?.filter(e => e.type === 'blocked') || []).map((event): CalendarEvent => ({
        title: `BLOCKED: ${event.title || 'No reason'}`,
        start: parseISO(event.start),
        end: parseISO(event.end),
        allDay: true,
        resource: { type: 'blocked', reason: event.title },
      }));
      return [...jobEvents, ...blockedEvents];
    }
    return jobEvents;
  }, [jobs, calendarEvents, user]);

  const eventPropGetter = useCallback((event: CalendarEvent) => {
    if (typeof event.resource !== 'string' && 'type' in event.resource && event.resource.type === 'blocked') {
      return {
        style: {
          backgroundColor: '#6c757d',
          borderColor: '#6c757d',
          color: 'white',
          borderRadius: '5px',
        },
      };
    }
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
  }, []);

  const bookedDaysSet = useMemo(() => {
    return new Set(availability?.bookedDays || []);
  }, [availability]);

  const dayPropGetter = useCallback((date: Date) => {
    const day = format(date, 'yyyy-MM-dd');
    const props: { className?: string, style?: React.CSSProperties } = {};
    if (adminBlockedDaysSet.has(day)) {
      props.className = 'admin-blocked-day';
    } else if (bookedDaysSet.has(day)) {
      props.className = 'darker-day';
    } else {
      props.className = 'lighter-day';
    }
    if(user?.role === 'admin') {
      props.style = { cursor: 'pointer' };
    }
    return props;
  }, [bookedDaysSet, adminBlockedDaysSet, user]);

  const handleSelectEvent = (event: CalendarEvent) => {
    // Show the job summary modal for both customers and admins,
    // as long as the clicked event is a job (and not a blocked date).
    if ('id' in event.resource) {
      setSelectedJob(event.resource);
    }
  };


  // Updated handler to show the action choice modal first
  const handleSelectSlot = useCallback((slotInfo: { start: Date }) => {
    if (user?.role === 'admin') {
      const dateStr = format(slotInfo.start, 'yyyy-MM-dd');
      const existingEvent = calendarEvents?.find(e => e.start.startsWith(dateStr) && e.type === 'blocked');
      setModalState({
        ...modalState,
        initialJobTypeModalOpen: true, // Open the new initial job type modal
        selectedDate: slotInfo.start,
        isBlocked: !!existingEvent,
        reason: existingEvent?.title,
      });
    }
  }, [user, calendarEvents, modalState]);

  const handleJobTypeSelect = (type: 'quote' | 'job' | 'invoice') => {
    setModalState({
      ...modalState,
      initialJobTypeModalOpen: false,
      addJobModalOpen: true,
      jobType: type,
    });
  };

  const closeAllModals = () => {
      setModalState({
          initialJobTypeModalOpen: false,
          blockModalOpen: false,
          addJobModalOpen: false,
          selectedDate: null,
          isBlocked: false,
          reason: null,
          jobType: null,
      });
      setSelectedJob(null);
      setAdminRecurrenceRequest(null);
      if (searchParams.has('recurrence_request_id')) {
        searchParams.delete('recurrence_request_id');
        setSearchParams(searchParams);
      }
  }

  if (jobsLoading || availabilityLoading || blockedDatesLoading) return <div className="text-center p-8">Loading calendar...</div>;
  if (jobsError || availabilityError) return <div className="rounded-md bg-red-100 p-4 text-sm text-red-700">{jobsError?.message || availabilityError?.message}</div>;

  return (
    <>
      {successMessage && <div className="alert alert-success fixed top-20 right-4 z-50">{successMessage}</div>}
      {selectedJob && (
        <JobSummaryModal
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          onRecurrenceClick={() => {
            setJobForRecurrence(selectedJob);
            setSelectedJob(null);
            setIsRecurrenceModalOpen(true);
          }}
        />
      )}
      {isRecurrenceModalOpen && jobForRecurrence && (
        <RecurrenceRequestModal
          isOpen={isRecurrenceModalOpen}
          onClose={() => { setIsRecurrenceModalOpen(false); setJobForRecurrence(null); }}
          job={jobForRecurrence}
          onSuccess={() => {
            setIsRecurrenceModalOpen(false); setJobForRecurrence(null);
            setSuccessMessage('Your recurrence request has been submitted.');
            setTimeout(() => setSuccessMessage(null), 5000);
          }}
        />
      )}
      {modalState.selectedDate && (
          <>
            {/* The new initial choice modal */}
            <InitialJobTypeModal
              isOpen={modalState.initialJobTypeModalOpen}
              onClose={closeAllModals}
              selectedDate={modalState.selectedDate}
              onSelectType={handleJobTypeSelect}
            />
            {/* The existing block date modal */}
            <AdminBlockDayModal
              isOpen={modalState.blockModalOpen}
              onClose={closeAllModals}
              selectedDate={modalState.selectedDate}
              isBlocked={modalState.isBlocked}
              reason={modalState.reason}
              onUpdate={() => {
                mutateCalendarEvents();
                closeAllModals();
              }}
            />
            {/* The new add job modal */}
            {modalState.jobType && (
              <AddJobModal
                isOpen={modalState.addJobModalOpen}
                onClose={closeAllModals}
                selectedDate={modalState.selectedDate}
                jobType={modalState.jobType}
                onSave={() => {
                  mutateJobs(); // Re-fetch jobs after adding a new one
                  closeAllModals();
                }}
              />
            )}
          </>
      )}
    {adminRecurrenceRequest && user?.role === 'admin' && (
          <AdminRecurrenceRequestModal
              isOpen={!!adminRecurrenceRequest}
              onClose={closeAllModals}
              request={adminRecurrenceRequest}
              onUpdate={() => {
                  mutateRecurrenceRequests();
                  closeAllModals();
                  setSuccessMessage('Recurrence request has been updated.');
                  setTimeout(() => setSuccessMessage(null), 5000);
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
          selectable={user?.role === 'admin'}
          onSelectSlot={handleSelectSlot}
          onSelectEvent={handleSelectEvent}
        />
      </div>

      <div className="text-center mt-6">
        <Link
          to="/calendar-sync"
          className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-event-blue hover:bg-event-blue/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-event-blue"
        >
          Sync Your Calendar
        </Link>
        <p className="mt-2 text-sm text-text-secondary-light dark:text-text-secondary-dark">
          Click here to get a unique URL to subscribe to your jobs in an external calendar app.
        </p>
      </div>
      <CalendarLegend />
    </>
  );
}

export default JobCalendar;
