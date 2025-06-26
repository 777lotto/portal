// frontend/src/components/JobDetail.tsx - Updated with try/catch

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiGet } from '../lib/api';
import type { Job } from '@portal/shared';

// Define types for our new data
interface Photo {
  id: string;
  url: string;
  created_at: string;
}

interface Note {
  id: number;
  content: string;
  created_at: string;
}

function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchJobDetails = async () => {
      if (!id) return;
      const token = localStorage.getItem("token");
      if (!token) return;

      // --- NEW: Use a try/catch block to handle API calls ---
      try {
        setIsLoading(true);
        setError(null);

        // Promise.all will now either resolve with an array of data, or reject if ANY call fails
        const [jobData, photosData, notesData] = await Promise.all([
          apiGet<Job>(`/api/jobs/${id}`, token),
          apiGet<Photo[]>(`/api/jobs/${id}/photos`, token),
          apiGet<Note[]>(`/api/jobs/${id}/notes`, token)
        ]);

        // If we get here, all calls were successful
        setJob(jobData);
        setPhotos(photosData);
        setNotes(notesData);

      } catch (err: any) {
        // Any error from the Promise.all will be caught here
        console.error("Error fetching job details:", err);
        setError(err.message || 'An unknown error occurred.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchJobDetails();
  }, [id]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  if (isLoading) return <div className="container mt-4">Loading job details...</div>;
  if (error) return <div className="container mt-4 alert alert-danger">Error: {error}</div>;
  if (!job) return <div className="container mt-4"><h2>Job not found</h2></div>;

  return (
    <div className="container mt-4">
      <div className="card">
        <div className="card-header"><h2>Job Detail: {job.title}</h2></div>
        <div className="card-body">
          <p><strong>Status:</strong> <span className={`badge bg-${job.status === 'completed' ? 'success' : 'secondary'}`}>{job.status}</span></p>
        </div>
      </div>
      {/*... Other JSX to render photos and notes ...*/}
    </div>
  );
}

export default JobDetail;
