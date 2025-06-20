import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { Link, useNavigate } from "react-router-dom";
export default function Navbar({ token, setToken }) {
    const navigate = useNavigate();
    const handleLogout = () => {
        localStorage.removeItem("token");
        setToken(null);
        navigate("/login");
    };
    return (_jsxs("nav", { style: {
            padding: "1rem",
            background: "#eee",
            marginBottom: "2rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
        }, children: [_jsxs("div", { children: [_jsx("strong", { style: { marginRight: "2rem" }, children: "777 Solutions Customer Portal" }), token ? (_jsxs(_Fragment, { children: [_jsx(Link, { to: "/dashboard", style: { marginRight: "1rem" }, children: "Dashboard" }), _jsx(Link, { to: "/services", style: { marginRight: "1rem" }, children: "Services" }), _jsx(Link, { to: "/calendar", style: { marginRight: "1rem" }, children: "Calendar" }), _jsx(Link, { to: "/calendar-sync", style: { marginRight: "1rem" }, children: "Sync Calendar" }), _jsx(Link, { to: "/sms", style: { marginRight: "1rem" }, children: "Messages" })] })) : (_jsxs(_Fragment, { children: [_jsx(Link, { to: "/login", style: { marginRight: "1rem" }, children: "Login" }), _jsx(Link, { to: "/signup", children: "Signup" })] }))] }), token && (_jsx("button", { onClick: handleLogout, style: {
                    background: "transparent",
                    border: "1px solid #999",
                    padding: "0.3rem 0.8rem",
                    borderRadius: "4px",
                    cursor: "pointer"
                }, children: "Logout" }))] }));
}
