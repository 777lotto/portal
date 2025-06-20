import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getJob } from "../lib/api";
export default function JobDetail() {
    const { id } = useParams();
    const [job, setJob] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);
    const token = localStorage.getItem("token");
    useEffect(() => {
        async function fetchJob() {
            try {
                if (!id)
                    throw new Error("Job ID is required");
                setLoading(true);
                const jobData = await getJob(id, token);
                setJob(jobData);
            }
            catch (err) {
                setError(err.message || "Failed to load job details");
            }
            finally {
                setLoading(false);
            }
        }
        fetchJob();
    }, [id, token]);
    if (loading)
        return _jsx("div", { style: { padding: "2rem" }, children: "Loading..." });
    if (error)
        return _jsx("div", { style: { padding: "2rem", color: "red" }, children: error });
    if (!job)
        return _jsx("div", { style: { padding: "2rem" }, children: "Job not found" });
    // Format dates for display
    const startDate = new Date(job.start).toLocaleString();
    const endDate = new Date(job.end).toLocaleString();
    return (_jsxs("div", { style: { padding: "2rem" }, children: [_jsx("h1", { children: job.title }), _jsxs("div", { style: { marginTop: "1rem" }, children: [_jsxs("p", { children: [_jsx("strong", { children: "Start:" }), " ", startDate] }), _jsxs("p", { children: [_jsx("strong", { children: "End:" }), " ", endDate] }), _jsxs("p", { children: [_jsx("strong", { children: "Status:" }), " ", job.status] }), job.description && (_jsxs("div", { style: { marginTop: "1rem" }, children: [_jsx("h3", { children: "Description" }), _jsx("p", { children: job.description })] })), job.recurrence !== 'none' && (_jsxs("p", { style: { marginTop: "1rem" }, children: [_jsx("strong", { children: "Recurrence:" }), " ", job.recurrence, job.recurrence === 'custom' && job.rrule && (_jsxs("span", { children: [" (", job.rrule, ")"] }))] })), _jsx("div", { style: { marginTop: "2rem" }, children: _jsx("button", { onClick: () => window.open(`/api/calendar-feed?token=${token}`, '_blank'), style: { padding: "0.5rem 1rem", marginRight: "1rem" }, children: "Add to Calendar" }) })] })] }));
}
