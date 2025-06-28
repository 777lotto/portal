import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// frontend/src/components/Services.tsx - CORRECTED
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getServices } from '../lib/api';
function Services() {
    const [services, setServices] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    useEffect(() => {
        const fetchServices = async () => {
            try {
                setIsLoading(true);
                setError(null);
                // FIX: The token is no longer passed directly to API functions.
                const data = await getServices();
                setServices(data);
            }
            catch (err) {
                setError(err.message);
            }
            finally {
                setIsLoading(false);
            }
        };
        fetchServices();
    }, []);
    if (isLoading)
        return _jsx("div", { className: "container mt-4", children: "Loading services..." });
    if (error)
        return _jsx("div", { className: "container mt-4 alert alert-danger", children: error });
    return (_jsxs("div", { className: "container mt-4", children: [_jsx("h2", { children: "Your Services" }), _jsx("div", { className: "list-group", children: services.length > 0 ? (services.map(service => (_jsxs(Link, { to: `/services/${service.id}`, className: "list-group-item list-group-item-action", children: [_jsxs("div", { className: "d-flex w-100 justify-content-between", children: [_jsxs("h5", { className: "mb-1", children: ["Service on ", new Date(service.service_date).toLocaleDateString()] }), _jsxs("small", { children: ["Status: ", service.status] })] }), service.price_cents && _jsxs("p", { className: "mb-1", children: ["$", (service.price_cents / 100).toFixed(2)] }), _jsx("small", { children: service.notes })] }, service.id)))) : (_jsx("p", { children: "You have no services scheduled." })) })] }));
}
export default Services;
