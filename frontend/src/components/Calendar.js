import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// frontend/src/components/Calendar.tsx - CORRECTED
import { useState, useEffect } from 'react';
import { Calendar as BigCalendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { getJobs } from '../lib/api';
const localizer = momentLocalizer(moment);
function JobCalendar() {
    const [events, setEvents] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    useEffect(() => {
        const fetchJobs = async () => {
            try {
                setIsLoading(true);
                setError(null);
                const jobs = await getJobs();
                const calendarEvents = jobs.map(job => ({
                    title: job.title,
                    start: new Date(job.start),
                    end: new Date(job.end),
                    resource: job
                }));
                setEvents(calendarEvents);
            }
            catch (err) {
                setError(err.message);
            }
            finally {
                setIsLoading(false);
            }
        };
        fetchJobs();
    }, []);
    if (isLoading)
        return _jsx("div", { className: "container mt-4", children: "Loading calendar..." });
    if (error)
        return _jsx("div", { className: "container mt-4 alert alert-danger", children: error });
    return (_jsxs("div", { className: "container mt-4", style: { height: '80vh' }, children: [_jsx("h2", { children: "Job Calendar" }), _jsx(BigCalendar, { localizer: localizer, events: events, startAccessor: "start", endAccessor: "end", style: { height: '100%' } })] }));
}
export default JobCalendar;
