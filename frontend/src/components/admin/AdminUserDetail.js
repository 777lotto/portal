import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// frontend/src/components/admin/AdminUserDetail.tsx - CORRECTED
import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiPost, apiPostFormData } from '../../lib/api.js';
function AdminUserDetail() {
    const { userId } = useParams();
    const [noteContent, setNoteContent] = useState('');
    const [noteJobId, setNoteJobId] = useState('');
    const [isNoteSubmitting, setIsNoteSubmitting] = useState(false);
    const [noteMessage, setNoteMessage] = useState(null);
    const [photoFile, setPhotoFile] = useState(null);
    const [photoJobId, setPhotoJobId] = useState('');
    const [isPhotoSubmitting, setIsPhotoSubmitting] = useState(false);
    const [photoMessage, setPhotoMessage] = useState(null);
    const handleAddNote = async (e) => {
        e.preventDefault();
        setIsNoteSubmitting(true);
        setNoteMessage(null);
        if (!userId || !noteContent) {
            setNoteMessage({ type: 'danger', text: 'Missing required information.' });
            setIsNoteSubmitting(false);
            return;
        }
        try {
            const payload = { content: noteContent, job_id: noteJobId || undefined };
            await apiPost(`/admin/users/${userId}/notes`, payload);
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
        if (!userId || !photoFile) {
            setPhotoMessage({ type: 'danger', text: 'Missing photo file.' });
            setIsPhotoSubmitting(false);
            return;
        }
        try {
            const formData = new FormData();
            formData.append('photo', photoFile);
            if (photoJobId)
                formData.append('job_id', photoJobId);
            await apiPostFormData(`/admin/users/${userId}/photos`, formData);
            setPhotoMessage({ type: 'success', text: 'Photo uploaded successfully!' });
            setPhotoFile(null);
            setPhotoJobId('');
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
    return (_jsxs("div", { className: "container mt-4", children: [_jsx(Link, { to: "/admin/dashboard", children: "\u2190 Back to Admin Dashboard" }), _jsxs("h2", { className: "mt-2", children: ["Manage User: ", userId] }), _jsxs("div", { className: "row mt-4", children: [_jsx("div", { className: "col-md-6 mb-4", children: _jsx("div", { className: "card", children: _jsxs("div", { className: "card-body", children: [_jsx("h5", { className: "card-title", children: "Add a Note" }), _jsxs("form", { onSubmit: handleAddNote, children: [_jsx("div", { className: "mb-3", children: _jsx("textarea", { value: noteContent, onChange: (e) => setNoteContent(e.target.value), required: true }) }), _jsx("div", { className: "mb-3", children: _jsx("input", { value: noteJobId, onChange: (e) => setNoteJobId(e.target.value) }) }), noteMessage && _jsx("div", { className: `alert alert-${noteMessage.type}`, children: noteMessage.text }), _jsx("button", { type: "submit", disabled: isNoteSubmitting, children: isNoteSubmitting ? 'Submitting...' : 'Add Note' })] })] }) }) }), _jsx("div", { className: "col-md-6 mb-4", children: _jsx("div", { className: "card", children: _jsxs("div", { className: "card-body", children: [_jsx("h5", { className: "card-title", children: "Upload a Photo" }), _jsxs("form", { onSubmit: handlePhotoUpload, children: [_jsx("div", { className: "mb-3", children: _jsx("input", { type: "file", id: "photo-file-input", onChange: (e) => setPhotoFile(e.target.files ? e.target.files[0] : null), required: true }) }), _jsx("div", { className: "mb-3", children: _jsx("input", { value: photoJobId, onChange: (e) => setPhotoJobId(e.target.value) }) }), photoMessage && _jsx("div", { className: `alert alert-${photoMessage.type}`, children: photoMessage.text }), _jsx("button", { type: "submit", disabled: isPhotoSubmitting, children: isPhotoSubmitting ? 'Uploading...' : 'Upload Photo' })] })] }) }) })] })] }));
}
export default AdminUserDetail;
