import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// frontend/src/App.tsx - Updated for Cloudflare integration
import { Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
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
// Removed bogus global types - not needed with Cloudflare Vite plugin
function App() {
    const [token, setToken] = useState(null);
    const [isReady, setIsReady] = useState(false);
    useEffect(() => {
        // Initialize the app
        const initializeApp = async () => {
            try {
                // Get token from localStorage
                const storedToken = localStorage.getItem("token");
                setToken(storedToken);
                // In development, test if the API is accessible
                if (import.meta.env.DEV) {
                    try {
                        const response = await fetch('/api/ping', {
                            method: 'GET',
                            headers: {
                                'Content-Type': 'application/json'
                            }
                        });
                        if (response.ok) {
                            console.log('✅ API is ready');
                        }
                        else {
                            console.warn('⚠️  API not ready yet, but continuing...');
                        }
                    }
                    catch (error) {
                        console.warn('⚠️  Could not reach API during initialization:', error);
                    }
                }
                setIsReady(true);
            }
            catch (error) {
                console.error('App initialization error:', error);
                setIsReady(true); // Continue anyway
            }
        };
        initializeApp();
    }, []);
    // Show loading state while initializing
    if (!isReady) {
        return (_jsxs("div", { style: {
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh',
                flexDirection: 'column',
                gap: '1rem'
            }, children: [_jsx("div", { children: "Loading..." }), import.meta.env.DEV && (_jsx("div", { style: { fontSize: '0.8rem', color: '#666' }, children: "Starting up..." }))] }));
    }
    return (_jsxs(_Fragment, { children: [_jsx(Navbar, { token: token, setToken: setToken }), _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(Navigate, { to: token ? "/dashboard" : "/login", replace: true }) }), _jsx(Route, { path: "/login", element: token ? _jsx(Navigate, { to: "/dashboard", replace: true }) : _jsx(LoginForm, { setToken: setToken }) }), _jsx(Route, { path: "/signup", element: token ? _jsx(Navigate, { to: "/dashboard", replace: true }) : _jsx(SignupForm, { setToken: setToken }) }), _jsx(Route, { path: "/dashboard", element: token ? _jsx(Dashboard, {}) : _jsx(Navigate, { to: "/login", replace: true }) }), _jsx(Route, { path: "/services", element: token ? _jsx(Services, {}) : _jsx(Navigate, { to: "/login", replace: true }) }), _jsx(Route, { path: "/services/:id", element: token ? _jsx(ServiceDetail, {}) : _jsx(Navigate, { to: "/login", replace: true }) }), _jsx(Route, { path: "/calendar", element: token ? _jsx(JobCalendar, {}) : _jsx(Navigate, { to: "/login", replace: true }) }), _jsx(Route, { path: "/jobs/:id", element: token ? _jsx(JobDetail, {}) : _jsx(Navigate, { to: "/login", replace: true }) }), _jsx(Route, { path: "/calendar-sync", element: token ? _jsx(CalendarSync, {}) : _jsx(Navigate, { to: "/login", replace: true }) }), _jsx(Route, { path: "/sms", element: token ? _jsx(SMSConversations, {}) : _jsx(Navigate, { to: "/login", replace: true }) }), _jsx(Route, { path: "/sms/:phoneNumber", element: token ? _jsx(SMSConversation, {}) : _jsx(Navigate, { to: "/login", replace: true }) }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/", replace: true }) })] }), import.meta.env.DEV && (_jsxs("div", { style: {
                    position: 'fixed',
                    bottom: '10px',
                    right: '10px',
                    background: 'rgba(0,0,0,0.8)',
                    color: 'white',
                    padding: '8px',
                    fontSize: '10px',
                    borderRadius: '4px',
                    fontFamily: 'monospace'
                }, children: ["ENV: ", import.meta.env.MODE, " | API: ", import.meta.env.VITE_API_URL || '/api'] }))] }));
}
export default App;
