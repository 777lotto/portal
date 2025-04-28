import { useState } from "react";
import { login, signup } from "./api"; // make sure you have this

function App() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      if (isLoginMode) {
        const token = await login(email, password);
        setToken(token);
      } else {
        const token = await signup(email, name, password);
        setToken(token);
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    }
  };

  if (token) {
    return <div>Logged in! Your token: {token}</div>;
  }

  return (
    <div style={{ padding: "2rem" }}>
      <h1>{isLoginMode ? "Login" : "Signup"}</h1>

      <form onSubmit={handleSubmit}>
        <div>
          <input
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        {!isLoginMode && (
          <div>
            <input
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        )}

        <div>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button type="submit">
          {isLoginMode ? "Login" : "Signup"}
        </button>
      </form>

      <button
        onClick={() => setIsLoginMode(!isLoginMode)}
        style={{ marginTop: "1rem" }}
      >
        Switch to {isLoginMode ? "Signup" : "Login"}
      </button>

      {error && <div style={{ color: "red" }}>{error}</div>}
    </div>
  );
}

export default App;
