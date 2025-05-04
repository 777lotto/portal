// src/components/SignupForm.tsx
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { signupCheck, signup } from "../lib/api";

interface Props {
  setToken: (token: string) => void;
}

export default function SignupForm({ setToken }: Props) {
  const [step, setStep] = useState<"email" | "complete">("email");
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  // STEP 1: check email
  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const { status, name: existingName } = await signupCheck(email);
      setMode(status);
      if (status === "existing" && existingName) {
        setName(existingName);
      }
      setStep("complete");
    } catch (err: any) {
      setError(err.message || "Check failed");
    }
  };

  // STEP 2: complete signup
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const { token } = await signup(email, name, password);
      localStorage.setItem("token", token);
      setToken(token);
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.message || "Signup failed");
    }
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1>
        {step === "email"
          ? "Enter your email"
          : mode === "new"
          ? "Sign up"
          : "Complete signup"}
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
          <button
            type="submit"
            style={{ width: "100%", padding: "0.5rem" }}
          >
            Continue
          </button>
        </form>
      ) : (
        <form onSubmit={handleSignup}>
          <p>
            Email: <strong>{email}</strong>
          </p>
          <div>
            <input
              id="signup-name"
              name="name"
              autoComplete="name"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ width: "100%", marginBottom: "1rem" }}
              required
            />
          </div>
          <div>
            <input
              id="signup-password"
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: "100%", marginBottom: "1rem" }}
              required
            />
          </div>
          <button
            type="submit"
            style={{ width: "100%", padding: "0.5rem" }}
          >
            {mode === "new" ? "Sign Up" : "Complete Signup"}
          </button>
        </form>
      )}

      {error && (
        <div style={{ color: "red", marginTop: "1rem" }}>{error}</div>
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
