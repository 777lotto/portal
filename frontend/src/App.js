import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// frontend/src/App.tsx - Updated to include Admin routes
import { Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { jwtDecode } from 'jwt-decode'; // You may need to install this: pnpm add jwt-decode
// --- Page Components ---
import LoginForm from "./components/LoginForm";
import SignupForm from "./components/SignupForm";
import Dashboard from "./components/Dashboard";
import Services from "./components/Services";
import ServiceDetail from "./components/ServiceDetail";
import JobCalendar from "./components/Calendar";
import JobDetail from "./components/JobDetail";
import CalendarSync from "./components/CalendarSync";
import Navbar from "./components/Navbar";
import SMSConversations from "./components/SMSConversations";
import SMSConversation from "./components/SMSConversation";
// --- NEW: Admin Page Components (you will create these) ---
import AdminDashboard from "./components/admin/AdminDashboard";
import AdminUserDetail from "./components/admin/AdminUserDetail";
function App() {
    const [token, setToken] = useState(null);
    // --- NEW: Add state to hold the decoded user information ---
    const [user, setUser] = useState(null);
    const [isReady, setIsReady] = useState(false);
    useEffect(() => {
        const initializeApp = async () => {
            try {
                const storedToken = localStorage.getItem("token");
                setToken(storedToken);
                // --- NEW: If a token exists, decode it to get user role ---
                if (storedToken) {
                    try {
                        const decodedUser = jwtDecode(storedToken);
                        setUser(decodedUser);
                    }
                    catch (error) {
                        console.error("Invalid token:", error);
                        // Clear invalid token
                        localStorage.removeItem("token");
                        setToken(null);
                        setUser(null);
                    }
                }
            }
            catch (error) {
                console.error('App initialization error:', error);
            }
            finally {
                setIsReady(true);
            }
        };
        initializeApp();
    }, [token]); // Re-run this effect when the token changes
    // --- NEW: Function to handle setting token and decoding user ---
    const handleSetToken = (newToken) => {
        setToken(newToken);
        if (newToken) {
            localStorage.setItem("token", newToken);
            try {
                setUser(jwtDecode(newToken));
            }
            catch (error) {
                console.error("Failed to decode new token:", error);
                setUser(null);
            }
        }
        else {
            localStorage.removeItem("token");
            setUser(null);
        }
    };
    if (!isReady) {
        return _jsx("div", { children: "Loading..." });
    }
    return (_jsxs(_Fragment, { children: [_jsx(Navbar, { user: user, setToken: handleSetToken }), _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(Navigate, { to: token ? "/dashboard" : "/login", replace: true }) }), _jsx(Route, { path: "/login", element: token ? _jsx(Navigate, { to: "/dashboard", replace: true }) : _jsx(LoginForm, { setToken: handleSetToken }) }), _jsx(Route, { path: "/signup", element: token ? _jsx(Navigate, { to: "/dashboard", replace: true }) : _jsx(SignupForm, { setToken: handleSetToken }) }), _jsx(Route, { path: "/dashboard", element: token ? _jsx(Dashboard, {}) : _jsx(Navigate, { to: "/login", replace: true }) }), _jsx(Route, { path: "/services", element: token ? _jsx(Services, {}) : _jsx(Navigate, { to: "/login", replace: true }) }), _jsx(Route, { path: "/services/:id", element: token ? _jsx(ServiceDetail, {}) : _jsx(Navigate, { to: "/login", replace: true }) }), _jsx(Route, { path: "/calendar", element: token ? _jsx(JobCalendar, {}) : _jsx(Navigate, { to: "/login", replace: true }) }), _jsx(Route, { path: "/jobs/:id", element: token ? _jsx(JobDetail, {}) : _jsx(Navigate, { to: "/login", replace: true }) }), _jsx(Route, { path: "/calendar-sync", element: token ? _jsx(CalendarSync, {}) : _jsx(Navigate, { to: "/login", replace: true }) }), _jsx(Route, { path: "/sms", element: token ? _jsx(SMSConversations, {}) : _jsx(Navigate, { to: "/login", replace: true }) }), _jsx(Route, { path: "/sms/:phoneNumber", element: token ? _jsx(SMSConversation, {}) : _jsx(Navigate, { to: "/login", replace: true }) }), _jsx(Route, { path: "/admin/dashboard", element: user?.role === 'admin' ? _jsx(AdminDashboard, {}) : _jsx(Navigate, { to: "/dashboard", replace: true }) }), _jsx(Route, { path: "/admin/users/:userId", element: user?.role === 'admin' ? _jsx(AdminUserDetail, {}) : _jsx(Navigate, { to: "/dashboard", replace: true }) }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/", replace: true }) })] })] }));
}
export default App;
