// src/components/ServiceDetail.tsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiGet, apiPost } from "../lib/api"; // PUT/DELETE/POST helper

interface Service {
  id: number;
  service_date: string;
  status: string;
  notes: string;
}

export default function ServiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [svc, setSvc] = useState<Service | null>(null);
  const [error, setError] = useState<string | null>(null);
  const token = localStorage.getItem("token")!;

  /* ------------ helpers ------------ */
  const fetchSvc = async () => {
    try {
      const data: Service = await apiGet(`/services/${id}`, token);
      setSvc(data);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const saveSvc = async () => {
    try {
      await apiPost(`/services/${id}`, svc, token, "PUT");
      navigate("/services");
    } catch (e: any) {
      setError(e.message);
    }
  };

  const deleteSvc = async () => {
    if (!confirm("Delete this service?")) return;
    try {
      await apiPost(`/services/${id}`, {}, token, "DELETE");
      navigate("/services");
    } catch (e: any) {
      setError(e.message);
    }
  };

  /* --- NEW: send or view invoice --- */
  const sendInvoice = async () => {
    try {
      const { hosted_invoice_url } = await apiPost(
        `/services/${id}/invoice`,
        {},
        token
      );
      // open hosted invoice page
      window.open(hosted_invoice_url, "_blank");
      // refresh to pick up status change
      await fetchSvc();
    } catch (e: any) {
      setError(e.message);
    }
  };

  /* initial load */
  useEffect(() => {
    fetchSvc();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!svc) return <p style={{ padding: "2rem" }}>Loading…</p>;

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Edit Service #{svc.id}</h1>
      {error && (
        <div style={{ color: "red", marginBottom: "1rem" }}>{error}</div>
      )}

      <label>
        Date:&nbsp;
        <input
          type="date"
          value={svc.service_date}
          onChange={(e) => setSvc({ ...svc, service_date: e.target.value })}
        />
      </label>
      <br />

      <label>
        Status:&nbsp;
        <select
          value={svc.status}
          onChange={(e) => setSvc({ ...svc, status: e.target.value })}
        >
          <option value="upcoming">upcoming</option>
          <option value="completed">completed</option>
          <option value="delayed">delayed</option>
          <option value="invoiced">invoiced</option>
          <option value="paid">paid</option>
        </select>
      </label>
      <br />

      <label>
        Notes:&nbsp;
        <textarea
          value={svc.notes}
          onChange={(e) => setSvc({ ...svc, notes: e.target.value })}
        />
      </label>
      <br />

      {/* action buttons */}
      <button onClick={saveSvc} style={{ marginRight: "0.5rem" }}>
        Save
      </button>

      <button
        onClick={sendInvoice}
        disabled={svc.status === "paid"}
        style={{ marginRight: "0.5rem" }}
      >
        {svc.status === "invoiced" || svc.status === "paid"
          ? "View Invoice"
          : "Send Invoice"}
      </button>

      <button onClick={deleteSvc} style={{ color: "red" }}>
        Delete
      </button>
    </div>
  );
}
