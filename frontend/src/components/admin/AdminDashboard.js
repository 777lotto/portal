import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// frontend/src/components/admin/AdminDashboard.tsx - CORRECTED
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiGet } from '../../lib/api';
function AdminDashboard() {
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    useEffect(() => {
        const fetchUsers = async () => {
            try {
                setIsLoading(true);
                setError(null);
                // FIX: The token argument has been removed as it's now handled by the fetch helper.
                const data = await apiGet('/admin/users');
                setUsers(data);
            }
            catch (err) {
                console.error("Error fetching users:", err);
                setError(err.message || 'An unknown error occurred.');
            }
            finally {
                setIsLoading(false);
            }
        };
        fetchUsers();
    }, []);
    if (isLoading)
        return _jsx("div", { className: "container mt-4", children: "Loading users..." });
    if (error)
        return _jsx("div", { className: "container mt-4 alert alert-danger", children: error });
    return (_jsxs("div", { className: "container mt-4", children: [_jsx("h2", { children: "Admin Dashboard" }), _jsx("p", { children: "Select a user to manage their photos and notes." }), _jsx("div", { className: "list-group", children: users.length > 0 ? (users.map(user => (_jsxs(Link, { to: `/admin/users/${user.id}`, className: "list-group-item list-group-item-action d-flex justify-content-between align-items-center", children: [_jsxs("div", { children: [_jsx("h5", { className: "mb-1", children: user.name }), _jsxs("p", { className: "mb-1 text-muted", children: [user.email, " ", user.phone && `| ${user.phone}`] })] }), _jsxs("div", { children: [_jsx("span", { className: `badge me-2 ${user.role === 'admin' ? 'bg-success' : 'bg-secondary'}`, children: user.role }), _jsx("span", { className: "badge bg-primary rounded-pill", children: "Manage" })] })] }, user.id)))) : (_jsx("p", { children: "No users found." })) })] }));
}
export default AdminDashboard;
