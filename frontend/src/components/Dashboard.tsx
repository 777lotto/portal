import { useEffect, useState } from "react";
import { apiGet, openPortal, getJobs } from "../lib/api";
import { Link, useNavigate } from "react-router-dom";
import { Job } from "@portal/shared";

export default function Dashboard() {
  const [profile, setProfile] = useState<any>(null);
  const [upcomingJobs, setUpcomingJobs] = useState<Job[]>([]);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          navigate("/login");
          return;
        }

        // Fetch profile and upcoming jobs in parallel
        const [profileData, jobsData] = await Promise.all([
          apiGet("/profile", token),
          getJobs(token)
        ]);

        setProfile(profileData);

        // Filter for upcoming jobs and sort by start date
        const now = new Date();
        const upcoming = jobsData
          .filter((job: Job) =>
            new Date(job.start) > now &&
            job.status !== 'cancelled'
          )
          .sort((a: Job, b: Job) =>
            new Date(a.start).getTime() - new Date(b.start).getTime()
          )
          .slice(0, 3); // Just show the next 3 appointments

        setUpcomingJobs(upcoming);
      } catch (err: any) {
        setError(err.message || "Failed to load data");
      }
    };

    fetchData();
  }, [navigate]);

  // Handle opening Stripe portal
  const handlePortal = async () => {
    try {
      const token = localStorage.getItem("token")!;
      const { url } = await openPortal(token);
      window.open(url, "_blank");
    } catch (err: any) {
      setError(err.message || "Failed to open billing portal");
    }
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Welcome to Your Portal</h1>

      {error && (
        <div style={{ color: "red", marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {profile ? (
        <div>
          <section>
            <h2>Your Profile</h2>
            <p>
              <strong>Name:</strong> {profile.name}
            </p>
            <p>
              <strong>Email:</strong> {profile.email}
            </p>
          </section>

          <section style={{ marginTop: "2rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2>Upcoming Services</h2>
              <Link to="/calendar" style={{ textDecoration: "none" }}>
                View Full Calendar
              </Link>
            </div>

            {upcomingJobs.length > 0 ? (
              <div>
                {upcomingJobs.map(job => (
                  <div
                    key={job.id}
                    style={{
                      padding: "1rem",
                      marginBottom: "1rem",
                      border: "1px solid #ddd",
                      borderRadius: "4px"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <h3>{job.title}</h3>
                      <Link to={`/jobs/${job.id}`}>View Details</Link>
                    </div>
                    <p>
                      <strong>Date:</strong>{" "}
                      {new Date(job.start).toLocaleDateString()} at{" "}
                      {new Date(job.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    {job.description && <p>{job.description}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <p>No upcoming appointments scheduled.</p>
            )}
          </section>

          <div style={{ marginTop: "2rem", display: "flex", gap: "1rem" }}>
            <button
              onClick={handlePortal}
              style={{ padding: "0.5rem 1rem" }}
            >
              Manage Billing
            </button>

            <button
              onClick={() => navigate("/calendar-sync")}
              style={{ padding: "0.5rem 1rem" }}
            >
              Sync Calendar
            </button>
          </div>
        </div>
      ) : (
        <p>Loading profile...</p>
      )}
    </div>
  );
}
