// src/App.tsx

import { useState } from "react";

function App() {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    const endpoint = isLoginMode ? "/api/login" : "/api/signup";

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isLoginMode
            ? { email, password }
            : { email, name, password }
        ),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Something went wrong");
      }

      if (isLoginMode) {
        localStorage.setItem("token", data.token);
        setMessage("Login successful!");
      } else {
        setMessage("Signup successful! Now you can login.");
        setIsLoginMode(true);
      }
    } catch (err: any) {
      setMessage(err.message);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: "auto", padding: "1rem" }}>
      <h1>{isLoginMode ? "Login" : "Signup"}</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          required
          onChange={(e) => setEmail(e.target.value)}
          style={{ display: "block", marginBottom: "1rem", width: "100%" }}
        />
        {!isLoginMode && (
          <input
            type="text"
            placeholder="Name"
            value={name}
            required
            onChange={(e) => setName(e.target.value)}
            style={{ display: "block", marginBottom: "1rem", width: "100%" }}
          />
        )}
        <input
          type="password"
          placeholder="Password"
          value={password}
          required
          onChange={(e) => setPassword(e.target.value)}
          style={{ display: "block", marginBottom: "1rem", width: "100%" }}
        />
        <button type="submit" style={{ width: "100%", padding: "0.5rem" }}>
          {isLoginMode ? "Login" : "Signup"}
        </button>
      </form>

      <button
        onClick={() => {
          setIsLoginMode(!isLoginMode);
          setMessage("");
        }}
        style={{ marginTop: "1rem", width: "100%", padding: "0.5rem" }}
      >
        {isLoginMode ? "Need an account? Signup" : "Already have an account? Login"}
      </button>

      {message && (
        <div style={{ marginTop: "1rem", color: "blue" }}>
          {message}
        </div>
      )}
    </div>
  );
}

export default App;
