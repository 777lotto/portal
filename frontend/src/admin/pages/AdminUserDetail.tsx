import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import useSWR, { mutate } from 'swr'; // FIXED: Imported useSWR and mutate
import { apiGet, adminImportInvoicesForUser } from '../../lib/api';
import type { User, Job, Photo, Note } from '@portal/shared/src/types';
import AddJobModal from '../modals/AddJobModal'; // FIXED: Imported the modal

/**
 * Renders the tabbed view for a user's jobs, photos, and notes.
 * NOTE: This could be further improved by using nested routing.
 */
const UserTabs = ({ userId }: { userId: string }) => {
    const { data: jobs, isLoading: jobsLoading, error: jobsError } = useSWR<Job[]>(userId ? `/api/admin/jobs/user/${userId}` : null, apiGet);
    const { data: photos, isLoading: photosLoading, error: photosError } = useSWR<Photo[]>(userId ? `/api/admin/photos/user/${userId}` : null, apiGet);
    const { data: notes, isLoading: notesLoading, error: notesError } = useSWR<Note[]>(userId ? `/api/admin/notes/user/${userId}` : null, apiGet);
    const [activeTab, setActiveTab] = useState('jobs');

    const renderJobs = () => (
        <div>
            {jobsLoading && <p>Loading jobs...</p>}
            {jobsError && <p className="text-danger">Error loading jobs.</p>}
            {jobs && (
                <ul className="list-group">
                    {jobs.length === 0 && <li className="list-group-item">No jobs found.</li>}
                    {jobs.map(job => (
                        <li key={job.id} className="list-group-item d-flex justify-content-between align-items-center">
                            <Link to={`/admin/jobs/${job.id}`}>{job.title || 'Untitled Job'}</Link>
                            <span className={`badge bg-${job.status === 'completed' ? 'success' : 'secondary'}`}>{job.status}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );

    const renderPhotos = () => (
        <div>
            {photosLoading && <p>Loading photos...</p>}
            {photosError && <p className="text-danger">Error loading photos.</p>}
            {photos && (
                 <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {photos.length === 0 && <p>No photos found.</p>}
                    {photos.map(photo => (
                        <div key={photo.id} className="aspect-w-1 aspect-h-1">
                            <img src={photo.url} alt="Job photo" className="object-cover w-full h-full rounded-lg shadow-md" />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    const renderNotes = () => (
        <div>
            {notesLoading && <p>Loading notes...</p>}
            {notesError && <p className="text-danger">Error loading notes.</p>}
            {notes && (
                <ul className="list-group">
                    {notes.length === 0 && <li className="list-group-item">No notes found.</li>}
                    {notes.map(note => (
                        <li key={note.id} className="list-group-item">
                            <p>{note.note}</p>
                            <small className="text-muted">Created at: {new Date(note.created_at).toLocaleString()}</small>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );

    return (
        <div>
            <ul className="nav nav-tabs">
                <li className="nav-item">
                    <button className={`nav-link ${activeTab === 'jobs' ? 'active' : ''}`} onClick={() => setActiveTab('jobs')}>Jobs</button>
                </li>
                <li className="nav-item">
                    <button className={`nav-link ${activeTab === 'photos' ? 'active' : ''}`} onClick={() => setActiveTab('photos')}>Photos</button>
                </li>
                <li className="nav-item">
                    <button className={`nav-link ${activeTab === 'notes' ? 'active' : ''}`} onClick={() => setActiveTab('notes')}>Notes</button>
                </li>
            </ul>
            <div className="tab-content p-3 border border-top-0">
                {activeTab === 'jobs' && renderJobs()}
                {activeTab === 'photos' && renderPhotos()}
                {activeTab === 'notes' && renderNotes()}
            </div>
        </div>
    );
};


const AdminUserDetail = () => {
  const { user_id } = useParams<{ user_id: string }>();
  const [message, setMessage] = useState<{ type: 'success' | 'danger'; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAddJobModalOpen, setAddJobModalOpen] = useState(false);

  // Fetch user data using SWR for consistency and caching.
  const { data: user, error, isLoading } = useSWR<User>(user_id ? `/api/admin/users/${user_id}` : null, apiGet);

  const handleImportInvoices = async () => {
    if (!user_id) return;
    setIsSubmitting(true);
    try {
      const result = await adminImportInvoicesForUser(user_id);
      setMessage({ type: 'success', text: `Successfully imported ${result.imported} invoices. Skipped ${result.skipped}.` });
      // Mutate jobs data to refresh the list in the UserTabs component
      mutate(`/api/admin/jobs/user/${user_id}`);
    } catch (err: any) {
      setMessage({ type: 'danger', text: `Failed to import invoices: ${err.message}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJobAdded = (newJob: Job) => {
    setAddJobModalOpen(false);
    setMessage({ type: 'success', text: `Successfully created new job: ${newJob.title}` });
    // Mutate jobs data to refresh the list in the UserTabs component
    mutate(`/api/admin/jobs/user/${user_id}`);
  };

  // Display loading state
  if (isLoading) {
    return <div className="p-4">Loading user details...</div>;
  }

  // Display error state
  if (error || !user) {
      return <div className="p-4"><div className="alert alert-danger">Error loading user data. {(error as any)?.message || 'User not found.'}</div></div>;
  }

  return (
    <div className="container-fluid p-4">
      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      {/* Conditionally render the "Add Job" modal */}
      {isAddJobModalOpen && user_id && (
        <AddJobModal
          userId={user_id}
          onJobAdd={handleJobAdded}
          onClose={() => setAddJobModalOpen(false)}
        />
      )}

      {/* FIXED: The InvoiceEditor component was removed from here because it was not defined or imported,
        which would cause the page to crash. You can re-implement it when it's ready.
      */}

      <div className="card">
        <div className="card-header">
            <h1 className="text-2xl font-bold">{user.company_name || user.name}</h1>
            <p className="text-muted">{user.email} | {user.phone}</p>
            <p className="text-muted">{user.address}</p>
        </div>
        <div className="card-body">
            <div className="d-flex gap-2 mb-3">
                {/* FIXED: This button now opens the Add Job modal */}
                <button className="btn btn-primary" onClick={() => setAddJobModalOpen(true)} disabled={isSubmitting}>
                    Create New Job
                </button>
                 <button className="btn btn-secondary" onClick={handleImportInvoices} disabled={isSubmitting}>
                    {isSubmitting ? 'Importing...' : 'Import from Stripe'}
                </button>
            </div>

            <hr />

            {user_id && <UserTabs userId={user_id} />}
        </div>
      </div>
    </div>
  );
};

export default AdminUserDetail;
