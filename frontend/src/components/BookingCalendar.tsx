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

  const unavailableDaysSet = useMemo(() => {
    return new Set(data?.unavailableDays || []);
  }, [data]);

  const dayPropGetter = useCallback((date: Date) => {
    const day = format(date, 'yyyy-MM-dd');
    if (unavailableDaysSet.has(day)) {
      return {
        style: {
          backgroundColor: '#343a40', // Dark background for unavailable days
          pointerEvents: 'none',
          cursor: 'not-allowed',
        },
      };
    }
    return {
      style: {
        backgroundColor: 'white', // White for available
      }
    };
  }, [unavailableDaysSet]);

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
        views={[Views.MONTH]}
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
                        <span className="rbc-btn-group"></span>
                    </div>
                );
            }
        }}
      />
    </div>
  );
}

export default BookingCalendar;
