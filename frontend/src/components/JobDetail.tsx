// frontend/src/components/JobDetail.tsx - FINAL
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { apiGet, getServicesForJob } from '../lib/api.js';
import type { Job, Service, Photo, Note } from '@portal/shared';

function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchJobDetails = async () => {
      if (!id) return;

      try {
        setIsLoading(true);
        setError(null);

        // Fetch all data in parallel
        const [jobData, servicesData, photosData, notesData] = await Promise.all([
          apiGet<Job>(`/api/jobs/${id}`),
          getServicesForJob(id),
          apiGet<Photo[]>(`/api/jobs/${id}/photos`),
          apiGet<Note[]>(`/api/jobs/${id}/notes`)
        ]);

        setJob(jobData);
        setServices(servicesData);
        setPhotos(photosData);
        setNotes(notesData);

      } catch (err: any) {
        console.error("Error fetching job details:", err);
        setError(err.message || 'An unknown error occurred.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchJobDetails();
  }, [id]);

  const statusStyle = (status: string) => {
      switch (status.toLowerCase()) {
        case 'upcoming': return 'bg-yellow-100 text-yellow-800';
        case 'confirmed': return 'bg-blue-100 text-blue-800';
        case 'completed':
        case 'paid':
             return 'bg-green-100 text-green-800';
        case 'payment_pending': return 'bg-orange-100 text-orange-800';
        case 'past_due': return 'bg-red-100 text-red-800';
        case 'cancelled': return 'bg-gray-100 text-gray-800';
        default: return 'bg-gray-100 text-gray-800';
      }
  };

  if (isLoading) return <div className="text-center p-8">Loading job details...</div>;
  if (error) return <div className="rounded-md bg-red-100 p-4 text-sm text-red-700">{error}</div>;
  if (!job) return <div className="text-center p-8"><h2>Job not found</h2></div>;

  const totalCost = services.reduce((acc, service) => acc + (service.price_cents || 0), 0);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Main Job Details Card */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">{job.title}</h2>
          <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">{new Date(job.start).toLocaleString()}</p>
        </div>
        <div className="card-body">
           <dl className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2">
              <div className="sm:col-span-1">
                 <dt className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">Status</dt>
                 <dd className="mt-1 text-sm">
                  <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${statusStyle(job.status)}`}>
                    {job.status.replace(/_/g, ' ')}
                  </span>
                 </dd>
              </div>
              <div className="sm:col-span-1">
                 <dt className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">Total Cost</dt>
                 <dd className="mt-1 text-sm font-semibold">${(totalCost / 100).toFixed(2)}</dd>
              </div>
              {job.description && (
                <div className="sm:col-span-2">
                   <dt className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">Description</dt>
                   <dd className="mt-1 text-sm">{job.description}</dd>
                </div>
              )}
           </dl>
        </div>
      </div>

      {/* Service Line Items Card */}
      <div className="card">
          <div className="card-header"><h3 className="card-title text-xl">Service Line Items</h3></div>
          <div className="card-body">
              {services.length > 0 ? (
                  <ul className="divide-y divide-border-light dark:divide-border-dark">
                      {services.map(service => (
                          <li key={service.id} className="py-3 flex justify-between items-center">
                              <span>{service.notes}</span>
                              <span className="font-medium">${(service.price_cents / 100).toFixed(2)}</span>
                          </li>
                      ))}
                  </ul>
              ) : <p>No service items found for this job.</p>}
          </div>
      </div>

      {/* Photos Card */}
      <div className="card">
          <div className="card-header"><h3 className="card-title text-xl">Photos</h3></div>
          <div className="card-body">
              {photos.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {photos.map(photo => (
                          <a key={photo.id} href={photo.url} target="_blank" rel="noopener noreferrer">
                              <img src={photo.url} alt={`Job photo taken on ${new Date(photo.created_at).toLocaleDateString()}`} className="rounded-lg object-cover aspect-square"/>
                          </a>
                      ))}
                  </div>
              ) : <p>No photos found for this job.</p>}
          </div>
      </div>

       {/* Notes Card */}
      <div className="card">
          <div className="card-header"><h3 className="card-title text-xl">Notes</h3></div>
          <div className="card-body">
              {notes.length > 0 ? (
                  <ul className="space-y-4">
                      {notes.map(note => (
                          <li key={note.id} className="p-3 bg-secondary-light dark:bg-secondary-dark rounded-md">
                              <p className="text-sm">{note.content}</p>
                              <small className="text-text-secondary-light dark:text-text-secondary-dark">{new Date(note.created_at).toLocaleString()}</small>
                          </li>
                      ))}
                  </ul>
              ) : <p>No notes found for this job.</p>}
          </div>
      </div>
    </div>
  );
}

export default JobDetail;
