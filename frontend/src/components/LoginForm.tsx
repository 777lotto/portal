// src/components/LoginForm.tsx
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { login } from "../lib/api";
import Turnstile from "./Turnstile";

interface Props {
  setToken: (token: string) => void;
}

export default function LoginForm({ setToken }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const TURNSTILE_SITE_KEY = "0x4AAAAAABcgNHsEZnTPqdEV";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!turnstileToken) {
      setError("Please complete the security check");
      return;
    }

    try {
      const token = await login(email, password, turnstileToken);
      localStorage.setItem("token", token);
      setToken(token);
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.message || "Login failed");
    }
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Login</h1>
      {!isResetting ? (
      <form onSubmit={handleSubmit}>
          <div>
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="username"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
  ) : (
      <p style={{ marginTop: "1rem" }}>
        Don’t have an account? <Link to="/signup">Sign up</Link>
      </p>

      {error && <div style={{ color: "red", marginTop: "1rem" }}>{error}</div>}
    </div>
  );
}
