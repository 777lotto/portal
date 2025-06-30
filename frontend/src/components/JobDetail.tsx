// frontend/src/components/JobDetail.tsx - CORRECTED
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { apiGet } from '../lib/api.js';
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
  // const [photos, setPhotos] = useState<Photo[]>([]); // FIX: Commented out unused variable
  // const [notes, setNotes] = useState<Note[]>([]);   // FIX: Commented out unused variable
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchJobDetails = async () => {
      if (!id) return;

      try {
        setIsLoading(true);
        setError(null);

        const [jobData, photosData, notesData] = await Promise.all([
          apiGet<Job>(`/jobs/${id}`),
          apiGet<Photo[]>(`/jobs/${id}/photos`),
          apiGet<Note[]>(`/jobs/${id}/notes`)
        ]);

        setJob(jobData);
        // setPhotos(photosData); // FIX: Commented out unused setter
        // setNotes(notesData);   // FIX: Commented out unused setter
        // Keep the console logs to see the data you're getting
        console.log("Fetched Photos:", photosData);
        console.log("Fetched Notes:", notesData);

      } catch (err: any) {
        console.error("Error fetching job details:", err);
        setError(err.message || 'An unknown error occurred.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchJobDetails();
  }, [id]);

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
    </div>
  );
}

export default JobDetail;
