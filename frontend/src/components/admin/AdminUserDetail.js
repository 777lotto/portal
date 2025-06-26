import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Create new file: frontend/src/components/admin/AdminUserDetail.tsx
import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiPost, apiPostFormData } from '../../lib/api';
function AdminUserDetail() {
    const { userId } = useParams();
    // State for the "Add Note" form
    const [noteContent, setNoteContent] = useState('');
    const [noteJobId, setNoteJobId] = useState('');
    const [isNoteSubmitting, setIsNoteSubmitting] = useState(false);
    const [noteMessage, setNoteMessage] = useState(null);
    // State for the "Upload Photo" form
    const [photoFile, setPhotoFile] = useState(null);
    const [photoJobId, setPhotoJobId] = useState('');
    const [isPhotoSubmitting, setIsPhotoSubmitting] = useState(false);
    const [photoMessage, setPhotoMessage] = useState(null);
    const handleAddNote = async (e) => {
        e.preventDefault();
        setIsNoteSubmitting(true);
        setNoteMessage(null);
        const token = localStorage.getItem("token");
        if (!token || !userId || !noteContent) {
            setNoteMessage({ type: 'danger', text: 'Missing required information.' });
            setIsNoteSubmitting(false);
            return;
        }
        try {
            const payload = {
                content: noteContent,
                job_id: noteJobId || undefined, // Send job_id only if it's not empty
            };
            await apiPost(`/admin/users/${userId}/notes`, payload, token);
            setNoteMessage({ type: 'success', text: 'Note added successfully!' });
            setNoteContent('');
            setNoteJobId('');
        }
        catch (err) {
            setNoteMessage({ type: 'danger', text: `Error: ${err.message}` });
        }
        finally {
            setIsNoteSubmitting(false);
        }
    };
    const handlePhotoUpload = async (e) => {
        e.preventDefault();
        setIsPhotoSubmitting(true);
        setPhotoMessage(null);
        const token = localStorage.getItem("token");
        if (!token || !userId || !photoFile) {
            setPhotoMessage({ type: 'danger', text: 'Missing photo file.' });
            setIsPhotoSubmitting(false);
            return;
        }
        try {
            const formData = new FormData();
            formData.append('photo', photoFile);
            if (photoJobId) {
                formData.append('job_id', photoJobId);
            }
            await apiPostFormData(`/admin/users/${userId}/photos`, formData, token);
            setPhotoMessage({ type: 'success', text: 'Photo uploaded successfully!' });
            setPhotoFile(null);
            setPhotoJobId('');
            // Reset the file input visually
            const fileInput = document.getElementById('photo-file-input');
            if (fileInput)
                fileInput.value = '';
        }
        catch (err) {
            setPhotoMessage({ type: 'danger', text: `Error: ${err.message}` });
        }
        finally {
            setIsPhotoSubmitting(false);
        }
    };
    return (_jsxs("div", { className: "container mt-4", children: [_jsx(Link, { to: "/admin/dashboard", children: "\u2190 Back to Admin Dashboard" }), _jsxs("h2", { className: "mt-2", children: ["Manage User: ", userId] }), _jsxs("div", { className: "row mt-4", children: [_jsx("div", { className: "col-md-6 mb-4", children: _jsx("div", { className: "card", children: _jsxs("div", { className: "card-body", children: [_jsx("h5", { className: "card-title", children: "Add a Note" }), _jsxs("form", { onSubmit: handleAddNote, children: [_jsxs("div", { className: "mb-3", children: [_jsx("label", { htmlFor: "noteContent", className: "form-label", children: "Note" }), _jsx("textarea", { id: "noteContent", className: "form-control", rows: 3, value: noteContent, onChange: (e) => setNoteContent(e.target.value), required: true })] }), _jsxs("div", { className: "mb-3", children: [_jsx("label", { htmlFor: "noteJobId", className: "form-label", children: "Job ID (Optional)" }), _jsx("input", { type: "text", id: "noteJobId", className: "form-control", value: noteJobId, onChange: (e) => setNoteJobId(e.target.value), placeholder: "e.g., job_123abc or a Stripe Invoice ID" })] }), noteMessage && (_jsx("div", { className: `alert alert-${noteMessage.type}`, role: "alert", children: noteMessage.text })), _jsx("button", { type: "submit", className: "btn btn-primary", disabled: isNoteSubmitting, children: isNoteSubmitting ? 'Submitting...' : 'Add Note' })] })] }) }) }), _jsx("div", { className: "col-md-6 mb-4", children: _jsx("div", { className: "card", children: _jsxs("div", { className: "card-body", children: [_jsx("h5", { className: "card-title", children: "Upload a Photo" }), _jsxs("form", { onSubmit: handlePhotoUpload, children: [_jsxs("div", { className: "mb-3", children: [_jsx("label", { htmlFor: "photoFile", className: "form-label", children: "Photo" }), _jsx("input", { type: "file", id: "photo-file-input", className: "form-control", onChange: (e) => setPhotoFile(e.target.files ? e.target.files[0] : null), required: true })] }), _jsxs("div", { className: "mb-3", children: [_jsx("label", { htmlFor: "photoJobId", className: "form-label", children: "Job ID (Optional)" }), _jsx("input", { type: "text", id: "photoJobId", className: "form-control", value: photoJobId, onChange: (e) => setPhotoJobId(e.target.value), placeholder: "e.g., job_123abc or a Stripe Invoice ID" })] }), photoMessage && (_jsx("div", { className: `alert alert-${photoMessage.type}`, role: "alert", children: photoMessage.text })), _jsx("button", { type: "submit", className: "btn btn-primary", disabled: isPhotoSubmitting, children: isPhotoSubmitting ? 'Uploading...' : 'Upload Photo' })] })] }) }) })] }), _jsx("hr", {}), _jsx("h4", { children: "Existing Media & Notes" }), _jsx("p", { className: "text-muted", children: "Displaying existing photos and notes for this user would be the next step." })] }));
}
export default AdminUserDetail;
