import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { getJobs } from '../lib/api';
// Setup the localizer for Big Calendar
const localizer = momentLocalizer(moment);
export default function JobCalendar() {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const token = localStorage.getItem('token');
    useEffect(() => {
        async function fetchJobs() {
            try {
                setLoading(true);
                const jobs = await getJobs(token);
                // Convert jobs to calendar events
                const calendarEvents = jobs.map((job) => ({
                    id: job.id,
                    title: job.title,
                    start: new Date(job.start),
                    end: new Date(job.end),
                    allDay: false,
                    resource: job,
                }));
                setEvents(calendarEvents);
            }
            catch (err) {
                setError(err.message || 'Failed to load calendar events');
            }
            finally {
                setLoading(false);
            }
        }
        fetchJobs();
    }, [token]);
    const handleSelectEvent = (event) => {
        // Navigate to job detail page
        window.location.href = `/jobs/${event.id}`;
    };
    if (loading)
        return _jsx("div", { children: "Loading calendar..." });
    if (error)
        return _jsx("div", { style: { color: 'red' }, children: error });
    return (_jsxs("div", { style: { height: '600px', padding: '1rem' }, children: [_jsx("h1", { children: "Your Service Schedule" }), _jsx("div", { style: { height: 'calc(100% - 60px)' }, children: _jsx(Calendar, { localizer: localizer, events: events, startAccessor: "start", endAccessor: "end", style: { width: '100%', height: '100%' }, onSelectEvent: handleSelectEvent, views: ['month', 'week', 'day', 'agenda'], defaultView: "month" }) })] }));
}
