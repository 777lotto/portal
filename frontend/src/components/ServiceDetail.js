import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// frontend/src/components/ServiceDetail.tsx - CORRECTED
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiGet, createInvoice, getService } from '../lib/api';
function ServiceDetail() {
    const { id } = useParams();
    const [service, setService] = useState(null);
    const [photos, setPhotos] = useState([]);
    const [notes, setNotes] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [invoiceMessage, setInvoiceMessage] = useState(null);
    useEffect(() => {
        if (!id)
            return;
        const fetchDetails = async () => {
            try {
                setIsLoading(true);
                setError(null);
                const [serviceData, photosData, notesData] = await Promise.all([
                    getService(id),
                    apiGet(`/services/${id}/photos`),
                    apiGet(`/services/${id}/notes`)
                ]);
                setService(serviceData);
                setPhotos(photosData);
                setNotes(notesData);
            }
            catch (err) {
                setError(err.message);
            }
            finally {
                setIsLoading(false);
            }
        };
        fetchDetails();
    }, [id]);
    const handleCreateInvoice = async () => {
        if (!id)
            return;
        try {
            const response = await createInvoice(id);
            if (response.hosted_invoice_url) {
                setInvoiceMessage(`Invoice created!`);
                window.open(response.hosted_invoice_url, '_blank');
            }
        }
        catch (err) {
            setError(err.message);
        }
    };
    const formatDate = (dateString) => new Date(dateString).toLocaleString();
    if (isLoading)
        return _jsx("div", { className: "container mt-4", children: "Loading..." });
    if (error)
        return _jsx("div", { className: "container mt-4 alert alert-danger", children: error });
    if (!service)
        return _jsx("div", { className: "container mt-4", children: _jsx("h2", { children: "Service not found" }) });
    return (_jsxs("div", { className: "container mt-4", children: [_jsxs("div", { className: "card", children: [_jsx("div", { className: "card-header", children: _jsx("h2", { children: "Service Detail" }) }), _jsxs("div", { className: "card-body", children: [_jsxs("p", { children: [_jsx("strong", { children: "Date:" }), " ", formatDate(service.service_date)] }), _jsxs("p", { children: [_jsx("strong", { children: "Status:" }), " ", service.status] }), service.price_cents && _jsxs("p", { children: [_jsx("strong", { children: "Price:" }), " $", (service.price_cents / 100).toFixed(2)] }), service.notes && _jsxs("p", { children: [_jsx("strong", { children: "Original Notes:" }), " ", service.notes] }), invoiceMessage && _jsx("div", { className: "alert alert-info", children: invoiceMessage }), !service.stripe_invoice_id && (_jsx("button", { onClick: handleCreateInvoice, className: "btn btn-primary", children: "Create Invoice" }))] })] }), _jsxs("div", { className: "card mt-4", children: [_jsx("div", { className: "card-header", children: _jsx("h3", { children: "Photos" }) }), _jsx("div", { className: "card-body row", children: photos.length > 0 ? photos.map(photo => (_jsx("div", { className: "col-md-4 mb-3", children: _jsx("a", { href: photo.url, target: "_blank", rel: "noopener noreferrer", children: _jsx("img", { src: photo.url, alt: "Service", className: "img-fluid rounded" }) }) }, photo.id))) : _jsx("p", { children: "No photos yet." }) })] }), _jsxs("div", { className: "card mt-4", children: [_jsx("div", { className: "card-header", children: _jsx("h3", { children: "Additional Notes" }) }), _jsx("ul", { className: "list-group list-group-flush", children: notes.length > 0 ? notes.map(note => (_jsxs("li", { className: "list-group-item", children: [_jsx("p", { children: note.content }), _jsx("small", { children: formatDate(note.created_at) })] }, note.id))) : _jsx("li", { className: "list-group-item", children: "No additional notes yet." }) })] }), _jsx(Link, { to: "/services", className: "btn btn-secondary mt-4", children: "Back to Services" })] }));
}
export default ServiceDetail;
