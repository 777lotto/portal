import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// frontend/src/components/LoginForm.tsx - CORRECTED
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { login } from '../lib/api';
import Turnstile from './Turnstile';
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;
function LoginForm({ setToken }) {
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [turnstileToken, setTurnstileToken] = useState('');
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!turnstileToken) {
            setError("Please complete the security check.");
            return;
        }
        setError(null);
        setIsLoading(true);
        try {
            const response = await login({
                email: identifier,
                password,
                'cf-turnstile-response': turnstileToken
            });
            if (response.token) {
                setToken(response.token);
                navigate('/dashboard');
            }
            else {
                throw new Error("Login failed: No token received.");
            }
        }
        catch (err) {
            setError(err.message);
        }
        finally {
            setIsLoading(false);
        }
    };
    return (_jsx("div", { className: "container mt-5", children: _jsx("div", { className: "row justify-content-center", children: _jsx("div", { className: "col-md-6", children: _jsx("div", { className: "card", children: _jsxs("div", { className: "card-body", children: [_jsx("h3", { className: "card-title text-center", children: "Login" }), _jsxs("form", { onSubmit: handleSubmit, children: [_jsxs("div", { className: "mb-3", children: [_jsx("label", { children: "Email" }), _jsx("input", { type: "email", value: identifier, onChange: e => setIdentifier(e.target.value), className: "form-control", required: true })] }), _jsxs("div", { className: "mb-3", children: [_jsx("label", { children: "Password" }), _jsx("input", { type: "password", value: password, onChange: e => setPassword(e.target.value), className: "form-control", required: true })] }), _jsx("div", { className: "mb-3 d-flex justify-content-center", children: _jsx(Turnstile, { sitekey: TURNSTILE_SITE_KEY, onVerify: setTurnstileToken }) }), error && _jsx("div", { className: "alert alert-danger", children: error }), _jsx("div", { className: "d-grid", children: _jsx("button", { type: "submit", className: "btn btn-primary", disabled: isLoading || !turnstileToken, children: isLoading ? 'Logging in...' : 'Login' }) }), _jsx("div", { className: "text-center mt-3", children: _jsxs("p", { children: ["Don't have an account? ", _jsx(Link, { to: "/signup", children: "Sign up" })] }) })] })] }) }) }) }) }));
}
export default LoginForm;
