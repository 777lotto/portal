import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getJob } from "../lib/api";
import { Job } from '@portal/shared';

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem("token")!;

  useEffect(() => {
    async function fetchJob() {
      try {
        if (!id) throw new Error("Job ID is required");
        setLoading(true);
        const jobData = await getJob(id, token);
        setJob(jobData);
      } catch (err: any) {
        setError(err.message || "Failed to load job details");
      } finally {
        setLoading(false);
      }
    }

    fetchJob();
  }, [id, token]);

  if (loading) return <div style={{ padding: "2rem" }}>Loading...</div>;
  if (error) return <div style={{ padding: "2rem", color: "red" }}>{error}</div>;
  if (!job) return <div style={{ padding: "2rem" }}>Job not found</div>;

  // Format dates for display
  const startDate = new Date(job.start).toLocaleString();
  const endDate = new Date(job.end).toLocaleString();

  return (
    <div style={{ padding: "2rem" }}>
      <h1>{job.title}</h1>

      <div style={{ marginTop: "1rem" }}>
        <p><strong>Start:</strong> {startDate}</p>
        <p><strong>End:</strong> {endDate}</p>
        <p><strong>Status:</strong> {job.status}</p>

        {job.description && (
          <div style={{ marginTop: "1rem" }}>
            <h3>Description</h3>
            <p>{job.description}</p>
          </div>
        )}

        {job.recurrence !== 'none' && (
          <p style={{ marginTop: "1rem" }}>
            <strong>Recurrence:</strong> {job.recurrence}
            {job.recurrence === 'custom' && job.rrule && (
              <span> ({job.rrule})</span>
            )}
          </p>
        )}

        <div style={{ marginTop: "2rem" }}>
          <button
            onClick={() => window.open(`/api/calendar-feed?token=${token}`, '_blank')}
            style={{ padding: "0.5rem 1rem", marginRight: "1rem" }}
          >
            Add to Calendar
          </button>
        </div>
      </div>
    </div>
  );
}
