// src/components/Services.tsx (new file)
import { useEffect, useState } from "react";
import { apiGet } from "../lib/api";

export default function Services() {
  const [services, setServices] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const token = localStorage.getItem("token");
        const data = await apiGet("/api/services", token || undefined);
        setServices(data);
      } catch (err: any) {
        setError(err.message || "Failed to load services");
      }
    };

    fetchServices();
  }, []);

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Upcoming Services</h1>
      {error && <div style={{ color: "red" }}>{error}</div>}
      {services.length > 0 ? (
        <ul>
          {services.map((service, index) => (
            <li key={index}>{service.date} - {service.description}</li>
          ))}
        </ul>
      ) : (
        <p>No services scheduled yet.</p>
      )}
    </div>
  );
}
