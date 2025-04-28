import { useState } from "react";
import { apiPost, apiGet } from "./lib/api";

function App() {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [profile, setProfile] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setProfile(null);

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setMessage("");
  setProfile(null);

  try {
    const endpoint = isLoginMode ? "/api/login" : "/api/signup";

    const data = await apiPost(endpoint,
      isLoginMode ? { email, password } : { email, name, password }
    );

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

const fetchProfile = async () => {
  const token = localStorage.getItem("token");
  if (!token) {
    setMessage("No token found. Please login.");
    return;
  }

  try {
    const data = await apiGet("/api/profile", token);
    setProfile(data);
    setMessage("Profile loaded!");
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
          setProfile(null);
        }}
        style={{ marginTop: "1rem", width: "100%", padding: "0.5rem" }}
      >
        {isLoginMode ? "Need an account? Signup" : "Already have an account? Login"}
      </button>

      <hr style={{ margin: "2rem 0" }} />

      <button
        onClick={fetchProfile}
        style={{ width: "100%", padding: "0.5rem", backgroundColor: "lightgreen" }}
      >
        View My Profile
      </button>

      {message && (
        <div style={{ marginTop: "1rem", color: "blue" }}>
          {message}
        </div>
      )}

      {profile && (
        <div style={{ marginTop: "1rem", padding: "1rem", border: "1px solid gray" }}>
          <h3>My Profile</h3>
          <p><strong>Email:</strong> {profile.email}</p>
          <p><strong>Name:</strong> {profile.name}</p>
          <p><strong>ID:</strong> {profile.id}</p>
        </div>
      )}
    </div>
  );
}

export default App;
