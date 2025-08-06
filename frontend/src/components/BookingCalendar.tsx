import { useMemo, useCallback } from 'react';
import { Calendar as BigCalendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import enUS from 'date-fns/locale/en-US';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import useSWR from 'swr';
import { getPublicAvailability } from '../lib/api';

const locales = { 'en-US': enUS };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

interface Props {
  onSelectSlot: (slotInfo: { start: Date }) => void;
}

function BookingCalendar({ onSelectSlot }: Props) {
  const { data, error, isLoading } = useSWR('/api/public/availability', getPublicAvailability);

  // UPDATED: Memoize the set of booked days from the new data structure
  const bookedDaysSet = useMemo(() => {
    return new Set(data?.bookedDays || []);
  }, [data]);

  // UPDATED: Add dayPropGetter to apply styles and disable booked days
  const dayPropGetter = useCallback((date: Date) => {
    const day = format(date, 'yyyy-MM-dd');
    if (bookedDaysSet.has(day)) {
      return {
        className: 'darker-day',
        style: {
          pointerEvents: 'none',
          cursor: 'not-allowed',
        },
      };
    }
    return { className: 'lighter-day' };
  }, [bookedDaysSet]);

  if (isLoading) return <div>Loading availability...</div>;
  if (error) return <div className="alert alert-danger">Could not load calendar.</div>;

  return (
    <div className="bg-white dark:bg-tertiary-dark p-4 rounded-lg shadow" style={{ height: '85vh' }}>
      <BigCalendar
        localizer={localizer}
        events={[]}
        startAccessor="start"
        endAccessor="end"
        style={{ height: '100%' }}
        views={[Views.MONTH, Views.WEEK]} // User wanted month and week view
        selectable
        onSelectSlot={onSelectSlot}
        dayPropGetter={dayPropGetter}
        components={{
            toolbar: (toolbar) => {
                return (
                    <div className="rbc-toolbar">
                        <span className="rbc-btn-group">
                            <button type="button" onClick={() => toolbar.onNavigate('PREV')}>Back</button>
                            <button type="button" onClick={() => toolbar.onNavigate('TODAY')}>Today</button>
                            <button type="button" onClick={() => toolbar.onNavigate('NEXT')}>Next</button>
                        </span>
                        <span className="rbc-toolbar-label">{toolbar.label}</span>
                        <span className="rbc-btn-group">
                           <button type="button" className={toolbar.view === 'month' ? 'rbc-active' : ''} onClick={() => toolbar.onView('month')}>Month</button>
                           <button type="button" className={toolbar.view === 'week' ? 'rbc-active' : ''} onClick={() => toolbar.onView('week')}>Week</button>
                        </span>
                    </div>
                );
            }
        }}
      />
    </div>
  );
}

export default BookingCalendar;
