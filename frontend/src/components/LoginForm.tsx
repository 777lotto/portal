// src/components/LoginForm.tsx
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { login } from "../lib/api";

interface Props {
  setToken: (token: string) => void;
}

export default function LoginForm({ setToken }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const token = await login(email, password);
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
      <form onSubmit={handleSubmit}>
        <div>
          <input
        id="login-email"
        name="email"
        type="email"
        autoComplete="username"
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
        <button type="submit" style={{ width: "100%", padding: "0.5rem" }}>
          Login
        </button>
      </form>

      <p style={{ marginTop: "1rem" }}>
        Don’t have an account? <Link to="/signup">Sign up</Link>
      </p>

      {error && <div style={{ color: "red", marginTop: "1rem" }}>{error}</div>}
    </div>
  );
}
