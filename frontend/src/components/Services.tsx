// src/components/Services.tsx
import { useEffect, useState } from "react";
import { login, signup, apiGet } from '../lib/api'

interface Service {
  id: number;
  user_id: number;
  service_date: string;
  status: string;
  notes: string;
}

export default function Services() {
  const [services, setServices] = useState<Service[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchServices() {
      try {
        const token = localStorage.getItem("token") ?? undefined;
        const data: Service[] = await apiGet("/services", token);
        setServices(data);
      } catch (err: any) {
        setError(err.message || "Failed to load services");
      }
    }

    fetchServices();
  }, []);

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Your Services</h1>

      {error && <div style={{ color: "red", marginBottom: "1rem" }}>{error}</div>}

      {services.length > 0 ? (
        <ul>
          {services.map((s) => (
            <li key={s.id}>
              <strong>Date:</strong> {s.service_date} <br />
              <strong>Status:</strong> {s.status} <br />
              {s.notes && (
                <>
                  <strong>Notes:</strong> {s.notes}
                </>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p>No services scheduled yet.</p>
      )}
    </div>
  );
}
