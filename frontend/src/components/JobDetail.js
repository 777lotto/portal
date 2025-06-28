import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// frontend/src/components/JobDetail.tsx - CORRECTED
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { apiGet } from '../lib/api';
function JobDetail() {
    const { id } = useParams();
    const [job, setJob] = useState(null);
    // const [photos, setPhotos] = useState<Photo[]>([]); // FIX: Commented out unused variable
    // const [notes, setNotes] = useState<Note[]>([]);   // FIX: Commented out unused variable
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    useEffect(() => {
        const fetchJobDetails = async () => {
            if (!id)
                return;
            try {
                setIsLoading(true);
                setError(null);
                const [jobData, photosData, notesData] = await Promise.all([
                    apiGet(`/jobs/${id}`),
                    apiGet(`/jobs/${id}/photos`),
                    apiGet(`/jobs/${id}/notes`)
                ]);
                setJob(jobData);
                // setPhotos(photosData); // FIX: Commented out unused setter
                // setNotes(notesData);   // FIX: Commented out unused setter
                // Keep the console logs to see the data you're getting
                console.log("Fetched Photos:", photosData);
                console.log("Fetched Notes:", notesData);
            }
            catch (err) {
                console.error("Error fetching job details:", err);
                setError(err.message || 'An unknown error occurred.');
            }
            finally {
                setIsLoading(false);
            }
        };
        fetchJobDetails();
    }, [id]);
    if (isLoading)
        return _jsx("div", { className: "container mt-4", children: "Loading job details..." });
    if (error)
        return _jsxs("div", { className: "container mt-4 alert alert-danger", children: ["Error: ", error] });
    if (!job)
        return _jsx("div", { className: "container mt-4", children: _jsx("h2", { children: "Job not found" }) });
    return (_jsx("div", { className: "container mt-4", children: _jsxs("div", { className: "card", children: [_jsx("div", { className: "card-header", children: _jsxs("h2", { children: ["Job Detail: ", job.title] }) }), _jsx("div", { className: "card-body", children: _jsxs("p", { children: [_jsx("strong", { children: "Status:" }), " ", _jsx("span", { className: `badge bg-${job.status === 'completed' ? 'success' : 'secondary'}`, children: job.status })] }) })] }) }));
}
export default JobDetail;
