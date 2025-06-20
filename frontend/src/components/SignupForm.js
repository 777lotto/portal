import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// src/components/SignupForm.tsx - Fixed Turnstile handling and form state
import { useState, useEffect } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { signupCheck, signup, checkStripeCustomer, createStripeCustomer } from "../lib/api";
import Turnstile from "./Turnstile";
export default function SignupForm({ setToken }) {
    const [step, setStep] = useState("email");
    const [mode, setMode] = useState("new");
    const [email, setEmail] = useState("");
    const [name, setName] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const [turnstileToken, setTurnstileToken] = useState(null);
    const [turnstileKey, setTurnstileKey] = useState("initial"); // Key to reset Turnstile
    const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || "0x4AAAAAABcgNHsEZnTPqdEV";
    const [phone, setPhone] = useState("");
    // Check for email in URL params (for redirects)
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const emailParam = params.get('email');
        if (emailParam) {
            setEmail(emailParam);
        }
    }, [location]);
    // Reset error when form changes
    useEffect(() => {
        setError(null);
    }, [email, phone, name, password, step]);
    // Add validation function
    const validateIdentifiers = () => {
        if (!email && !phone) {
            setError("Please provide either an email address or phone number");
            return false;
        }
        return true;
    };
    // STEP 1: check email
    const handleCheck = async (e) => {
        e.preventDefault();
        if (!validateIdentifiers())
            return;
        setError(null);
        setIsLoading(true);
        // Only proceed if turnstile is verified
        if (!turnstileToken) {
            setError("Please complete the security check");
            setIsLoading(false);
            return;
        }
        try {
            console.log('Checking signup for:', { email, phone });
            // First check if user exists in portal
            const { status } = await signupCheck(email, phone, turnstileToken);
            if (status === "existing") {
                // User already exists in portal - redirect to login with email
                const params = new URLSearchParams();
                if (email)
                    params.set('email', email);
                if (phone)
                    params.set('phone', phone);
                params.set('existing', 'true');
                navigate(`/login?${params.toString()}`);
                return;
            }
            // If not in portal, check if user exists in Stripe
            const stripeResult = await checkStripeCustomer(email, phone);
            if (stripeResult.exists) {
                // Customer exists in Stripe but not in portal
                setMode("stripe-only");
                setName(stripeResult.name || "");
                // If they used phone to find customer but no email was provided, use the one from Stripe
                if (!email && stripeResult.email) {
                    setEmail(stripeResult.email);
                }
            }
            else {
                // New user, not in portal or Stripe
                setMode("new");
            }
            // Move to next step - don't reset turnstile token
            setStep("complete");
        }
        catch (err) {
            console.error('Signup check error:', err);
            setError(err.message || "Check failed");
            // Reset Turnstile on error
            setTurnstileToken(null);
            setTurnstileKey(prev => prev + "-reset");
        }
        finally {
            setIsLoading(false);
        }
    };
    // STEP 2: complete signup
    const handleSignup = async (e) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);
        try {
            let result;
            console.log('Completing signup:', { mode, email, name, phone });
            if (mode === "new") {
                // New user - create in Stripe first, then portal
                await createStripeCustomer(email, name, phone);
                result = await signup(email, name, password, phone);
            }
            else if (mode === "stripe-only") {
                // User exists in Stripe but not portal - just create portal account
                result = await signup(email, name, password, phone);
            }
            else {
                throw new Error("Invalid signup mode");
            }
            localStorage.setItem("token", result.token);
            setToken(result.token);
            navigate("/dashboard");
        }
        catch (err) {
            console.error('Signup error:', err);
            setError(err.message || "Signup failed");
        }
        finally {
            setIsLoading(false);
        }
    };
    const handleTurnstileVerify = (token) => {
        console.log('Turnstile verified:', token);
        setTurnstileToken(token);
        setError(null); // Clear any security check errors
    };
    return (_jsxs("div", { style: { padding: "2rem" }, children: [_jsx("h1", { children: step === "email"
                    ? "Enter your contact info"
                    : mode === "new"
                        ? "Create your account"
                        : mode === "stripe-only"
                            ? "Complete your account"
                            : "Sign up" }), step === "email" ? (_jsxs("form", { onSubmit: handleCheck, children: [_jsxs("div", { style: { marginBottom: "1rem" }, children: [_jsxs("label", { htmlFor: "signup-email", style: { display: "block", marginBottom: "0.5rem" }, children: ["Email Address ", !phone && _jsx("span", { style: { color: "#dc3545" }, children: "*" })] }), _jsx("input", { id: "signup-email", name: "email", type: "email", autoComplete: "email", placeholder: "Email", value: email, onChange: (e) => setEmail(e.target.value.trim().toLowerCase()), style: { width: "100%", padding: "0.5rem" }, required: !phone })] }), _jsxs("div", { style: { marginBottom: "1rem" }, children: [_jsxs("label", { htmlFor: "signup-phone", style: { display: "block", marginBottom: "0.5rem" }, children: ["Phone Number ", !email && _jsx("span", { style: { color: "#dc3545" }, children: "*" })] }), _jsx("input", { id: "signup-phone", name: "phone", type: "tel", autoComplete: "tel", placeholder: "(555) 123-4567", value: phone, onChange: (e) => setPhone(e.target.value.trim()), style: { width: "100%", padding: "0.5rem" }, required: !email })] }), !email && !phone && (_jsx("div", { style: { color: "#dc3545", marginBottom: "1rem", fontSize: "0.9rem" }, children: "Please provide either an email address or phone number" })), _jsx("div", { style: { marginBottom: "1rem" }, children: _jsx(Turnstile, { sitekey: TURNSTILE_SITE_KEY, onVerify: handleTurnstileVerify, theme: "auto" }, turnstileKey) }), _jsx("button", { type: "submit", disabled: isLoading || !turnstileToken || (!email && !phone), style: {
                            width: "100%",
                            padding: "0.5rem",
                            backgroundColor: (isLoading || !turnstileToken || (!email && !phone)) ? "#ccc" : "#007bff",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: (isLoading || !turnstileToken || (!email && !phone)) ? "not-allowed" : "pointer",
                            opacity: (isLoading || !turnstileToken || (!email && !phone)) ? 0.7 : 1
                        }, children: isLoading ? "Checking..." : "Continue" })] })) : (_jsxs("form", { onSubmit: handleSignup, children: [mode === "stripe-only" && (_jsx("div", { style: {
                            backgroundColor: "#e3f2fd",
                            padding: "12px",
                            borderRadius: "4px",
                            marginBottom: "16px"
                        }, children: _jsx("p", { style: { margin: 0 }, children: "Welcome back! We found your information in our system. Please complete your account setup." }) })), email && (_jsxs("p", { children: ["Email: ", _jsx("strong", { children: email })] })), phone && (_jsxs("p", { children: ["Phone: ", _jsx("strong", { children: phone })] })), _jsxs("div", { children: [_jsx("label", { htmlFor: "signup-name", style: { display: "block", marginBottom: "0.5rem" }, children: "Full Name" }), _jsx("input", { id: "signup-name", name: "name", autoComplete: "name", placeholder: "Your full name", value: name, onChange: (e) => setName(e.target.value), style: { width: "100%", marginBottom: "1rem", padding: "0.5rem" }, required: true })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "signup-password", style: { display: "block", marginBottom: "0.5rem" }, children: "Create Password" }), _jsx("input", { id: "signup-password", name: "password", type: "password", autoComplete: "new-password", placeholder: "Password", value: password, onChange: (e) => setPassword(e.target.value), style: { width: "100%", marginBottom: "1rem", padding: "0.5rem" }, required: true, minLength: 6 })] }), _jsxs("div", { style: { display: "flex", gap: "1rem" }, children: [_jsx("button", { type: "button", onClick: () => {
                                    setStep("email");
                                    setTurnstileToken(null);
                                    setTurnstileKey(prev => prev + "-back");
                                }, style: {
                                    padding: "0.5rem 1rem",
                                    backgroundColor: "transparent",
                                    border: "1px solid #ccc",
                                    borderRadius: "4px",
                                    cursor: "pointer"
                                }, children: "Back" }), _jsx("button", { type: "submit", disabled: isLoading, style: {
                                    flex: 1,
                                    padding: "0.5rem",
                                    backgroundColor: isLoading ? "#ccc" : "#4CAF50",
                                    color: "white",
                                    border: "none",
                                    borderRadius: "4px",
                                    cursor: isLoading ? "not-allowed" : "pointer",
                                    opacity: isLoading ? 0.7 : 1
                                }, children: isLoading
                                    ? "Processing..."
                                    : mode === "new"
                                        ? "Create Account"
                                        : "Complete Account Setup" })] })] })), error && (_jsx("div", { style: {
                    color: "white",
                    backgroundColor: "#f44336",
                    padding: "10px",
                    borderRadius: "4px",
                    marginTop: "1rem"
                }, children: error })), _jsxs("p", { style: { marginTop: "1rem" }, children: ["Already have an account?", " ", _jsx(Link, { to: "/login", style: { color: "#0066cc" }, children: "Login" })] })] }));
}
