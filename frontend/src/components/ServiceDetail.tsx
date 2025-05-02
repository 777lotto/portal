// src/components/ServiceDetail.tsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiGet, apiGetInvoice } from "../lib/api";

interface Service {
  id: number;
  service_date: string;
  status: string;
  notes: string;
}

export default function ServiceDetail() {
  const { id } = useParams();
  const [svc, setSvc] = useState<Service | null>(null);
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const token = localStorage.getItem("token")!;

  useEffect(() => {
    (async () => {
      try {
        const data = await apiGet(`/services/${id}`, token);
        setSvc(data);
        if (data.status === "invoiced" || data.status === "paid") {
          const { hosted_invoice_url } = await apiGetInvoice(Number(id), token);
          setInvoiceUrl(hosted_invoice_url);
        }
      } catch (e: any) {
        setError(e.message);
      }
    })();
  }, [id, token]);

  if (!svc) return <p style={{ padding: "2rem" }}>Loading…</p>;

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Service #{svc.id}</h1>
      {error && <div style={{ color: "red" }}>{error}</div>}

      <p>
        <strong>Date:</strong> {svc.service_date}
      </p>
      <p>
        <strong>Status:</strong> {svc.status}
      </p>
      {svc.notes && (
        <p>
          <strong>Notes:</strong> {svc.notes}
        </p>
      )}

      {svc.status === "invoiced" && invoiceUrl && (
        <button
          onClick={() => window.open(invoiceUrl, "_blank")}
          style={{ marginTop: "1rem", padding: "0.5rem 1rem" }}
        >
          Pay Invoice
        </button>
      )}

      {svc.status === "paid" && (
        <p style={{ marginTop: "1rem", color: "green" }}>✅ Invoice paid</p>
      )}
    </div>
  );
}
