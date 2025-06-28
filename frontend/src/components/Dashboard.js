import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// frontend/src/components/Dashboard.tsx - CORRECTED
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getProfile, getJobs, getServices } from '../lib/api';
function Dashboard() {
    const [user, setUser] = useState(null);
    const [upcomingJobs, setUpcomingJobs] = useState([]);
    const [recentServices, setRecentServices] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    useEffect(() => {
        const loadDashboard = async () => {
            try {
                setIsLoading(true);
                setError(null);
                const [profileData, jobsData, servicesData] = await Promise.all([
                    getProfile(),
                    getJobs(),
                    getServices(),
                ]);
                setUser(profileData);
                setUpcomingJobs(jobsData.filter(j => new Date(j.start) > new Date()).slice(0, 5));
                setRecentServices(servicesData.slice(0, 5));
            }
            catch (err) {
                setError(err.message);
            }
            finally {
                setIsLoading(false);
            }
        };
        loadDashboard();
    }, []);
    if (isLoading)
        return _jsx("div", { className: "container mt-4", children: "Loading dashboard..." });
    if (error)
        return _jsx("div", { className: "container mt-4 alert alert-danger", children: error });
    return (_jsxs("div", { className: "container mt-4", children: [user && _jsxs("h1", { children: ["Welcome, ", user.name, "!"] }), _jsxs("div", { className: "row mt-4", children: [_jsxs("div", { className: "col-md-6", children: [_jsx("h3", { children: "Upcoming Jobs" }), _jsx("div", { className: "list-group", children: upcomingJobs.length > 0 ? (upcomingJobs.map(job => (_jsxs(Link, { to: `/jobs/${job.id}`, className: "list-group-item list-group-item-action", children: [job.title, " - ", new Date(job.start).toLocaleString()] }, job.id)))) : _jsx("p", { children: "No upcoming jobs." }) })] }), _jsxs("div", { className: "col-md-6", children: [_jsx("h3", { children: "Recent Services" }), _jsx("div", { className: "list-group", children: recentServices.length > 0 ? (recentServices.map(service => (_jsxs(Link, { to: `/services/${service.id}`, className: "list-group-item list-group-item-action", children: ["Service on ", new Date(service.service_date).toLocaleDateString()] }, service.id)))) : _jsx("p", { children: "No recent services." }) })] })] })] }));
}
export default Dashboard;
