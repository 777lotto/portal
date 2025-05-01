// src/components/Services.tsx
import { useEffect, useState } from "react";
import { apiGet, apiPost, apiPut, apiDelete } from "../lib/api";

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
  const token = localStorage.getItem("token")!;   // we gate this route in App

  /* ------------ helpers ------------ */
  const refresh = async () => {
    const data: Service[] = await apiGet("/services", token);
    setServices(data);
  };

  /* ------------ on mount ------------ */
  useEffect(() => {
    (async () => {
      try {
        await refresh();
      } catch (err: any) {
        setError(err.message || "Failed to load services");
      }
    })();
  }, []);

  /* ------------ add ------------ */
  const handleAdd = async () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      await apiPost(
        "/services",
        { service_date: today, status: "upcoming", notes: "" },
        token
      );
      await refresh();
    } catch (err: any) {
      setError(err.message || "Failed to add service");
    }
  };

  /* ------------ update (inline) ------------ */
  async function handleUpdate(
    id: number,
    field: keyof Pick<Service, "service_date" | "status" | "notes">,
    value: string
  ) {
    try {
      const svc = services.find((s) => s.id === id)!;
      await apiPut(
        `/services/${id}`,
        { ...svc, [field]: value },
        token
      );
      await refresh();
    } catch (err: any) {
      setError(err.message || "Update failed");
    }
  }

  /* ------------ delete ------------ */
  async function handleDelete(id: number) {
    if (!confirm("Delete this service?")) return;
    try {
      await apiDelete(`/services/${id}`, token);
      await refresh();
    } catch (err: any) {
      setError(err.message || "Delete failed");
    }
  }

  /* ------------ UI ------------ */
  return (
    <div style={{ padding: "2rem" }}>
      <h1>Your Services</h1>

      {error && (
        <div style={{ color: "red", marginBottom: "1rem" }}>{error}</div>
      )}

      {/* add button */}
      <button onClick={handleAdd} style={{ marginBottom: "1rem" }}>
        ➕ Add new
      </button>

      {services.length === 0 ? (
        <p>No services scheduled yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Status</th>
              <th>Notes</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {services.map((s) => (
              <tr key={s.id}>
                {/* ★ editable inputs */}
                <td>
                  <input
                    type="date"
                    value={s.service_date}
                    onChange={(e) =>
                      handleUpdate(s.id, "service_date", e.target.value)
                    }
                  />
                </td>
                <td>
                  <select
                    value={s.status}
                    onChange={(e) =>
                      handleUpdate(s.id, "status", e.target.value)
                    }
                  >
                    <option value="upcoming">upcoming</option>
                    <option value="completed">completed</option>
                    <option value="delayed">delayed</option>
                  </select>
                </td>
                <td>
                  <input
                    value={s.notes ?? ""}
                    onChange={(e) =>
                      handleUpdate(s.id, "notes", e.target.value)
                    }
                    style={{ width: "12rem" }}
                  />
                </td>
                <td>
                  <button onClick={() => handleDelete(s.id)}>🗑️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
