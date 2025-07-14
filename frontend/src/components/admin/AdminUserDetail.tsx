// frontend/src/components/admin/AdminUserDetail.tsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { apiGet, apiPost, apiPostFormData } from '../../lib/api.js';
import type { Job, User, StripeInvoice, Service, PhotoWithNotes, Note } from '@portal/shared';
import { InvoiceEditor } from './InvoiceEditor.js';
import { QuoteManager } from './QuoteManager.js';

function AdminUserDetail() {
  const { userId } = useParams<{ userId: string }>();

  // State
  const [user, setUser] = useState<User | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [photos, setPhotos] = useState<PhotoWithNotes[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedJobForServices, setSelectedJobForServices] = useState<Job | null>(null);
  const [newService, setNewService] = useState({ notes: '', price: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'danger', text: string } | null>(null);
  const [activeInvoice, setActiveInvoice] = useState<StripeInvoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});
  const [uploadJobId, setUploadJobId] = useState<string>('');


  const fetchDataForUser = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    setError(null);
    try {
      const [userData, userJobs, userPhotos] = await Promise.all([
        apiGet<User[]>(`/api/admin/users`).then(users => users.find(u => u.id.toString() === userId)),
        apiGet<Job[]>(`/api/admin/users/${userId}/jobs`),
        apiGet<PhotoWithNotes[]>(`/api/admin/users/${userId}/photos`)
      ]);
      setUser(userData || null);
      setJobs(userJobs);
      setPhotos(userPhotos);
    } catch (err: any) {
      setError(err.message);
      console.error("Failed to fetch data for user", err);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchDataForUser();
  }, [fetchDataForUser]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!userId) return;
    setMessage(null);
    setIsSubmitting(true);
    try {
      const uploadPromises = acceptedFiles.map(file => {
        const formData = new FormData();
        formData.append('photo', file);
        if (uploadJobId) {
          formData.append('job_id', uploadJobId);
        }
        return apiPostFormData(`/api/admin/users/${userId}/photos`, formData);
      });
      await Promise.all(uploadPromises);
      setMessage({ type: 'success', text: `${acceptedFiles.length} photo(s) uploaded successfully!` });
      fetchDataForUser(); // Refresh data
    } catch (err: any) {
      setMessage({ type: 'danger', text: `Upload failed: ${err.message}` });
    } finally {
      setIsSubmitting(false);
    }
  }, [userId, uploadJobId, fetchDataForUser]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'image/*': [] } });

  const handleNoteChange = (photoId: string, text: string) => {
    setNoteInputs(prev => ({ ...prev, [photoId]: text }));
  };

  const handleAddNote = async (photoId: string) => {
    if (!userId || !noteInputs[photoId]) return;
    setMessage(null);
    try {
      await apiPost(`/api/admin/users/${userId}/notes`, {
        content: noteInputs[photoId],
        photo_id: photoId,
      });
      setNoteInputs(prev => ({ ...prev, [photoId]: '' }));
      fetchDataForUser(); // Refresh data
      setMessage({ type: 'success', text: 'Note added successfully!' });
    } catch (err: any) {
      setMessage({ type: 'danger', text: `Failed to add note: ${err.message}` });
    }
  };

  if (isLoading) return <div className="container mt-4">Loading user details...</div>;

  return (
    <div className="container mt-4">
      <Link to="/admin/users">&larr; Back to Users</Link>
      <h2 className="mt-2">Manage User: {user ? user.name : userId}</h2>
      {error && <div className="alert alert-danger">{error}</div>}
      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      {/* Photo Management Card */}
      <div className="card mt-4">
        <div className="card-body">
          <h5 className="card-title">Photo Management</h5>

          {/* Uploader */}
          <div {...getRootProps()} className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-light mb-4">
            <input {...getInputProps()} />
            {isDragActive ? <p>Drop the files here ...</p> : <p>Drag 'n' drop some files here, or click to select files</p>}
          </div>
          <div className="mb-3">
            <label htmlFor="uploadJobId" className="form-label">Associate with Job (Optional)</label>
            <select id="uploadJobId" className="form-select" value={uploadJobId} onChange={e => setUploadJobId(e.target.value)}>
              <option value="">No specific job</option>
              {jobs.map(job => (
                <option key={job.id} value={job.id}>{job.title} - {new Date(job.start).toLocaleDateString()}</option>
              ))}
            </select>
          </div>

          {/* Photo Gallery */}
          <div className="row">
            {photos.map(photo => (
              <div key={photo.id} className="col-md-6 col-lg-4 mb-4">
                <div className="card h-100">
                  <a href={photo.url} target="_blank" rel="noopener noreferrer">
                    <img src={photo.url} alt="User upload" className="card-img-top" style={{ aspectRatio: '16/9', objectFit: 'cover' }} />
                  </a>
                  <div className="card-body">
                    <p><small className="text-muted">Uploaded: {new Date(photo.created_at).toLocaleString()}</small></p>
                    {photo.job_id && <p><small className="text-muted">Job ID: {photo.job_id}</small></p>}

                    {/* Notes Section */}
                    <div className="mt-2">
                      <h6>Notes:</h6>
                      {photo.notes && photo.notes.length > 0 ? (
                        <ul className="list-unstyled">
                          {photo.notes.map((note: Note) => (
                            <li key={note.id} className="mb-1">
                              <p className="mb-0 text-sm">{note.content}</p>
                              <small className="text-muted text-xs">{new Date(note.created_at).toLocaleString()}</small>
                            </li>
                          ))}
                        </ul>
                      ) : <p className="text-muted text-sm">No notes for this photo.</p>}

                      {/* Add Note Form */}
                      <div className="input-group mt-2">
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="Add a note..."
                          value={noteInputs[photo.id] || ''}
                          onChange={e => handleNoteChange(photo.id, e.target.value)}
                        />
                        <button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => handleAddNote(photo.id)}>Add</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Existing Job Management can go here, simplified for brevity */}
      <div className="card mt-4">
        <div className="card-body">
            <h5 className="card-title">Jobs & Quotes</h5>
            {/* You can map through jobs here as before */}
        </div>
      </div>

    </div>
  );
}

export default AdminUserDetail;
