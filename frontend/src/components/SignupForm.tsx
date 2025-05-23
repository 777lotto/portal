// src/components/SignupForm.tsx - Fixed Turnstile handling and form state
import { useState, useEffect } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { signupCheck, signup, checkStripeCustomer, createStripeCustomer } from "../lib/api";
import Turnstile from "./Turnstile";

interface Props {
  setToken: (token: string) => void;
}

export default function SignupForm({ setToken }: Props) {
  const [step, setStep] = useState<"email" | "complete">("email");
  const [mode, setMode] = useState<"new" | "existing" | "stripe-only">("new");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileKey, setTurnstileKey] = useState<string>("initial"); // Key to reset Turnstile
  const TURNSTILE_SITE_KEY = "0x4AAAAAABcgNHsEZnTPqdEV";
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
  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateIdentifiers()) return;
    
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
        if (email) params.set('email', email);
        if (phone) params.set('phone', phone);
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
      } else {
        // New user, not in portal or Stripe
        setMode("new");
      }

      // Move to next step - don't reset turnstile token
      setStep("complete");
    } catch (err: any) {
      console.error('Signup check error:', err);
      setError(err.message || "Check failed");
      // Reset Turnstile on error
      setTurnstileToken(null);
      setTurnstileKey(prev => prev + "-reset");
    } finally {
      setIsLoading(false);
    }
  };

  // STEP 2: complete signup
  const handleSignup = async (e: React.FormEvent) => {
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
      } else if (mode === "stripe-only") {
        // User exists in Stripe but not portal - just create portal account
        result = await signup(email, name, password, phone);
      } else {
        throw new Error("Invalid signup mode");
      }

      localStorage.setItem("token", result.token);
      setToken(result.token);
      navigate("/dashboard");
    } catch (err: any) {
      console.error('Signup error:', err);
      setError(err.message || "Signup failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTurnstileVerify = (token: string) => {
    console.log('Turnstile verified:', token);
    setTurnstileToken(token);
    setError(null); // Clear any security check errors
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1>
        {step === "email"
          ? "Enter your contact info"
          : mode === "new"
          ? "Create your account"
          : mode === "stripe-only"
          ? "Complete your account"
          : "Sign up"}
      </h1>

      {step === "email" ? (
        <form onSubmit={handleCheck}>
          <div style={{ marginBottom: "1rem" }}>
            <label htmlFor="signup-email" style={{ display: "block", marginBottom: "0.5rem" }}>
              Email Address {!phone && <span style={{ color: "#dc3545" }}>*</span>}
            </label>
            <input
              id="signup-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value.trim().toLowerCase())}
              style={{ width: "100%", padding: "0.5rem" }}
              required={!phone}
            />
          </div>
          
          <div style={{ marginBottom: "1rem" }}>
            <label htmlFor="signup-phone" style={{ display: "block", marginBottom: "0.5rem" }}>
              Phone Number {!email && <span style={{ color: "#dc3545" }}>*</span>}
            </label>
            <input
              id="signup-phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              placeholder="(555) 123-4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value.trim())}
              style={{ width: "100%", padding: "0.5rem" }}
              required={!email}
            />
          </div>
          
          {!email && !phone && (
            <div style={{ color: "#dc3545", marginBottom: "1rem", fontSize: "0.9rem" }}>
              Please provide either an email address or phone number
            </div>
          )}
          
          <div style={{ marginBottom: "1rem" }}>
            <Turnstile
              sitekey={TURNSTILE_SITE_KEY}
              onVerify={handleTurnstileVerify}
              theme="auto"
              key={turnstileKey} // This will reset the component when key changes
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !turnstileToken || (!email && !phone)}
            style={{
              width: "100%",
              padding: "0.5rem",
              backgroundColor: (isLoading || !turnstileToken || (!email && !phone)) ? "#ccc" : "#007bff",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: (isLoading || !turnstileToken || (!email && !phone)) ? "not-allowed" : "pointer",
              opacity: (isLoading || !turnstileToken || (!email && !phone)) ? 0.7 : 1
            }}
          >
            {isLoading ? "Checking..." : "Continue"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleSignup}>
          {mode === "stripe-only" && (
            <div style={{
              backgroundColor: "#e3f2fd",
              padding: "12px",
              borderRadius: "4px",
              marginBottom: "16px"
            }}>
              <p style={{ margin: 0 }}>
                Welcome back! We found your information in our system.
                Please complete your account setup.
              </p>
            </div>
          )}

          {/* Display the contact information provided */}
          {email && (
            <p>
              Email: <strong>{email}</strong>
            </p>
          )}
          {phone && (
            <p>
              Phone: <strong>{phone}</strong>
            </p>
          )}
          
          <div>
            <label htmlFor="signup-name" style={{ display: "block", marginBottom: "0.5rem" }}>
              Full Name
            </label>
            <input
              id="signup-name"
              name="name"
              autoComplete="name"
              placeholder="Your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ width: "100%", marginBottom: "1rem", padding: "0.5rem" }}
              required
            />
          </div>
          <div>
            <label htmlFor="signup-password" style={{ display: "block", marginBottom: "0.5rem" }}>
              Create Password
            </label>
            <input
              id="signup-password"
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: "100%", marginBottom: "1rem", padding: "0.5rem" }}
              required
              minLength={6}
            />
          </div>
          
          <div style={{ display: "flex", gap: "1rem" }}>
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setTurnstileToken(null);
                setTurnstileKey(prev => prev + "-back");
              }}
              style={{
                padding: "0.5rem 1rem",
                backgroundColor: "transparent",
                border: "1px solid #ccc",
                borderRadius: "4px",
                cursor: "pointer"
              }}
            >
              Back
            </button>
            
            <button
              type="submit"
              disabled={isLoading}
              style={{
                flex: 1,
                padding: "0.5rem",
                backgroundColor: isLoading ? "#ccc" : "#4CAF50",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: isLoading ? "not-allowed" : "pointer",
                opacity: isLoading ? 0.7 : 1
              }}
            >
              {isLoading
                ? "Processing..."
                : mode === "new"
                  ? "Create Account"
                  : "Complete Account Setup"}
            </button>
          </div>
        </form>
      )}

      {error && (
        <div style={{
          color: "white",
          backgroundColor: "#f44336",
          padding: "10px",
          borderRadius: "4px",
          marginTop: "1rem"
        }}>
          {error}
        </div>
      )}

      <p style={{ marginTop: "1rem" }}>
        Already have an account?{" "}
        <Link to="/login" style={{ color: "#0066cc" }}>
          Login
        </Link>
      </p>
    </div>
  );
}
