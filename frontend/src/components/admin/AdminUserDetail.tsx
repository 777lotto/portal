// Create new file: frontend/src/components/admin/AdminUserDetail.tsx

import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiPost, apiPostFormData } from '../../lib/api';

function AdminUserDetail() {
  const { userId } = useParams<{ userId: string }>();

  // State for the "Add Note" form
  const [noteContent, setNoteContent] = useState('');
  const [noteJobId, setNoteJobId] = useState('');
  const [isNoteSubmitting, setIsNoteSubmitting] = useState(false);
  const [noteMessage, setNoteMessage] = useState<{ type: 'success' | 'danger', text: string } | null>(null);

  // State for the "Upload Photo" form
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoJobId, setPhotoJobId] = useState('');
  const [isPhotoSubmitting, setIsPhotoSubmitting] = useState(false);
  const [photoMessage, setPhotoMessage] = useState<{ type: 'success' | 'danger', text: string } | null>(null);

  const handleAddNote = async (e: React.FormEvent) => {
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
    } catch (err: any) {
      setNoteMessage({ type: 'danger', text: `Error: ${err.message}` });
    } finally {
      setIsNoteSubmitting(false);
    }
  };

  const handlePhotoUpload = async (e: React.FormEvent) => {
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
      const fileInput = document.getElementById('photo-file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

    } catch (err: any) {
      setPhotoMessage({ type: 'danger', text: `Error: ${err.message}` });
    } finally {
      setIsPhotoSubmitting(false);
    }
  };


  return (
    <div className="container mt-4">
      <Link to="/admin/dashboard">&larr; Back to Admin Dashboard</Link>
      <h2 className="mt-2">Manage User: {userId}</h2>

      <div className="row mt-4">
        {/* Add Note Card */}
        <div className="col-md-6 mb-4">
          <div className="card">
            <div className="card-body">
              <h5 className="card-title">Add a Note</h5>
              <form onSubmit={handleAddNote}>
                <div className="mb-3">
                  <label htmlFor="noteContent" className="form-label">Note</label>
                  <textarea
                    id="noteContent"
                    className="form-control"
                    rows={3}
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    required
                  />
                </div>
                <div className="mb-3">
                  <label htmlFor="noteJobId" className="form-label">Job ID (Optional)</label>
                  <input
                    type="text"
                    id="noteJobId"
                    className="form-control"
                    value={noteJobId}
                    onChange={(e) => setNoteJobId(e.target.value)}
                    placeholder="e.g., job_123abc or a Stripe Invoice ID"
                  />
                </div>
                {noteMessage && (
                  <div className={`alert alert-${noteMessage.type}`} role="alert">
                    {noteMessage.text}
                  </div>
                )}
                <button type="submit" className="btn btn-primary" disabled={isNoteSubmitting}>
                  {isNoteSubmitting ? 'Submitting...' : 'Add Note'}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Upload Photo Card */}
        <div className="col-md-6 mb-4">
          <div className="card">
            <div className="card-body">
              <h5 className="card-title">Upload a Photo</h5>
              <form onSubmit={handlePhotoUpload}>
                <div className="mb-3">
                  <label htmlFor="photoFile" className="form-label">Photo</label>
                  <input
                    type="file"
                    id="photo-file-input"
                    className="form-control"
                    onChange={(e) => setPhotoFile(e.target.files ? e.target.files[0] : null)}
                    required
                  />
                </div>
                <div className="mb-3">
                  <label htmlFor="photoJobId" className="form-label">Job ID (Optional)</label>
                  <input
                    type="text"
                    id="photoJobId"
                    className="form-control"
                    value={photoJobId}
                    onChange={(e) => setPhotoJobId(e.target.value)}
                    placeholder="e.g., job_123abc or a Stripe Invoice ID"
                  />
                </div>
                 {photoMessage && (
                  <div className={`alert alert-${photoMessage.type}`} role="alert">
                    {photoMessage.text}
                  </div>
                )}
                <button type="submit" className="btn btn-primary" disabled={isPhotoSubmitting}>
                  {isPhotoSubmitting ? 'Uploading...' : 'Upload Photo'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Here you would add sections to display existing photos and notes */}
      <hr />
      <h4>Existing Media & Notes</h4>
      <p className="text-muted">Displaying existing photos and notes for this user would be the next step.</p>

    </div>
  );
}

export default AdminUserDetail;
