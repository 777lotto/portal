// src/components/SignupForm.tsx
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
   const TURNSTILE_SITE_KEY = "0x4AAAAAABcgNHsEZnTPqdEV";

  // Check for email in URL params (for redirects)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const emailParam = params.get('email');
    if (emailParam) {
      setEmail(emailParam);
    }
  }, [location]);

  // STEP 1: check email
  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

        // Only proceed if turnstile is verified in step 1
    if (!turnstileToken) {
      setError("Please complete the security check");
      setIsLoading(false);
      return;
    }

    try {
      // First check if user exists in portal
      const { status, name: existingName } = await signupCheck(email, turnstileToken);

      if (status === "existing") {
        // User already exists in portal - redirect to login with email
        navigate(`/login?email=${encodeURIComponent(email)}&existing=true`);
        return;
      }

      // If not in portal, check if user exists in Stripe
      const stripeResult = await checkStripeCustomer(email);

      if (stripeResult.exists) {
        // Customer exists in Stripe but not in portal
        setMode("stripe-only");
        setName(stripeResult.name || "");
      } else {
        // New user, not in portal or Stripe
        setMode("new");
      }

      setStep("complete");
    } catch (err: any) {
      setError(err.message || "Check failed");
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

      if (mode === "new") {
        // New user - create in Stripe first, then portal
        await createStripeCustomer(email, name);
        result = await signup(email, name, password);
      } else if (mode === "stripe-only") {
        // User exists in Stripe but not portal - just create portal account
        result = await signup(email, name, password);
      }

      localStorage.setItem("token", result.token);
      setToken(result.token);
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.message || "Signup failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1>
        {step === "email"
          ? "Enter your email"
          : mode === "new"
          ? "Create your account"
          : mode === "stripe-only"
          ? "Complete your account"
          : "Sign up"}
      </h1>

      {step === "email" ? (
        <form onSubmit={handleCheck}>
          <input
            id="signup-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="Email"
            value={email}
            onChange={(e) =>
              setEmail(e.target.value.trim().toLowerCase())
            }
            style={{ width: "100%", marginBottom: "1rem" }}
          />
          <div style={{ marginBottom: "1rem" }}>
            <Turnstile
              sitekey={TURNSTILE_SITE_KEY}
              onVerify={(token) => setTurnstileToken(token)}
              theme="auto"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !turnstileToken}
            style={{
              width: "100%",
              padding: "0.5rem",
              opacity: (isLoading || !turnstileToken) ? 0.7 : 1
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

          <p>
            Email: <strong>{email}</strong>
          </p>
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
          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: "100%",
              padding: "0.5rem",
              backgroundColor: "#4CAF50",
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
