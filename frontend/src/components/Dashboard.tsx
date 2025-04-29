// src/components/Dashboard.tsx
import { useEffect, useState } from "react";
import { apiGet } from "../lib/api";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const [profile, setProfile] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          navigate("/login");
          return;
        }

        const data = await apiGet("/profile", token);
        setProfile(data);
      } catch (err: any) {
        setError(err.message || "Failed to load profile");
      }
    };

    fetchProfile();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Dashboard</h1>
      {error && <div style={{ color: "red", marginBottom: "1rem" }}>{error}</div>}
      {profile ? (
        <div>
          <p><strong>Name:</strong> {profile.name}</p>
          <p><strong>Email:</strong> {profile.email}</p>
          <p><strong>ID:</strong> {profile.id}</p>
          <button onClick={handleLogout} style={{ marginTop: "2rem", padding: "0.5rem 1rem" }}>
            Logout
          </button>
        </div>
      ) : (
        <p>Loading profile...</p>
      )}
    </div>
  );
}
