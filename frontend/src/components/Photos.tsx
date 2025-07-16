// frontend/src/components/Photos.tsx
import { useState, useEffect } from 'react';
import { getPhotos } from '../lib/api.js';
import type { PhotoWithNotes } from '@portal/shared';

function Photos() {
  const [photos, setPhotos] = useState<PhotoWithNotes[]>([]);
  const [filters, setFilters] = useState({
    created_at: '',
    job_id: '',
    service_id: '',
    invoice_id: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPhotos = async () => {
      try {
        setIsLoading(true);
        setError(null);
        // Create a clean filter object with only non-empty values
        const activeFilters = Object.fromEntries(
          Object.entries(filters).filter(([, value]) => value !== '')
        );
        const data = await getPhotos(activeFilters);
        setPhotos(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPhotos();
  }, [filters]); // Refetch when filters change

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
      <h2 className="text-2xl font-bold mb-4">Your Photos</h2>

      {/* Filter Section */}
      <div className="card mb-4">
        <div className="card-body">
          <h5 className="card-title">Filter Photos</h5>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label htmlFor="created_at" className="form-label">Date</label>
              <input type="date" id="created_at" name="created_at" value={filters.created_at} onChange={handleFilterChange} className="form-control" />
            </div>
            <div>
              <label htmlFor="job_id" className="form-label">Job ID</label>
              <input type="text" id="job_id" name="job_id" value={filters.job_id} onChange={handleFilterChange} className="form-control" placeholder="Job ID"/>
            </div>
            <div>
              <label htmlFor="service_id" className="form-label">Service ID</label>
              <input type="text" id="service_id" name="service_id" value={filters.service_id} onChange={handleFilterChange} className="form-control" placeholder="Service ID"/>
            </div>
            <div>
              <label htmlFor="invoice_id" className="form-label">Invoice ID</label>
              <input type="text" id="invoice_id" name="invoice_id" onChange={handleFilterChange} className="form-control" placeholder="Invoice ID"/>
            </div>
          </div>
        </div>
      </div>

      {/* Display Section */}
      {isLoading && <p>Loading photos...</p>}
      {error && <div className="alert alert-danger">{error}</div>}
      {!isLoading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {photos.length > 0 ? (
            photos.map(photo => (
              <div key={photo.id} className="card h-100">
                  <a href={photo.url} target="_blank" rel="noopener noreferrer">
                    <img src={photo.url} alt={`Photo from ${new Date(photo.created_at).toLocaleDateString()}`} className="card-img-top" style={{ aspectRatio: '16/9', objectFit: 'cover' }} />
                  </a>
                  <div className="card-body">
                     <p className="card-text"><small className="text-muted">Uploaded: {new Date(photo.created_at).toLocaleString()}</small></p>
                     {photo.job_id && <p className="card-text"><small className="text-muted">Job ID: {photo.job_id}</small></p>}
                     {photo.service_id && <p className="card-text"><small className="text-muted">Service ID: {photo.service_id}</small></p>}
                     {photo.invoice_id && <p className="card-text"><small className="text-muted">Invoice ID: {photo.invoice_id}</small></p>}
                     {photo.notes && photo.notes.length > 0 && (
                        <div className="mt-3">
                            <h6>Notes:</h6>
                            <ul className="list-unstyled">
                                {photo.notes.map(note => (
                                    <li key={note.id} className="mb-2">
                                        <p className="mb-0">{note.content}</p>
                                        <small className="text-muted">{new Date(note.created_at).toLocaleString()}</small>
                                    </li>
                                ))}
                            </ul>
                        </div>
                     )}
                  </div>
                </div>
            ))
          ) : (
            <p>No photos found matching your criteria.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default Photos;
