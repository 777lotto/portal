// src/components/SignupForm.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signup } from "../lib/api";
 import { Link } from "react-router-dom";

interface Props {
  setToken: (token: string) => void;
}

export default function SignupForm({ setToken }: Props) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const token = await signup(email, name, password);
      localStorage.setItem("token", token);
      setToken(token);
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.message || "Signup failed");
    }
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Signup</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <input
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: "100%", marginBottom: "1rem" }}
          />
        </div>
        <div>
          <input
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ width: "100%", marginBottom: "1rem" }}
          />
        </div>
        <div>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: "100%", marginBottom: "1rem" }}
          />
        </div>
        <button type="submit" style={{ width: "100%", padding: "0.5rem" }}>
          Signup
        </button>
      </form>


<p style={{ marginTop: "1rem" }}>
  Already have an account? <Link to="/login">Login</Link>
</p>

      {error && <div style={{ color: "red", marginTop: "1rem" }}>{error}</div>}
    </div>
  );
}

