// src/components/Services.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet, getServices } from "../lib/api";
import { Service } from "@portal/shared";


export default function Services() {
  const [services, setServices] = useState<Service[]>([]);
  const [error, setError] = useState<string | null>(null);
  const token = localStorage.getItem("token")!; // protected via App.tsx

  useEffect(() => {
    (async () => {
      try {
        const data = await getServices(token);
        setServices(data);
      } catch (err: any) {
        setError(err.message || "Failed to load services");
      }
    })();
  }, [token]);

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Your Services</h1>

      {error && (
        <div style={{ color: "red", marginBottom: "1rem" }}>{error}</div>
      )}

      {services.length === 0 ? (
        <p>No services scheduled yet.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "0.5rem" }}>Date</th>
              <th style={{ textAlign: "left", padding: "0.5rem" }}>Status</th>
              <th style={{ textAlign: "left", padding: "0.5rem" }}>Notes</th>
              <th style={{ padding: "0.5rem" }} />
            </tr>
          </thead>
          <tbody>
            {services.map((s) => (
              <tr key={s.id} style={{ borderTop: "1px solid #ddd" }}>
                <td style={{ padding: "0.5rem" }}>{s.service_date}</td>
                <td style={{ padding: "0.5rem" }}>{s.status}</td>
                <td style={{ padding: "0.5rem" }}>{s.notes}</td>
                <td style={{ padding: "0.5rem" }}>
                  <Link to={`/services/${s.id}`}>View</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
