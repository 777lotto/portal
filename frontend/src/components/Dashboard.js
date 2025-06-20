import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { apiGet, openPortal, getJobs } from "../lib/api";
import { Link, useNavigate } from "react-router-dom";
export default function Dashboard() {
    const [profile, setProfile] = useState(null);
    const [upcomingJobs, setUpcomingJobs] = useState([]);
    const [error, setError] = useState(null);
    const navigate = useNavigate();
    useEffect(() => {
        const fetchData = async () => {
            try {
                const token = localStorage.getItem("token");
                if (!token) {
                    navigate("/login");
                    return;
                }
                // Fetch profile and upcoming jobs in parallel
                const [profileData, jobsData] = await Promise.all([
                    apiGet("/profile", token),
                    getJobs(token)
                ]);
                setProfile(profileData);
                // Filter for upcoming jobs and sort by start date
                const now = new Date();
                const upcoming = jobsData
                    .filter((job) => new Date(job.start) > now &&
                    job.status !== 'cancelled')
                    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
                    .slice(0, 3); // Just show the next 3 appointments
                setUpcomingJobs(upcoming);
            }
            catch (err) {
                setError(err.message || "Failed to load data");
            }
        };
        fetchData();
    }, [navigate]);
    // Handle opening Stripe portal
    const handlePortal = async () => {
        try {
            const token = localStorage.getItem("token");
            const { url } = await openPortal(token);
            window.open(url, "_blank");
        }
        catch (err) {
            setError(err.message || "Failed to open billing portal");
        }
    };
    return (_jsxs("div", { style: { padding: "2rem" }, children: [_jsx("h1", { children: "Welcome to Your Portal" }), error && (_jsx("div", { style: { color: "red", marginBottom: "1rem" }, children: error })), profile ? (_jsxs("div", { children: [_jsxs("section", { children: [_jsx("h2", { children: "Your Profile" }), _jsxs("p", { children: [_jsx("strong", { children: "Name:" }), " ", profile.name] }), _jsxs("p", { children: [_jsx("strong", { children: "Email:" }), " ", profile.email] })] }), _jsxs("section", { style: { marginTop: "2rem" }, children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" }, children: [_jsx("h2", { children: "Upcoming Services" }), _jsx(Link, { to: "/calendar", style: { textDecoration: "none" }, children: "View Full Calendar" })] }), upcomingJobs.length > 0 ? (_jsx("div", { children: upcomingJobs.map(job => (_jsxs("div", { style: {
                                        padding: "1rem",
                                        marginBottom: "1rem",
                                        border: "1px solid #ddd",
                                        borderRadius: "4px"
                                    }, children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between" }, children: [_jsx("h3", { children: job.title }), _jsx(Link, { to: `/jobs/${job.id}`, children: "View Details" })] }), _jsxs("p", { children: [_jsx("strong", { children: "Date:" }), " ", new Date(job.start).toLocaleDateString(), " at", " ", new Date(job.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })] }), job.description && _jsx("p", { children: job.description })] }, job.id))) })) : (_jsx("p", { children: "No upcoming appointments scheduled." }))] }), _jsxs("div", { style: { marginTop: "2rem", display: "flex", gap: "1rem" }, children: [_jsx("button", { onClick: handlePortal, style: { padding: "0.5rem 1rem" }, children: "Manage Billing" }), _jsx("button", { onClick: () => navigate("/calendar-sync"), style: { padding: "0.5rem 1rem" }, children: "Sync Calendar" })] })] })) : (_jsx("p", { children: "Loading profile..." }))] }));
}
