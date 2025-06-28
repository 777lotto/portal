// frontend/src/components/Services.tsx - CORRECTED
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getServices } from '../lib/api';
import type { Service } from '@portal/shared';

function Services() {
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        setIsLoading(true);
        setError(null);
        // FIX: The token is no longer passed directly to API functions.
        const data = await getServices();
        setServices(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchServices();
  }, []);

  if (isLoading) return <div className="container mt-4">Loading services...</div>;
  if (error) return <div className="container mt-4 alert alert-danger">{error}</div>;

  return (
    <div className="container mt-4">
      <h2>Your Services</h2>
      <div className="list-group">
        {services.length > 0 ? (
          services.map(service => (
            <Link key={service.id} to={`/services/${service.id}`} className="list-group-item list-group-item-action">
              <div className="d-flex w-100 justify-content-between">
                <h5 className="mb-1">Service on {new Date(service.service_date).toLocaleDateString()}</h5>
                <small>Status: {service.status}</small>
              </div>
              {service.price_cents && <p className="mb-1">${(service.price_cents / 100).toFixed(2)}</p>}
              <small>{service.notes}</small>
            </Link>
          ))
        ) : (
          <p>You have no services scheduled.</p>
        )}
      </div>
    </div>
  );
}

export default Services;
