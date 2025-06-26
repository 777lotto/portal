import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// frontend/src/components/JobDetail.tsx - Updated with try/catch
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { apiGet } from '../lib/api';
function JobDetail() {
    const { id } = useParams();
    const [job, setJob] = useState(null);
    const [photos, setPhotos] = useState([]);
    const [notes, setNotes] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    useEffect(() => {
        const fetchJobDetails = async () => {
            if (!id)
                return;
            const token = localStorage.getItem("token");
            if (!token)
                return;
            // --- NEW: Use a try/catch block to handle API calls ---
            try {
                setIsLoading(true);
                setError(null);
                // Promise.all will now either resolve with an array of data, or reject if ANY call fails
                const [jobData, photosData, notesData] = await Promise.all([
                    apiGet(`/api/jobs/${id}`, token),
                    apiGet(`/api/jobs/${id}/photos`, token),
                    apiGet(`/api/jobs/${id}/notes`, token)
                ]);
                // If we get here, all calls were successful
                setJob(jobData);
                setPhotos(photosData);
                setNotes(notesData);
            }
            catch (err) {
                // Any error from the Promise.all will be caught here
                console.error("Error fetching job details:", err);
                setError(err.message || 'An unknown error occurred.');
            }
            finally {
                setIsLoading(false);
            }
        };
        fetchJobDetails();
    }, [id]);
    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    };
    if (isLoading)
        return _jsx("div", { className: "container mt-4", children: "Loading job details..." });
    if (error)
        return _jsxs("div", { className: "container mt-4 alert alert-danger", children: ["Error: ", error] });
    if (!job)
        return _jsx("div", { className: "container mt-4", children: _jsx("h2", { children: "Job not found" }) });
    return (_jsx("div", { className: "container mt-4", children: _jsxs("div", { className: "card", children: [_jsx("div", { className: "card-header", children: _jsxs("h2", { children: ["Job Detail: ", job.title] }) }), _jsx("div", { className: "card-body", children: _jsxs("p", { children: [_jsx("strong", { children: "Status:" }), " ", _jsx("span", { className: `badge bg-${job.status === 'completed' ? 'success' : 'secondary'}`, children: job.status })] }) })] }) }));
}
export default JobDetail;
