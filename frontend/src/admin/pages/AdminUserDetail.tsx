import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiGet, adminCreateJob, adminImportInvoicesForUser } from '../../lib/api';
import type { User, Job, Photo, Note, StripeInvoice } from '@portal/shared';

// New component for tabbed navigation
const UserTabs = ({ userId }: { userId: string }) => {
    const { data: jobs, isLoading: jobsLoading } = useSWR<Job[]>(`/api/admin/jobs/user/${userId}`, apiGet);
    const { data: photos, isLoading: photosLoading } = useSWR<Photo[]>(`/api/admin/photos/user/${userId}`, apiGet);
    const { data: notes, isLoading: notesLoading } = useSWR<Note[]>(`/api/admin/notes/user/${userId}`, apiGet);
    const [activeTab, setActiveTab] = useState('jobs');

    const renderJobs = () => (
        <div>
            {jobsLoading ? <p>Loading jobs...</p> : (
                <ul className="list-group">
                    {jobs?.map(job => (
                        <li key={job.id} className="list-group-item">
                            <Link to={`/admin/jobs/${job.id}`}>{job.title}</Link> - {job.status}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );

    const renderPhotos = () => (
        <div>
            {photosLoading ? <p>Loading photos...</p> : (
                <div className="grid grid-cols-4 gap-4">
                    {photos?.map(photo => (
                        <img key={photo.id} src={photo.url} alt="User photo" className="img-thumbnail" />
                    ))}
                </div>
            )}
        </div>
    );

    const renderNotes = () => (
        <div>
            {notesLoading ? <p>Loading notes...</p> : (
                <ul className="list-group">
                    {notes?.map(note => (
                        <li key={note.id} className="list-group-item">{note.content}</li>
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
            <div className="tab-content p-3 border">
                {activeTab === 'jobs' && renderJobs()}
                {activeTab === 'photos' && renderPhotos()}
                {activeTab === 'notes' && renderNotes()}
            </div>
        </div>
    );
};

export function AdminUserDetail() {
  const { user_id } = useParams<{ user_id: string }>();
  const [user, setUser] = useState<User | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'danger'; text: string; } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeInvoice, setActiveInvoice] = useState<StripeInvoice | null>(null);

  const fetchData = useCallback(async () => {
    if (!user_id) return;
    try {
      const userData = await apiGet<User>(`/api/admin/users/${user_id}`);
      setUser(userData);
    } catch (err: any)      {
      setMessage({ type: 'danger', text: `Failed to fetch user data: ${err.message}` });
    }
  }, [user_id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateInvoiceClick = async () => {
    if (!user_id) return;
    setIsSubmitting(true);
    setMessage(null);
    try {
      const { invoice } = await adminCreateJob({
        user_id,
        title: 'New Draft Invoice',
        lineItems: [],
        jobType: 'invoice',
        isDraft: true,
      });
      setActiveInvoice(invoice);
      setMessage({ type: 'success', text: 'New draft invoice created successfully.' });
    } catch (err: any) {
      setMessage({ type: 'danger', text: `Failed to create invoice: ${err.message}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImportInvoices = async () => {
    if (!user_id) return;
    setIsSubmitting(true);
    setMessage(null);
    try {
      const result = await adminImportInvoicesForUser(user_id);
      setMessage({ type: 'success', text: `Successfully imported ${result.imported} invoices. Skipped ${result.skipped}.` });
      fetchData(); // Re-fetch data to show new jobs
    } catch (err: any) {
      setMessage({ type: 'danger', text: `Failed to import invoices: ${err.message}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container-fluid p-4">
      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}
      {activeInvoice && <InvoiceEditor invoice={activeInvoice} onClose={() => setActiveInvoice(null)} />}

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

            <UserTabs userId={user_id} />
        </div>
      </div>
    </div>
  );
}
