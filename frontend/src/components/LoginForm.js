import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// src/components/LoginForm.tsx - Updated code to handle email prefill
import { useState, useEffect } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { login, requestPasswordReset } from "../lib/api";
import Turnstile from "./Turnstile";
export default function LoginForm({ setToken }) {
    const [identifier, setIdentifier] = useState("");
    const [password, setPassword] = useState("");
    const [resetEmail, setResetEmail] = useState("");
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);
    const [isResetting, setIsResetting] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const [turnstileToken, setTurnstileToken] = useState(null);
    const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || "0x4AAAAAABcgNHsEZnTPqdEV";
    // Check for email in URL params (from redirects)
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const emailParam = params.get('email');
        if (emailParam) {
            setIdentifier(emailParam);
            setResetEmail(emailParam);
            // If redirected from signup with existing=true, show a helpful message
            if (params.get('existing') === 'true') {
                setSuccessMessage("An account with this email already exists. Please log in.");
            }
        }
    }, [location]);
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setSuccessMessage(null);
        if (!turnstileToken) {
            setError("Please complete the security check");
            return;
        }
        try {
            const authResponse = await login(identifier, password, turnstileToken);
            localStorage.setItem("token", authResponse.token);
            setToken(authResponse.token);
            navigate("/dashboard");
        }
        catch (err) {
            setError(err.message || "Login failed");
        }
    };
    const handleResetRequest = async (e) => {
        e.preventDefault();
        setError(null);
        setSuccessMessage(null);
        if (!resetEmail) {
            setError("Please enter your email address");
            return;
        }
        if (!turnstileToken) {
            setError("Please complete the security check");
            return;
        }
        try {
            await requestPasswordReset(resetEmail, turnstileToken);
            setSuccessMessage("Password reset instructions have been sent to your email");
            // Optionally switch back to login form after a successful reset request
            // setTimeout(() => setIsResetting(false), 5000);
        }
        catch (err) {
            setError(err.message || "Failed to request password reset");
        }
    };
    return (_jsxs("div", { style: { padding: "2rem" }, children: [_jsx("h1", { children: isResetting ? "Reset Password" : "Login" }), successMessage && (_jsx("div", { style: {
                    color: "white",
                    backgroundColor: "#4CAF50",
                    padding: "10px",
                    borderRadius: "4px",
                    marginBottom: "1rem"
                }, children: successMessage })), !isResetting ? (_jsxs(_Fragment, { children: [_jsxs("form", { onSubmit: handleSubmit, children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "login-identifier", style: { display: "block", marginBottom: "0.5rem" }, children: "Email or Phone Number" }), _jsx("input", { id: "login-identifier", name: "identifier", type: "text" // Use text to accept both email and phone
                                        , autoComplete: "username" // This will get email/phone suggestions
                                        , placeholder: "Enter email or phone number", value: identifier, onChange: (e) => setIdentifier(e.target.value), style: { width: "100%", marginBottom: "1rem" } })] }), _jsx("div", { children: _jsx("input", { id: "login-password", name: "password", type: "password", autoComplete: "current-password", placeholder: "Password", value: password, onChange: (e) => setPassword(e.target.value), style: { width: "100%", marginBottom: "1rem" } }) }), _jsx("div", { style: { marginBottom: "1rem" }, children: _jsx(Turnstile, { sitekey: TURNSTILE_SITE_KEY, onVerify: (token) => setTurnstileToken(token), theme: "auto" }) }), _jsx("button", { type: "submit", style: { width: "100%", padding: "0.5rem" }, disabled: !turnstileToken, children: "Login" })] }), _jsx("p", { style: { marginTop: "0.5rem", textAlign: "center" }, children: _jsx("a", { href: "#", onClick: (e) => {
                                e.preventDefault();
                                setIsResetting(true);
                                setTurnstileToken(null); // Reset the token when switching forms
                            }, style: { fontSize: "0.9rem", color: "#0066cc" }, children: "Forgot password?" }) })] })) : (_jsxs(_Fragment, { children: [_jsxs("form", { onSubmit: handleResetRequest, children: [_jsx("p", { style: { marginBottom: "1rem" }, children: "Enter your email address and we'll send you instructions to reset your password." }), _jsx("div", { children: _jsx("input", { id: "reset-email", name: "email", type: "email", autoComplete: "username", placeholder: "Email", value: resetEmail, onChange: (e) => setResetEmail(e.target.value), style: { width: "100%", marginBottom: "1rem" } }) }), _jsx("div", { style: { marginBottom: "1rem" }, children: _jsx(Turnstile, { sitekey: TURNSTILE_SITE_KEY, onVerify: (token) => setTurnstileToken(token), theme: "auto" }) }), _jsx("button", { type: "submit", style: { width: "100%", padding: "0.5rem" }, disabled: !turnstileToken, children: "Send Reset Link" })] }), _jsx("p", { style: { marginTop: "0.5rem", textAlign: "center" }, children: _jsx("a", { href: "#", onClick: (e) => {
                                e.preventDefault();
                                setIsResetting(false);
                                setTurnstileToken(null); // Reset the token when switching forms
                            }, style: { fontSize: "0.9rem", color: "#0066cc" }, children: "Back to login" }) })] })), _jsxs("p", { style: { marginTop: "1rem" }, children: ["Don't have an account? ", _jsx(Link, { to: "/signup", children: "Sign up" })] }), error && _jsx("div", { style: { color: "red", marginTop: "1rem" }, children: error })] }));
}
