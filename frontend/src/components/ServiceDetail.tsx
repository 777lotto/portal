import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiGet, createInvoice } from '../lib/api';
import type { Service } from '@portal/shared';

// Define types for our new data
interface Photo {
  id: string;
  url: string;
  created_at: string;
}
interface Note {
  id: number;
  content: string;
  created_at: string;
}

function ServiceDetail() {
  const { id } = useParams<{ id: string }>();
  const [service, setService] = useState<Service | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invoiceMessage, setInvoiceMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const token = localStorage.getItem("token");
    if (!token) return;

    const fetchDetails = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const [serviceData, photosData, notesData] = await Promise.all([
          getService(id, token),
          apiGet<Photo[]>(`/api/services/${id}/photos`, token),
          apiGet<Note[]>(`/api/services/${id}/notes`, token)
        ]);
        setService(serviceData);
        setPhotos(photosData);
        setNotes(notesData);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDetails();
  }, [id]);

  const handleCreateInvoice = async () => {
    if (!id) return;
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const response = await createInvoice(id, token);
      if (response.hosted_invoice_url) {
        setInvoiceMessage(`Invoice created!`);
        window.open(response.hosted_invoice_url, '_blank');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const formatDate = (dateString: string) => new Date(dateString).toLocaleString();
  if (isLoading) return <div className="container mt-4">Loading...</div>;
  if (error) return <div className="container mt-4 alert alert-danger">{error}</div>;
  if (!service) return <div className="container mt-4"><h2>Service not found</h2></div>;

  return (
    <div className="container mt-4">
      <div className="card">
        <div className="card-header"><h2>Service Detail</h2></div>
        <div className="card-body">
          <p><strong>Date:</strong> {formatDate(service.service_date)}</p>
          <p><strong>Status:</strong> {service.status}</p>
          {service.price_cents && <p><strong>Price:</strong> ${(service.price_cents / 100).toFixed(2)}</p>}
          {service.notes && <p><strong>Original Notes:</strong> {service.notes}</p>}
          {invoiceMessage && <div className="alert alert-info">{invoiceMessage}</div>}
          {!service.stripe_invoice_id && (
            <button onClick={handleCreateInvoice} className="btn btn-primary">Create Invoice</button>
          )}
        </div>
      </div>

      <div className="card mt-4">
        <div className="card-header"><h3>Photos</h3></div>
        <div className="card-body row">
          {photos.length > 0 ? photos.map(photo => (
            <div key={photo.id} className="col-md-4 mb-3">
              <a href={photo.url} target="_blank" rel="noopener noreferrer">
                <img src={photo.url} alt="Service" className="img-fluid rounded" />
              </a>
            </div>
          )) : <p>No photos yet.</p>}
        </div>
      </div>

      <div className="card mt-4">
        <div className="card-header"><h3>Additional Notes</h3></div>
        <ul className="list-group list-group-flush">
          {notes.length > 0 ? notes.map(note => (
            <li key={note.id} className="list-group-item">
              <p>{note.content}</p>
              <small>{formatDate(note.created_at)}</small>
            </li>
          )) : <li className="list-group-item">No additional notes yet.</li>}
        </ul>
      </div>

      <Link to="/services" className="btn btn-secondary mt-4">Back to Services</Link>
    </div>
  );
}

export default ServiceDetail;

