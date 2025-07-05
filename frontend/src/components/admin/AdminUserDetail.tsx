// frontend/src/components/admin/AdminUserDetail.tsx - CORRECTED
import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiPost, apiPostFormData } from '../../lib/api.js';

function AdminUserDetail() {
  const { userId } = useParams<{ userId: string }>();

  const [noteContent, setNoteContent] = useState('');
  const [noteJobId, setNoteJobId] = useState('');
  const [isNoteSubmitting, setIsNoteSubmitting] = useState(false);
  const [noteMessage, setNoteMessage] = useState<{ type: 'success' | 'danger', text: string } | null>(null);

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoJobId, setPhotoJobId] = useState('');
  const [isPhotoSubmitting, setIsPhotoSubmitting] = useState(false);
  const [photoMessage, setPhotoMessage] = useState<{ type: 'success' | 'danger', text: string } | null>(null);

  const handleAddNote = async (e: React.FormEvent) => {
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

    if (!userId || !photoFile) {
      setPhotoMessage({ type: 'danger', text: 'Missing photo file.' });
      setIsPhotoSubmitting(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append('photo', photoFile);
      if (photoJobId) formData.append('job_id', photoJobId);
      await apiPostFormData(`/admin/users/${userId}/photos`, formData);
      setPhotoMessage({ type: 'success', text: 'Photo uploaded successfully!' });
      setPhotoFile(null);
      setPhotoJobId('');
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
        <div className="col-md-6 mb-4">
          <div className="card">
            <div className="card-body">
              <h5 className="card-title">Add a Note</h5>
              <form onSubmit={handleAddNote}>
                <div className="mb-3">
                  <label htmlFor="noteContent" className="form-label">Note Content</label>
                  <textarea id="noteContent" name="noteContent" className="form-control" value={noteContent} onChange={(e) => setNoteContent(e.target.value)} required />
                </div>
                <div className="mb-3">
                   <label htmlFor="noteJobId" className="form-label">Associated Job ID (Optional)</label>
                  <input id="noteJobId" name="noteJobId" className="form-control" value={noteJobId} onChange={(e) => setNoteJobId(e.target.value)} />
                </div>
                {noteMessage && <div className={`alert alert-${noteMessage.type}`}>{noteMessage.text}</div>}
                <button type="submit" className="btn btn-secondary" disabled={isNoteSubmitting}>{isNoteSubmitting ? 'Submitting...' : 'Add Note'}</button>
              </form>
            </div>
          </div>
        </div>
        <div className="col-md-6 mb-4">
          <div className="card">
            <div className="card-body">
              <h5 className="card-title">Upload a Photo</h5>
              <form onSubmit={handlePhotoUpload}>
                <div className="mb-3">
                   <label htmlFor="photo-file-input" className="form-label">Photo</label>
                  <input type="file" id="photo-file-input" name="photo" className="form-control" onChange={(e) => setPhotoFile(e.target.files ? e.target.files[0] : null)} required />
                </div>
                <div className="mb-3">
                  <label htmlFor="photoJobId" className="form-label">Associated Job ID (Optional)</label>
                  <input id="photoJobId" name="photoJobId" className="form-control" value={photoJobId} onChange={(e) => setPhotoJobId(e.target.value)} />
                </div>
                 {photoMessage && <div className={`alert alert-${photoMessage.type}`}>{photoMessage.text}</div>}
                <button type="submit" className="btn btn-secondary" disabled={isPhotoSubmitting}>{isPhotoSubmitting ? 'Uploading...' : 'Upload Photo'}</button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminUserDetail;
