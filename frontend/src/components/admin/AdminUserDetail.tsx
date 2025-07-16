// frontend/src/components/admin/AdminUserDetail.tsx
import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { apiGet, apiPost, apiPostFormData, adminCreateJobForUser, adminFinalizeJob, adminImportInvoicesForUser, adminCreateInvoice } from '../../lib/api';
import type { Job, User, PhotoWithNotes, Note, StripeInvoice } from '@portal/shared';
import { InvoiceEditor } from './InvoiceEditor';
import { QuoteManager } from './QuoteManager';

function AdminUserDetail() {
  const { userId } = useParams<{ userId: string }>();

  // State
  const [user, setUser] = useState<User | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [photos, setPhotos] = useState<PhotoWithNotes[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'danger', text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});
  const [uploadJobId, setUploadJobId] = useState<string>('');
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [newJobData, setNewJobData] = useState({ title: '', start: '', services: [{ notes: '', price_cents: '' }] });
  const [isImporting, setIsImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [activeInvoice, setActiveInvoice] = useState<StripeInvoice | null>(null);


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

  const handleCreateInvoiceClick = async () => {
    if (!userId) return;
    if (!window.confirm("Are you sure you want to create a new draft invoice for this user? This will not be associated with a specific job.")) {
        return;
    }

    setMessage(null);
    setIsSubmitting(true);
    try {
        const { invoice } = await adminCreateInvoice(userId);
        setActiveInvoice(invoice);
        setMessage({ type: 'success', text: 'Draft invoice created successfully! You can now add line items.' });
    } catch (err: any) {
        setMessage({ type: 'danger', text: `Failed to create invoice: ${err.message}` });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleImportClick = async () => {
      if (!userId) return;
      if (!window.confirm(`This will import this user's paid Stripe invoices as jobs. This may take a moment. Continue?`)) {
          return;
      }
      setIsImporting(true);
      setImportMessage(null);
      setError(null);
      try {
          const result = await adminImportInvoicesForUser(userId);
          let messageText = `Import complete! ${result.imported} jobs created, ${result.skipped} skipped.`;
          if (result.errors && result.errors.length > 0) {
              messageText += ` Errors: ${result.errors.join(', ')}`;
          }
          setImportMessage(messageText);
          fetchDataForUser(); // Refresh the jobs list
      } catch (err: any) {
          setError(`Import failed: ${err.message}`);
      } finally {
          setIsImporting(false);
      }
  };

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

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !newJobData.title || !newJobData.start || newJobData.services.some(s => !s.notes || !s.price_cents)) {
        setMessage({ type: 'danger', text: 'Please fill out all job and service fields.' });
        return;
    }
    setIsSubmitting(true);
    setMessage(null);
    try {
        const payload = {
            ...newJobData,
            start: new Date(newJobData.start).toISOString(),
            services: newJobData.services.map(s => ({
                notes: s.notes,
                price_cents: Math.round(parseFloat(s.price_cents) * 100)
            }))
        };
        await adminCreateJobForUser(userId, payload);
        setMessage({ type: 'success', text: 'Job created successfully!' });
        setIsJobModalOpen(false);
        setNewJobData({ title: '', start: '', services: [{ notes: '', price_cents: '' }] });
        fetchDataForUser();
    } catch (err: any) {
        setMessage({ type: 'danger', text: `Failed to create job: ${err.message}` });
    } finally {
        setIsSubmitting(false);
    }
};

  const handleFinalizeJob = async (jobId: string) => {
    if (!window.confirm("Are you sure you want to finalize this job? This will generate and send an invoice to the customer.")) {
      return;
    }
    setIsSubmitting(true);
    setMessage(null);
    try {
      const result = await adminFinalizeJob(jobId);
      setMessage({ type: 'success', text: `Job finalized and invoice ${result.invoiceId} sent!` });
      fetchDataForUser(); // Refresh data
    } catch (err: any) {
      setMessage({ type: 'danger', text: `Failed to finalize job: ${err.message}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className="container mt-4">Loading user details...</div>;

  return (
    <div className="container max-w-7xl mx-auto mt-4">
      <Link to="/admin/users">&larr; Back to Users</Link>
      <h2 className="mt-2">Manage User: {user ? user.name : userId}</h2>
      {error && <div className="alert alert-danger">{error}</div>}
      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}
      {importMessage && <div className="alert alert-info">{importMessage}</div>}

      {/* Job Management Card */}
      <div className="card mt-4">
        <div className="card-header flex justify-between items-center">
            <h5 className="mb-0">Jobs</h5>
            <div className="flex items-center gap-2">
              <button
                className="btn btn-secondary"
                onClick={handleImportClick}
                disabled={isImporting}
              >
                  {isImporting ? 'Importing...' : 'Import Invoices'}
              </button>
              <button className="btn btn-primary" onClick={() => setIsJobModalOpen(true)}>Add Job</button>
            </div>
        </div>
        <div className="card-body">
            {jobs.length > 0 ? (
                <ul className="list-group">
                    {jobs.map(job => (
                        <li key={job.id} className="list-group-item">
                            <div className="d-flex justify-content-between align-items-center">
                                <div>
                                    <Link to={`/jobs/${job.id}`} className="fw-bold">{job.title}</Link>
                                    <p className="mb-0"><small>Date: {new Date(job.start).toLocaleString()}</small></p>
                                    <p className="mb-0"><small>Status: <span className="badge bg-secondary">{job.status}</span></small></p>
                                </div>
                                {['upcoming', 'confirmed'].includes(job.status) && (
                                  <button
                                    className="btn btn-success"
                                    onClick={() => handleFinalizeJob(job.id)}
                                    disabled={isSubmitting}
                                  >
                                    {isSubmitting ? 'Finalizing...' : 'Finalize Job'}
                                  </button>
                                )}
                            </div>
                            <div className="mt-3">
                                <QuoteManager job={job} onQuoteCreated={fetchDataForUser} />
                            </div>
                        </li>
                    ))}
                </ul>
            ) : (
                <p>No jobs found for this user.</p>
            )}
        </div>
      </div>

      {/* Invoice Management Card */}
      <div className="card mt-4">
          <div className="card-header flex justify-between items-center">
              <h5 className="mb-0">Manual Invoice</h5>
              <button className="btn btn-info" onClick={handleCreateInvoiceClick} disabled={isSubmitting}>
                  {isSubmitting ? 'Creating...' : 'Create New Invoice'}
              </button>
          </div>
          {activeInvoice && (
              <div className="card-body">
                  <InvoiceEditor invoiceId={activeInvoice.id} onFinalize={() => {
                      setActiveInvoice(null);
                      fetchDataForUser();
                  }} />
              </div>
          )}
      </div>


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

      {/* Add Job Modal */}
      {isJobModalOpen && (
          <div className="modal show" style={{ display: 'block' }} tabIndex={-1}>
              <div className="modal-dialog">
                  <div className="modal-content">
                      <form onSubmit={handleCreateJob}>
  <div className="modal-body">
    <div className="mb-3">
      <label htmlFor="title" className="form-label">Job Title</label>
      <input
        type="text"
        className="form-control"
        id="title"
        required
        value={newJobData.title}
        onChange={e => setNewJobData({ ...newJobData, title: e.target.value })}
      />
    </div>
    <div className="mb-3">
      <label htmlFor="start" className="form-label">Job Date</label>
      <input
        type="datetime-local"
        className="form-control"
        id="start"
        required
        value={newJobData.start}
        onChange={e => setNewJobData({ ...newJobData, start: e.target.value })}
      />
    </div>

    <hr className="my-4" />
    <h6 className="font-bold">Service Line Items</h6>
    {newJobData.services.map((service, index) => (
      <div key={index} className="row g-3 align-items-center mb-2">
        <div className="col">
          <input
            type="text"
            className="form-control"
            placeholder="Service description"
            required
            value={service.notes}
            onChange={e => {
              const newServices = [...newJobData.services];
              newServices[index].notes = e.target.value;
              setNewJobData({ ...newJobData, services: newServices });
            }}
          />
        </div>
        <div className="col">
          <input
            type="number"
            step="0.01"
            className="form-control"
            placeholder="Price ($)"
            required
            value={service.price_cents}
            onChange={e => {
              const newServices = [...newJobData.services];
              newServices[index].price_cents = e.target.value;
              setNewJobData({ ...newJobData, services: newServices });
            }}
          />
        </div>
        <div className="col-auto">
          {newJobData.services.length > 1 && (
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                const newServices = newJobData.services.filter((_, i) => i !== index);
                setNewJobData({ ...newJobData, services: newServices });
              }}
            >
              Remove
            </button>
          )}
        </div>
      </div>
    ))}
    <button
      type="button"
      className="btn btn-secondary mt-2"
      onClick={() => {
        const newServices = [...newJobData.services, { notes: '', price_cents: '' }];
        setNewJobData({ ...newJobData, services: newServices });
      }}
    >
      Add Another Service
    </button>

  </div>
  <div className="modal-footer">
    <button type="button" className="btn btn-secondary" onClick={() => setIsJobModalOpen(false)}>Close</button>
    <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
      {isSubmitting ? 'Saving...' : 'Save Job'}
    </button>
  </div>
</form>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}

export default AdminUserDetail;
