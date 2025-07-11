// frontend/src/components/admin/AdminUserDetail.tsx
import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { apiGet, apiPost, apiPostFormData } from '../../lib/api.js';
import type { Job } from '@portal/shared';

function AdminUserDetail() {
  const { userId } = useParams<{ userId: string }>();

  // Jobs state
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(true);

  // Note state
  const [noteContent, setNoteContent] = useState('');
  const [noteJobId, setNoteJobId] = useState('');
  const [isNoteSubmitting, setIsNoteSubmitting] = useState(false);
  const [noteMessage, setNoteMessage] = useState<{ type: 'success' | 'danger', text: string } | null>(null);

  // Photo state
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoJobId, setPhotoJobId] = useState('');
  const [isPhotoSubmitting, setIsPhotoSubmitting] = useState(false);
  const [photoMessage, setPhotoMessage] = useState<{ type: 'success' | 'danger', text: string } | null>(null);

  useEffect(() => {
    const fetchJobsForUser = async () => {
      if (!userId) return;
      try {
        setIsLoadingJobs(true);
        const userJobs = await apiGet<Job[]>(`/api/admin/users/${userId}/jobs`);
        setJobs(userJobs);
      } catch (err: any) {
        console.error("Failed to fetch jobs for user", err);
      } finally {
        setIsLoadingJobs(false);
      }
    };
    fetchJobsForUser();
  }, [userId]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setPhotoFiles(prevFiles => [...prevFiles, ...acceptedFiles]);
  }, []);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'image/*': [] } });

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsNoteSubmitting(true);
    setNoteMessage(null);
    if (!userId || !noteContent) return;

    try {
      const payload = { content: noteContent, job_id: noteJobId || undefined };
      await apiPost(`/api/admin/users/${userId}/notes`, payload);
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
    if (!userId || photoFiles.length === 0) {
      setPhotoMessage({ type: 'danger', text: 'Please select one or more photos.' });
      return;
    }
    setIsPhotoSubmitting(true);
    setPhotoMessage(null);

    const uploadPromises = photoFiles.map(file => {
      const formData = new FormData();
      formData.append('photo', file);
      if (photoJobId) formData.append('job_id', photoJobId);
      return apiPostFormData(`/api/admin/users/${userId}/photos`, formData);
    });

    try {
      await Promise.all(uploadPromises);
      setPhotoMessage({ type: 'success', text: `${photoFiles.length} photo(s) uploaded successfully!` });
      setPhotoFiles([]);
      setPhotoJobId('');
    } catch (err: any) {
      setPhotoMessage({ type: 'danger', text: `Error: ${err.message}` });
    } finally {
      setIsPhotoSubmitting(false);
    }
  };

  const removeFile = (fileName: string) => {
    setPhotoFiles(photoFiles.filter(file => file.name !== fileName));
  };

  return (
    <div className="container mt-4">
      <Link to="/admin/dashboard">&larr; Back to Admin Dashboard</Link>
      <h2 className="mt-2">Manage User: {userId}</h2>
      <div className="row mt-4">
        <div className="col-md-6 mb-4">
          <div className="card h-100">
            <div className="card-body">
              <h5 className="card-title">Add a Note</h5>
              <form onSubmit={handleAddNote}>
                <div className="mb-3">
                  <label htmlFor="noteContent" className="form-label">Note Content</label>
                  <textarea id="noteContent" name="noteContent" className="form-control" value={noteContent} onChange={(e) => setNoteContent(e.target.value)} required />
                </div>
                <div className="mb-3">
                  <label htmlFor="noteJobId" className="form-label">Associated Job (Optional)</label>
                  <select id="noteJobId" name="noteJobId" className="form-control" value={noteJobId} onChange={(e) => setNoteJobId(e.target.value)} disabled={isLoadingJobs}>
                    <option value="">None</option>
                    {jobs.map(job => (<option key={job.id} value={job.id}>{job.title} - {new Date(job.start).toLocaleDateString()}</option>))}
                  </select>
                </div>
                {noteMessage && <div className={`alert alert-${noteMessage.type}`}>{noteMessage.text}</div>}
                <button type="submit" className="btn btn-secondary" disabled={isNoteSubmitting}>{isNoteSubmitting ? 'Submitting...' : 'Add Note'}</button>
              </form>
            </div>
          </div>
        </div>
        <div className="col-md-6 mb-4">
          <div className="card h-100">
            <div className="card-body d-flex flex-column">
              <h5 className="card-title">Upload Photos</h5>
              <form onSubmit={handlePhotoUpload} className="flex-grow-1 d-flex flex-column">
                <div {...getRootProps()} className="border-2 border-dashed rounded-md p-6 text-center cursor-pointer mb-3 flex-grow-1 d-flex align-items-center justify-content-center">
                  <input {...getInputProps()} />
                  {isDragActive ? <p>Drop files here...</p> : <p>Drag 'n' drop files here, or click to select</p>}
                </div>
                {photoFiles.length > 0 && (
                  <div className="mb-3">
                    <strong>Selected files:</strong>
                    <ul className="list-unstyled">
                      {photoFiles.map(file => (
                        <li key={file.name} className="d-flex justify-content-between align-items-center">
                          {file.name}
                          <button type="button" className="btn btn-sm btn-danger" onClick={() => removeFile(file.name)}>X</button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="mb-3">
                  <label htmlFor="photoJobId" className="form-label">Associate with Job (Optional)</label>
                  <select id="photoJobId" className="form-control" value={photoJobId} onChange={(e) => setPhotoJobId(e.target.value)} disabled={isLoadingJobs}>
                    <option value="">None</option>
                    {jobs.map(job => (<option key={job.id} value={job.id}>{job.title} - {new Date(job.start).toLocaleDateString()}</option>))}
                  </select>
                </div>
                {photoMessage && <div className={`alert alert-${photoMessage.type}`}>{photoMessage.text}</div>}
                <button type="submit" className="btn btn-primary mt-auto" disabled={isPhotoSubmitting || photoFiles.length === 0}>
                  {isPhotoSubmitting ? 'Uploading...' : `Upload ${photoFiles.length} File(s)`}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminUserDetail;
