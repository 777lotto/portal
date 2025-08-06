// frontend/src/components/Services.tsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiGet, apiPost } from '../lib/api.js'; // MODIFIED: import apiPost
import type { Service, Job } from '@portal/shared';

function Services() {
  const [services, setServices] = useState<Service[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]); // MODIFIED: Add state for jobs
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const fetchServicesAndJobs = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const [servicesData, jobsData] = await Promise.all([
            getServices(),
            apiGet<Job[]>('/api/jobs') // Assuming this endpoint exists for customers
        ]);
        setServices(servicesData);
        setJobs(jobsData);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
  };

  useEffect(() => {
    fetchServicesAndJobs();
  }, []);

  const handleAcceptQuote = async (quoteId: string) => {
    if (!window.confirm("By accepting this quote, you agree to the terms and services outlined. Do you wish to proceed?")) {
        return;
    }
    try {
        // This endpoint will trigger the Stripe quote acceptance flow
        await apiPost(`/api/quotes/${quoteId}/accept`, {});
        setMessage("Quote accepted successfully! We will contact you shortly to schedule the job.");
        fetchServicesAndJobs(); // Refresh data
    } catch (err: any) {
        setError(err.message);
    }
  };

  const pendingQuotes = jobs.filter(job => job.status === 'pending_quote' && job.stripe_quote_id);
  const otherJobs = jobs.filter(job => job.status !== 'pending_quote');

  if (isLoading) return <div className="container mt-4">Loading...</div>;
  if (error) return <div className="container mt-4 alert alert-danger">{error}</div>;

  return (
    <div className="container mt-4">
      <h2>Your Services & Quotes</h2>
      {message && <div className="alert alert-success">{message}</div>}

      {/* --- NEW: PENDING QUOTES SECTION --- */}
      {pendingQuotes.length > 0 && (
          <div className="card my-4">
              <div className="card-header">
                  <h4 className="mb-0">Pending Quotes</h4>
              </div>
              <div className="list-group list-group-flush">
                  {pendingQuotes.map(job => (
                      <div key={job.id} className="list-group-item d-flex justify-content-between align-items-center">
                          <div>
                              <h5 className="mb-1">{job.title}</h5>
                              <p className="mb-1">{job.description}</p>
                              <small>Quote created: {new Date(job.createdAt).toLocaleDateString()}</small>
                          </div>
                          <button
                              className="btn btn-success"
                              onClick={() => handleAcceptQuote(job.stripe_quote_id!)}
                          >
                              Review & Accept Quote
                          </button>
                      </div>
                  ))}
              </div>
          </div>
      )}


      {/* --- EXISTING SERVICES/JOBS SECTION --- */}
      <div className="card">
          <div className="card-header">
              <h4 className="mb-0">Scheduled & Past Jobs</h4>
          </div>
          <div className="list-group list-group-flush">
            {otherJobs.length > 0 ? (
              otherJobs.map(job => (
                <Link key={job.id} to={`/jobs/${job.id}`} className="list-group-item list-group-item-action">
                  <div className="d-flex w-100 justify-content-between">
                    <h5 className="mb-1">{job.title}</h5>
                    <small>Status: {job.status}</small>
                  </div>
                  <p>Date: {new Date(job.start).toLocaleDateString()}</p>
                </Link>
              ))
            ) : (
              <p className="p-3">You have no scheduled jobs.</p>
            )}
          </div>
      </div>
    </div>
  );
}

export default Services;
