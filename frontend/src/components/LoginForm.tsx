
// src/components/LoginForm.tsx - Updated code to handle email prefill
import { useState, useEffect } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { login, requestPasswordReset } from "../lib/api";
import Turnstile from "./Turnstile";

interface Props {
  setToken: (token: string) => void;
}

export default function LoginForm({ setToken }: Props) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const TURNSTILE_SITE_KEY = "0x4AAAAAABcgNHsEZnTPqdEV";

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!turnstileToken) {
      setError("Please complete the security check");
      return;
    }

    try {
      const token = await login(identifier, password, turnstileToken);
      localStorage.setItem("token", token);
      setToken(token);
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.message || "Login failed");
    }
  };

  const handleResetRequest = async (e: React.FormEvent) => {
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
    } catch (err: any) {
      setError(err.message || "Failed to request password reset");
    }
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1>{isResetting ? "Reset Password" : "Login"}</h1>

      {successMessage && (
        <div style={{
          color: "white",
          backgroundColor: "#4CAF50",
          padding: "10px",
          borderRadius: "4px",
          marginBottom: "1rem"
        }}>
          {successMessage}
        </div>
      )}

      {!isResetting ? (
        <>
          <form onSubmit={handleSubmit}>
            <div>
             <label htmlFor="login-identifier" style={{ display: "block", marginBottom: "0.5rem" }}>
               Email or Phone Number
              </label>
            <input
              id="login-identifier"
              name="identifier"
              type="text" // Use text to accept both email and phone
              autoComplete="username" // This will get email/phone suggestions
              placeholder="Enter email or phone number"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
             style={{ width: "100%", marginBottom: "1rem" }}
            />
            </div>
            <div>
              <input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ width: "100%", marginBottom: "1rem" }}
              />
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <Turnstile
                sitekey={TURNSTILE_SITE_KEY}
                onVerify={(token) => setTurnstileToken(token)}
                theme="auto"
              />
            </div>

            <button
              type="submit"
              style={{ width: "100%", padding: "0.5rem" }}
              disabled={!turnstileToken}
            >
              Login
            </button>
          </form>

          <p style={{ marginTop: "0.5rem", textAlign: "center" }}>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setIsResetting(true);
                setTurnstileToken(null); // Reset the token when switching forms
              }}
              style={{ fontSize: "0.9rem", color: "#0066cc" }}
            >
              Forgot password?
            </a>
          </p>
        </>
      ) : (
        <>
          <form onSubmit={handleResetRequest}>
            <p style={{ marginBottom: "1rem" }}>
              Enter your email address and we'll send you instructions to reset your password.
            </p>
            <div>
              <input
                id="reset-email"
                name="email"
                type="email"
                autoComplete="username"
                placeholder="Email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                style={{ width: "100%", marginBottom: "1rem" }}
              />
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <Turnstile
                sitekey={TURNSTILE_SITE_KEY}
                onVerify={(token) => setTurnstileToken(token)}
                theme="auto"
              />
            </div>
            <button
              type="submit"
              style={{ width: "100%", padding: "0.5rem" }}
              disabled={!turnstileToken}
            >
              Send Reset Link
            </button>
          </form>

          <p style={{ marginTop: "0.5rem", textAlign: "center" }}>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setIsResetting(false);
                setTurnstileToken(null); // Reset the token when switching forms
              }}
              style={{ fontSize: "0.9rem", color: "#0066cc" }}
            >
              Back to login
            </a>
          </p>
        </>
      )}

      <p style={{ marginTop: "1rem" }}>
        Don't have an account? <Link to="/signup">Sign up</Link>
      </p>

      {error && <div style={{ color: "red", marginTop: "1rem" }}>{error}</div>}
    </div>
  );
}
