// frontend/src/components/Calendar.tsx
import { useMemo, useCallback, useState, useEffect } from 'react';
import { Calendar as BigCalendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, parseISO } from 'date-fns';
import enUS from 'date-fns/locale/en-US';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import useSWR from 'swr';
import { apiGet, getPublicAvailability, getBlockedDates } from '../lib/api';
import type { Job, BlockedDate, JobRecurrenceRequest } from '@portal/shared';
import AdminBlockDayModal from './AdminBlockDayModal';
import AdminDayActionModal from './admin/AdminDayActionModal';
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

    const handleViewJob = () => {
        navigate(`/jobs/${job.id}`);
    };

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
                    <button onClick={handleViewJob} className="btn btn-primary">
                        View Job
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
    actionModalOpen: boolean;
    blockModalOpen: boolean;
    addJobModalOpen: boolean;
    selectedDate: Date | null;
    isBlocked: boolean;
    reason?: string | null;
  }>({
    actionModalOpen: false,
    blockModalOpen: false,
    addJobModalOpen: false,
    selectedDate: null,
    isBlocked: false,
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
  const { data: blockedDates, isLoading: blockedDatesLoading, mutate: mutateBlockedDates } = useSWR(
    user?.role === 'admin' ? '/api/admin/blocked-dates' : null,
    apiGet<BlockedDate[]>
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
    return new Set(blockedDates?.map(d => d.date) || []);
  }, [blockedDates]);

  const events: CalendarEvent[] = useMemo(() => {
    const jobEvents = (jobs || []).map((job): CalendarEvent => ({
      title: job.title,
      start: parseISO(job.start),
      end: parseISO(job.end),
      allDay: false,
      resource: job,
    }));

    if (user?.role === 'admin') {
      const blockedEvents = (blockedDates || []).map((blocked): CalendarEvent => ({
        title: `BLOCKED: ${blocked.reason || 'No reason'}`,
        start: parseISO(blocked.date + 'T00:00:00'),
        end: parseISO(blocked.date + 'T23:59:59'),
        allDay: true,
        resource: { type: 'blocked', reason: blocked.reason },
      }));
      return [...jobEvents, ...blockedEvents];
    }
    return jobEvents;
  }, [jobs, blockedDates, user]);

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
      const existingBlock = blockedDates?.find(d => d.date === dateStr);
      setModalState({
        ...modalState,
        actionModalOpen: true, // Open the new action modal
        selectedDate: slotInfo.start,
        isBlocked: !!existingBlock,
        reason: existingBlock?.reason,
      });
    }
  }, [user, blockedDates, modalState]);

  const closeAllModals = () => {
      setModalState({
          actionModalOpen: false,
          blockModalOpen: false,
          addJobModalOpen: false,
          selectedDate: null,
          isBlocked: false,
          reason: null
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
            <AdminDayActionModal
              isOpen={modalState.actionModalOpen}
              onClose={closeAllModals}
              selectedDate={modalState.selectedDate}
              onBlockDate={() => setModalState({ ...modalState, actionModalOpen: false, blockModalOpen: true })}
              onAddJob={() => setModalState({ ...modalState, actionModalOpen: false, addJobModalOpen: true })}
            />
            {/* The existing block date modal */}
            <AdminBlockDayModal
              isOpen={modalState.blockModalOpen}
              onClose={closeAllModals}
              selectedDate={modalState.selectedDate}
              isBlocked={modalState.isBlocked}
              reason={modalState.reason}
              onUpdate={() => {
                mutateBlockedDates();
                closeAllModals();
              }}
            />
            {/* The new add job modal */}
            <AddJobModal
              isOpen={modalState.addJobModalOpen}
              onClose={closeAllModals}
              selectedDate={modalState.selectedDate}
              onSave={() => {
                mutateJobs(); // Re-fetch jobs after adding a new one
                closeAllModals();
              }}
            />
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
