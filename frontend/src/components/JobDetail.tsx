// 777lotto/portal/portal-fold/frontend/src/components/JobDetail.tsx

import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { apiGet, getServicesForJob, apiPost, apiPostFormData, adminFinalizeJob } from '../lib/api.js';
import type { Job, Service, Photo, Note, User } from '@portal/shared';
import { jwtDecode } from 'jwt-decode';

interface UserPayload {
  id: number;
  role: 'customer' | 'admin';
}

function JobDetail() {
  const { id: jobId } = useParams<{ id: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<UserPayload | null>(null);

  // Editing States
  const [isEditingJob, setIsEditingJob] = useState(false);
  const [editingService, setEditingService] = useState<Partial<Service> | null>(null);
  const [newNote, setNewNote] = useState('');
  const [editedJobData, setEditedJobData] = useState<Partial<Job>>({});

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const decodedUser = jwtDecode<UserPayload>(token);
        setUser(decodedUser);
      } catch (e) {
        console.error("Invalid token:", e);
      }
    }
  }, []);

  const fetchJobDetails = useCallback(async () => {
    if (!jobId) return;
    try {
      // Don't set loading true on refetch
      setError(null);
      const [jobData, servicesData, photosData, notesData] = await Promise.all([
        apiGet<Job>(`/api/jobs/${jobId}`),
        getServicesForJob(jobId),
        apiGet<Photo[]>(`/api/jobs/${jobId}/photos`),
        apiGet<Note[]>(`/api/jobs/${jobId}/notes`)
      ]);
      setJob(jobData);
      setServices(servicesData);
      setPhotos(photosData);
      setNotes(notesData);
      setEditedJobData(jobData);
    } catch (err: any) {
      setError(err.message || 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    setIsLoading(true);
    fetchJobDetails();
  }, [jobId, fetchJobDetails]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!jobId || user?.role !== 'admin') return;
    setError(null);
    try {
      const uploadPromises = acceptedFiles.map(file => {
        const formData = new FormData();
        formData.append('photo', file);
        formData.append('userId', job!.customerId);
        formData.append('job_id', jobId);
        return apiPostFormData(`/api/admin/users/${job!.customerId}/photos`, formData);
      });
      await Promise.all(uploadPromises);
      fetchJobDetails(); // Refresh
    } catch (err: any) {
      setError(`Upload failed: ${err.message}`);
    }
  }, [jobId, user, job, fetchJobDetails]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'image/*': [] }, disabled: user?.role !== 'admin' });

  const handleNoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim() || !jobId || user?.role !== 'admin') return;
    try {
      await apiPost(`/api/admin/users/${job!.customerId}/notes`, {
        content: newNote,
        job_id: jobId,
      });
      setNewNote('');
      fetchJobDetails(); // Refresh
    } catch (err: any) {
      setError(`Failed to add note: ${err.message}`);
    }
  };

  const handleJobUpdate = async () => {
    if (!jobId || user?.role !== 'admin') return;
    try {
      await apiPost(`/api/admin/jobs/${jobId}/details`, editedJobData, 'PUT');
      setIsEditingJob(false);
      fetchJobDetails(); // Refresh
    } catch (err: any) {
      setError(`Failed to update job: ${err.message}`);
    }
  };

  const handleServiceUpdate = async () => {
    if (!editingService || !jobId || user?.role !== 'admin') return;
    try {
      const url = editingService.id ? `/api/admin/jobs/${jobId}/services/${editingService.id}` : `/api/admin/jobs/${jobId}/services`;
      const method = editingService.id ? 'PUT' : 'POST';
      await apiPost(url, {
        ...editingService,
        price_cents: Math.round(Number(editingService.price_cents || 0) * 100)
      }, method);
      setEditingService(null);
      fetchJobDetails(); // Refresh
    } catch (err: any) {
      setError(`Failed to save service: ${err.message}`);
    }
  };

    const handleServiceDelete = async (serviceId: number) => {
        if (!jobId || user?.role !== 'admin' || !window.confirm("Are you sure you want to delete this line item?")) return;
        try {
            await apiPost(`/api/admin/jobs/${jobId}/services/${serviceId}`, {}, 'DELETE');
            fetchJobDetails(); // Refresh
        } catch (err: any) {
            setError(`Failed to delete service: ${err.message}`);
        }
    };

  const handleFinalizeJob = async () => {
    if (!jobId || !window.confirm("This will finalize the job and send an invoice to the customer. This action cannot be undone. Continue?")) return;
    try {
        await adminFinalizeJob(jobId);
        fetchJobDetails(); // Refresh to show new status
    } catch (err: any) {
        setError(`Failed to finalize job: ${err.message}`);
    }
  };


  const statusStyle = (status: string) => { /* ... (same as before) ... */ };

  if (isLoading) return <div className="text-center p-8">Loading job details...</div>;
  if (error) return <div className="rounded-md bg-red-100 p-4 text-sm text-red-700">{error}</div>;
  if (!job) return <div className="text-center p-8"><h2>Job not found</h2></div>;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
       {error && <div className="alert alert-danger mb-4">{error}</div>}
      {/* Main Job Details Card */}
      <div className="card">
        <div className="card-header flex justify-between items-center">
          <div>
            {isEditingJob ? (
                <input
                    type="text"
                    value={editedJobData.title || ''}
                    onChange={(e) => setEditedJobData({...editedJobData, title: e.target.value})}
                    className="form-control text-2xl font-bold"
                />
            ) : (
                <h2 className="card-title">{job.title}</h2>
            )}
            <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">{new Date(job.start).toLocaleString()}</p>
          </div>
          {user?.role === 'admin' && !isEditingJob && (
            <button className="btn btn-secondary" onClick={() => setIsEditingJob(true)}>Edit Job</button>
          )}
        </div>
        <div className="card-body">
            {isEditingJob ? (
                 <div className="space-y-4">
                    <div>
                        <label className="form-label">Description</label>
                        <textarea
                            value={editedJobData.description || ''}
                            onChange={(e) => setEditedJobData({...editedJobData, description: e.target.value})}
                            className="form-control"
                            rows={3}
                        />
                    </div>
                    <div>
                        <label className="form-label">Recurrence</label>
                         <select
                            value={editedJobData.recurrence || 'none'}
                            onChange={(e) => setEditedJobData({...editedJobData, recurrence: e.target.value})}
                            className="form-control"
                        >
                            <option value="none">None</option>
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                            <option value="yearly">Yearly</option>
                        </select>
                    </div>
                    <div className="flex justify-end gap-2">
                        <button className="btn btn-secondary" onClick={() => { setIsEditingJob(false); setEditedJobData(job); }}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleJobUpdate}>Save Changes</button>
                    </div>
                 </div>
            ) : (
                 <dl className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2">
                    {/* ... (dl content remains the same, but with one change) ... */}
                    {job.stripe_invoice_id && user?.role !== 'admin' && ( // <-- This is the change
                        <div className="sm:col-span-1">
                           <dt className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">Invoice</dt>
                           <dd className="mt-1 text-sm">
                               <Link to={`/pay-invoice/${job.stripe_invoice_id}`} className="text-event-blue hover:underline">
                                   Pay Invoice
                               </Link>
                           </dd>
                        </div>
                    )}
                    {/* ... (the rest of the dl content) ... */}
                 </dl>
            )}
        </div>
        {user?.role === 'admin' && ['upcoming', 'confirmed'].includes(job.status) && (
            <div className="card-footer text-right">
                <button className="btn btn-success" onClick={handleFinalizeJob}>Finalize Job & Send Invoice</button>
            </div>
        )}
      </div>

      {/* Service Line Items Card */}
      <div className="card">
          <div className="card-header flex justify-between items-center">
            <h3 className="card-title text-xl">Service Line Items</h3>
            {user?.role === 'admin' && !editingService && (
                <button className="btn btn-primary" onClick={() => setEditingService({})}>Add Item</button>
            )}
          </div>
          <div className="card-body">
              {/* ... (list items) ... */}
              {editingService && (
                <div className="mt-4 p-4 border rounded-md bg-secondary-light/50 dark:bg-secondary-dark/50 space-y-3">
                    <h4 className="font-semibold">{editingService.id ? 'Edit' : 'Add'} Line Item</h4>
                     <input
                        type="text"
                        placeholder="Description"
                        value={editingService.notes || ''}
                        onChange={(e) => setEditingService({...editingService, notes: e.target.value})}
                        className="form-control"
                    />
                    <input
                        type="number"
                        placeholder="Price ($)"
                        step="0.01"
                        value={editingService.price_cents !== undefined ? editingService.price_cents / 100 : ''}
                        onChange={(e) => setEditingService({...editingService, price_cents: Number(e.target.value)})}
                        className="form-control"
                    />
                    <div className="flex justify-end gap-2">
                        <button className="btn btn-secondary" onClick={() => setEditingService(null)}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleServiceUpdate}>Save Item</button>
                    </div>
                </div>
              )}
          </div>
          {/* ... (card footer) ... */}
      </div>

      {/* Photos Card */}
      <div className="card">
          {/* ... (card header) ... */}
          <div className="card-body">
              {/* ... (photo grid) ... */}
          </div>
          {user?.role === 'admin' && (
             <div className="card-footer" {...getRootProps()}>
                <input {...getInputProps()} />
                <div className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-light">
                    {isDragActive ? <p>Drop files here...</p> : <p>Drag & drop photos or click to upload</p>}
                </div>
             </div>
          )}
      </div>

       {/* Notes Card */}
      <div className="card">
          {/* ... (card header) ... */}
          <div className="card-body">
              {/* ... (notes list) ... */}
          </div>
          {user?.role === 'admin' && (
             <div className="card-footer">
                <form onSubmit={handleNoteSubmit} className="flex gap-2">
                    <input
                        type="text"
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        className="form-control flex-grow"
                        placeholder="Add a new note..."
                    />
                    <button type="submit" className="btn btn-primary">Add Note</button>
                </form>
             </div>
          )}
      </div>
    </div>
  );
}

export default JobDetail;
