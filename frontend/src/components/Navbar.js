import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
// frontend/src/components/Navbar.tsx - CORRECTED
import { Link, NavLink, useNavigate } from "react-router-dom";
import { logout } from "../lib/api";
export default function Navbar({ token, setToken, user }) {
    const navigate = useNavigate();
    const handleLogout = async () => {
        try {
            // Call the new API endpoint to clear the server-side session
            await logout();
        }
        catch (error) {
            // Log the error but proceed with frontend cleanup regardless
            console.error("Server logout failed:", error);
        }
        finally {
            // Clear the token from the frontend state and local storage
            setToken(null);
            // Redirect to the login page
            navigate("/login", { replace: true });
        }
    };
    return (_jsx("nav", { className: "navbar navbar-expand-lg navbar-dark bg-dark", children: _jsxs("div", { className: "container-fluid", children: [_jsx(Link, { className: "navbar-brand", to: "/", children: "Customer Portal" }), _jsx("button", { className: "navbar-toggler", type: "button", "data-bs-toggle": "collapse", "data-bs-target": "#navbarNav", "aria-controls": "navbarNav", "aria-expanded": "false", "aria-label": "Toggle navigation", children: _jsx("span", { className: "navbar-toggler-icon" }) }), _jsxs("div", { className: "collapse navbar-collapse", id: "navbarNav", children: [_jsx("ul", { className: "navbar-nav me-auto mb-2 mb-lg-0", children: token && (_jsxs(_Fragment, { children: [_jsx("li", { className: "nav-item", children: _jsx(NavLink, { className: "nav-link", to: "/dashboard", children: "Dashboard" }) }), _jsx("li", { className: "nav-item", children: _jsx(NavLink, { className: "nav-link", to: "/services", children: "Services" }) }), _jsx("li", { className: "nav-item", children: _jsx(NavLink, { className: "nav-link", to: "/calendar", children: "Calendar" }) }), _jsx("li", { className: "nav-item", children: _jsx(NavLink, { className: "nav-link", to: "/sms", children: "Messages" }) }), user?.role === 'admin' && (_jsx("li", { className: "nav-item", children: _jsx(NavLink, { className: "nav-link", to: "/admin/dashboard", style: { color: 'cyan' }, children: "Admin" }) }))] })) }), token && user ? (_jsxs("div", { className: "d-flex align-items-center", children: [_jsxs("span", { className: "navbar-text me-3", children: ["Welcome, ", user.name] }), _jsx("button", { onClick: handleLogout, className: "btn btn-outline-light", children: "Logout" })] })) : (_jsxs("ul", { className: "navbar-nav", children: [_jsx("li", { className: "nav-item", children: _jsx(NavLink, { className: "nav-link", to: "/login", children: "Login" }) }), _jsx("li", { className: "nav-item", children: _jsx(NavLink, { className: "nav-link", to: "/signup", children: "Sign Up" }) })] }))] })] }) }));
}
