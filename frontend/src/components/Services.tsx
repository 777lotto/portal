// src/components/Services.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet, apiPost } from "../lib/api";

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

  /* ----- fetch list on mount ----- */
  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem("token")!;
        const data: Service[] = await apiGet("/services", token);
        setServices(data);
      } catch (err: any) {
        setError(err.message || "Failed to load services");
      }
    })();
  }, []);

  /* ----- add a new service ----- */
  const handleAdd = async () => {
    try {
      const token = localStorage.getItem("token")!;
      const newSvc = {
        service_date: new Date().toISOString().slice(0, 10),
        status: "upcoming",
        notes: "",
      };
      await apiPost("/services", newSvc, token); // POST by default

      // refresh list
      const refreshed: Service[] = await apiGet("/services", token);
      setServices(refreshed);
    } catch (err: any) {
      setError(err.message || "Failed to add service");
    }
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Your Services</h1>

      {error && (
        <div style={{ color: "red", marginBottom: "1rem" }}>{error}</div>
      )}

      <button
        onClick={handleAdd}
        style={{ marginBottom: "1rem", padding: "0.5rem 1rem" }}
      >
        Add New Service
      </button>

      {services.length > 0 ? (
        <ul>
          {services.map((s) => (
            <li key={s.id} style={{ marginBottom: "0.5rem" }}>
              <Link to={`/services/${s.id}`}>
                <strong>Date:</strong> {s.service_date} &nbsp;|&nbsp;
                <strong>Status:</strong> {s.status}
                {s.notes && (
                  <>
                    &nbsp;|&nbsp;<strong>Notes:</strong> {s.notes}
                  </>
                )}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p>No services scheduled yet.</p>
      )}
    </div>
  );
}
