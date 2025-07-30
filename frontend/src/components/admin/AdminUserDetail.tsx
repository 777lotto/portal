import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { apiGet, apiPost, apiPostFormData, adminCreateJob, adminFinalizeJob, adminImportInvoicesForUser, adminMarkInvoiceAsPaid } from '../../lib/api'; // Corrected import
import type { Job, User, PhotoWithNotes, Note, StripeInvoice } from '@portal/shared';
import { InvoiceEditor } from './InvoiceEditor';
import { format } from 'date-fns';

type Message = { type: 'success' | 'danger'; text: string; };

export function AdminUserDetail() {
  const { userId } = useParams<{ userId: string }>();
  const [user, setUser] = useState<User | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [photos, setPhotos] = useState<PhotoWithNotes[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState('');
  const [message, setMessage] = useState<Message | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeInvoice, setActiveInvoice] = useState<StripeInvoice | null>(null);

  const fetchData = useCallback(async () => {
    if (!userId) return;
    try {
      const [userData, jobsData, photosData, notesData] = await Promise.all([
        apiGet<User>(`/api/admin/users/${userId}`),
        apiGet<Job[]>(`/api/admin/users/${userId}/jobs`),
        apiGet<PhotoWithNotes[]>(`/api/admin/users/${userId}/photos`),
        apiGet<Note[]>(`/api/admin/users/${userId}/notes`),
      ]);
      setUser(userData);
      setJobs(jobsData);
      setPhotos(photosData);
      setNotes(notesData);
    } catch (err: any) {
      setMessage({ type: 'danger', text: `Failed to fetch user data: ${err.message}` });
    }
  }, [userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!userId) return;
    const formData = new FormData();
    formData.append('photo', acceptedFiles[0]);
    formData.append('notes', 'Uploaded by admin');

    try {
      await apiPostFormData(`/api/admin/users/${userId}/photos`, formData);
      setMessage({ type: 'success', text: 'Photo uploaded successfully!' });
      fetchData(); // Refresh photos
    } catch (err: any) {
      setMessage({ type: 'danger', text: `Photo upload failed: ${err.message}` });
    }
  }, [userId, fetchData]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  const handleAddNote = async () => {
    if (!userId || !newNote.trim()) return;
    try {
      await apiPost(`/api/admin/users/${userId}/notes`, { notes: newNote });
      setNewNote('');
      setMessage({ type: 'success', text: 'Note added successfully!' });
      fetchData(); // Refresh notes
    } catch (err: any) {
      setMessage({ type: 'danger', text: `Failed to add note: ${err.message}` });
    }
  };

  const handleCreateInvoiceClick = async () => {
    if (!userId) return;
    if (!window.confirm("Are you sure you want to create a new draft invoice for this user?")) {
        return;
    }
    setMessage(null);
    setIsSubmitting(true);
    try {
        // Use the new, unified adminCreateJob function
        const { job } = await adminCreateJob({
            user_id: userId,
            jobType: 'invoice',
            title: `Draft Invoice - ${new Date().toLocaleDateString()}`,
            start: new Date().toISOString(),
            services: [], // A draft invoice starts with no line items
            isDraft: true,
        });
        setMessage({ type: 'success', text: `Draft invoice created successfully! You can now add line items. Associated Job ID: ${job.id}` });
        // You might want to navigate to an invoice editor or refresh data
        fetchData();
    } catch (err: any) {
        setMessage({ type: 'danger', text: `Failed to create invoice: ${err.message}` });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleImportInvoices = async () => {
    if (!userId) return;
    setIsSubmitting(true);
    try {
        await adminImportInvoicesForUser(userId);
        setMessage({ type: 'success', text: 'Invoices imported successfully! Refreshing data...' });
        fetchData();
    } catch (err: any) {
        setMessage({ type: 'danger', text: `Failed to import invoices: ${err.message}` });
    } finally {
        setIsSubmitting(false);
    }
  };


  if (!user) return <div className="p-4">Loading user details...</div>;
  if (activeInvoice) {
    return <InvoiceEditor invoice={activeInvoice} onBack={() => setActiveInvoice(null)} onSave={fetchData} />;
  }

  return (
    <div className="container-fluid p-4">
      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      <div className="card">
        <div className="card-header">
            <h1 className="text-2xl font-bold">{user.company_name || user.name}</h1>
            <p>{user.email} | {user.phone}</p>
            <p>{user.address}</p>
        </div>
        <div className="card-body">
            <div className="d-flex gap-2 mb-3">
                <button className="btn btn-primary" onClick={handleCreateInvoiceClick} disabled={isSubmitting}>
                    {isSubmitting ? 'Creating...' : 'Create New Invoice'}
                </button>
                 <button className="btn btn-secondary" onClick={handleImportInvoices} disabled={isSubmitting}>
                    {isSubmitting ? 'Importing...' : 'Import from Stripe'}
                </button>
            </div>

            <hr />

            <h2 className="text-xl font-semibold mt-4">Jobs ({jobs.length})</h2>
            <div className="list-group">
                {jobs.map(job => (
                    <Link key={job.id} to={`/admin/jobs/${job.id}`} className="list-group-item list-group-item-action">
                        {job.title} - {format(new Date(job.start), 'MMMM do, yyyy')} - <span className={`badge bg-${job.status === 'completed' ? 'success' : 'warning'}`}>{job.status}</span>
                    </Link>
                ))}
            </div>

            <h2 className="text-xl font-semibold mt-4">Photos ({photos.length})</h2>
            <div {...getRootProps()} className="border-2 border-dashed rounded-lg p-5 text-center cursor-pointer hover:border-primary-dark">
                <input {...getInputProps()} />
                {isDragActive ? <p>Drop the files here ...</p> : <p>Drag 'n' drop some files here, or click to select files</p>}
            </div>
            <div className="row mt-3">
                {photos.map(p => (
                    <div key={p.id} className="col-md-3 mb-3">
                        <img src={p.url} alt="User upload" className="img-fluid rounded" />
                    </div>
                ))}
            </div>

            <h2 className="text-xl font-semibold mt-4">Notes</h2>
            <div className="mb-3">
                <textarea className="form-control" value={newNote} onChange={(e) => setNewNote(e.target.value)} rows={3}></textarea>
                <button className="btn btn-primary mt-2" onClick={handleAddNote}>Add Note</button>
            </div>
            <ul className="list-group">
                {notes.map(note => (
                    <li key={note.id} className="list-group-item">{note.notes}</li>
                ))}
            </ul>
        </div>
      </div>
    </div>
  );
}
