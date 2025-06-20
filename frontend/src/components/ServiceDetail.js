import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// src/components/ServiceDetail.tsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getInvoice, getService } from "../lib/api";
export default function ServiceDetail() {
    const { id } = useParams();
    const [svc, setSvc] = useState(null);
    const [invoiceUrl, setInvoiceUrl] = useState(null);
    const [error, setError] = useState(null);
    const token = localStorage.getItem("token");
    useEffect(() => {
        (async () => {
            try {
                const data = await getService(Number(id), token);
                setSvc(data);
                if (data.status === "invoiced" || data.status === "paid") {
                    const { hosted_invoice_url } = await getInvoice(Number(id), token);
                    setInvoiceUrl(hosted_invoice_url);
                }
            }
            catch (e) {
                setError(e.message);
            }
        })();
    }, [id, token]);
    if (!svc)
        return _jsx("p", { style: { padding: "2rem" }, children: "Loading\u2026" });
    return (_jsxs("div", { style: { padding: "2rem" }, children: [_jsxs("h1", { children: ["Service #", svc.id] }), error && _jsx("div", { style: { color: "red" }, children: error }), _jsxs("p", { children: [_jsx("strong", { children: "Date:" }), " ", svc.service_date] }), _jsxs("p", { children: [_jsx("strong", { children: "Status:" }), " ", svc.status] }), svc.notes && (_jsxs("p", { children: [_jsx("strong", { children: "Notes:" }), " ", svc.notes] })), svc.status === "invoiced" && invoiceUrl && (_jsx("button", { onClick: () => window.open(invoiceUrl, "_blank"), style: { marginTop: "1rem", padding: "0.5rem 1rem" }, children: "Pay Invoice" })), svc.status === "paid" && (_jsx("p", { style: { marginTop: "1rem", color: "green" }, children: "\u2705 Invoice paid" }))] }));
}
