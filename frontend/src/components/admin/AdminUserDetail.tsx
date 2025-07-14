// frontend/src/components/admin/AdminUserDetail.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { apiGet, apiPost, apiPostFormData, deleteUser, adminCreateInvoice } from '../../lib/api.js';
import type { Job, Photo, User, StripeInvoice, Service } from '@portal/shared'; // MODIFIED: Import Service
import { InvoiceEditor } from './InvoiceEditor.js';
import { QuoteManager } from './QuoteManager.js'; // MODIFIED: Import QuoteManager

function AdminUserDetail() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();

  // State
  const [user, setUser] = useState<User | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(true);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(true);

  // MODIFIED: State for managing services on a specific job
  const [services, setServices] = useState<Service[]>([]);
  const [selectedJobForServices, setSelectedJobForServices] = useState<Job | null>(null);
  const [newService, setNewService] = useState({ notes: '', price: '' });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'danger', text: string } | null>(null);

  const [activeInvoice, setActiveInvoice] = useState<StripeInvoice | null>(null);
  const [error, setError] = useState<string | null>(null);


  const fetchDataForUser = useCallback(async () => {
    if (!userId) return;
    setIsLoadingJobs(true);
    try {
      const [allUsers, userJobs] = await Promise.all([
        apiGet<User[]>('/api/admin/users'),
        apiGet<Job[]>(`/api/admin/users/${userId}/jobs`),
      ]);
      const currentUser = allUsers.find(u => u.id.toString() === userId);
      setUser(currentUser || null);
      setJobs(userJobs);
    } catch (err: any) {
      setError(err.message);
      console.error("Failed to fetch data for user", err);
    } finally {
      setIsLoadingJobs(false);
    }
  }, [userId]);


  useEffect(() => {
    fetchDataForUser();
  }, [fetchDataForUser]);

  const handleSelectJobForServices = async (job: Job) => {
    setSelectedJobForServices(job);
    // Fetch services for this job
    const fetchedServices = await apiGet<Service[]>(`/api/jobs/${job.id}/services`);
    setServices(fetchedServices);
  }

  const handleAddServiceToJob = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedJobForServices || !newService.notes || !newService.price) return;

      setIsSubmitting(true);
      setMessage(null);
      try {
          const price_cents = Math.round(parseFloat(newService.price) * 100);
          await apiPost(`/api/admin/jobs/${selectedJobForServices.id}/services`, {
              notes: newService.notes,
              price_cents,
          });
          setNewService({ notes: '', price: '' });
          // Refresh services for the current job
          handleSelectJobForServices(selectedJobForServices);
          setMessage({ type: 'success', text: 'Service added successfully!' });
      } catch (err: any) {
          setMessage({ type: 'danger', text: `Error: ${err.message}` });
      } finally {
          setIsSubmitting(false);
      }
  };

  const handleCompleteJob = async (jobId: string) => {
      if (!window.confirm("Are you sure you want to mark this job as complete and issue an invoice?")) return;
      setIsSubmitting(true);
      setMessage(null);
      try {
          await apiPost(`/api/admin/jobs/${jobId}/complete`, {});
          setMessage({ type: 'success', text: 'Job marked as complete and invoice sent!' });
          fetchDataForUser(); // Refresh all user data
      } catch (err: any) {
          setMessage({ type: 'danger', text: `Error: ${err.message}` });
      } finally {
          setIsSubmitting(false);
      }
  };


  return (
    <div className="container mt-4">
      <Link to="/admin/users">&larr; Back to Users</Link>
      <h2 className="mt-2">Manage User: {user ? user.name : userId}</h2>
      {error && <div className="alert alert-danger">{error}</div>}
      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      <div className="card mt-4">
        <div className="card-body">
          <h5 className="card-title">Jobs</h5>
          {isLoadingJobs ? <p>Loading jobs...</p> : (
            <div className="list-group">
              {jobs.map(job => (
                <div key={job.id} className="list-group-item">
                  <h6>{job.title} - {new Date(job.start).toLocaleDateString()}</h6>
                  <p>Status: <span className="badge bg-info">{job.status}</span></p>
                  <button className="btn btn-sm btn-secondary me-2" onClick={() => handleSelectJobForServices(job)}>
                    Manage Services & Quote
                  </button>
                  {job.status === 'quote_accepted' && (
                    <button
                      className="btn btn-sm btn-success"
                      onClick={() => handleCompleteJob(job.id)}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? 'Completing...' : 'Mark Complete & Invoice'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedJobForServices && (
        <div className="card mt-4">
          <div className="card-body">
            <h5 className="card-title">Manage Services for Job: {selectedJobForServices.title}</h5>
             {/* Service List */}
            <ul className="list-group mb-3">
                {services.map(s => <li key={s.id} className="list-group-item">{s.notes} - ${(s.price_cents / 100).toFixed(2)}</li>)}
            </ul>

             {/* Add Service Form */}
            <form onSubmit={handleAddServiceToJob} className="mb-4">
                <h6>Add a Service Line Item</h6>
                <div className="row g-3">
                    <div className="col-md-6">
                        <input type="text" className="form-control" placeholder="Service Description" value={newService.notes} onChange={e => setNewService({...newService, notes: e.target.value})} required/>
                    </div>
                    <div className="col-md-4">
                        <input type="number" step="0.01" className="form-control" placeholder="Price ($)" value={newService.price} onChange={e => setNewService({...newService, price: e.target.value})} required/>
                    </div>
                    <div className="col-md-2">
                         <button type="submit" className="btn btn-primary w-100" disabled={isSubmitting}>Add</button>
                    </div>
                </div>
            </form>

             {/* Quote Manager */}
            <QuoteManager job={selectedJobForServices} onQuoteCreated={fetchDataForUser} />
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminUserDetail;
