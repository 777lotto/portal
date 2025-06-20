import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// src/components/Services.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getServices } from "../lib/api";
export default function Services() {
    const [services, setServices] = useState([]);
    const [error, setError] = useState(null);
    const token = localStorage.getItem("token"); // protected via App.tsx
    useEffect(() => {
        (async () => {
            try {
                const data = await getServices(token);
                setServices(data);
            }
            catch (err) {
                setError(err.message || "Failed to load services");
            }
        })();
    }, [token]);
    return (_jsxs("div", { style: { padding: "2rem" }, children: [_jsx("h1", { children: "Your Services" }), error && (_jsx("div", { style: { color: "red", marginBottom: "1rem" }, children: error })), services.length === 0 ? (_jsx("p", { children: "No services scheduled yet." })) : (_jsxs("table", { style: { width: "100%", borderCollapse: "collapse" }, children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { style: { textAlign: "left", padding: "0.5rem" }, children: "Date" }), _jsx("th", { style: { textAlign: "left", padding: "0.5rem" }, children: "Status" }), _jsx("th", { style: { textAlign: "left", padding: "0.5rem" }, children: "Notes" }), _jsx("th", { style: { padding: "0.5rem" } })] }) }), _jsx("tbody", { children: services.map((s) => (_jsxs("tr", { style: { borderTop: "1px solid #ddd" }, children: [_jsx("td", { style: { padding: "0.5rem" }, children: s.service_date }), _jsx("td", { style: { padding: "0.5rem" }, children: s.status }), _jsx("td", { style: { padding: "0.5rem" }, children: s.notes }), _jsx("td", { style: { padding: "0.5rem" }, children: _jsx(Link, { to: `/services/${s.id}`, children: "View" }) })] }, s.id))) })] }))] }));
}
