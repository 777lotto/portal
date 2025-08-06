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

  if (isLoading) return <div className="text-center p-8">Loading job details...</div>;
  if (error) return <div className="rounded-md bg-event-red/10 p-4 text-sm text-event-red">{error}</div>;
  if (!job) return <div className="text-center p-8"><h2>Job not found</h2></div>;

  return (
    <div className="bg-primary-light dark:bg-tertiary-dark shadow-sm rounded-lg border border-border-light dark:border-border-dark">
      <div className="px-4 py-5 sm:px-6">
        <h2 className="text-2xl font-bold leading-6">Job Detail: {job.title}</h2>
      </div>
      <div className="border-t border-border-light dark:border-border-dark px-4 py-5 sm:p-0">
         <dl className="sm:divide-y sm:divide-gray-200 dark:sm:divide-gray-700">
            <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-5 sm:px-6">
               <dt className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">Status</dt>
               <dd className="mt-1 text-sm sm:col-span-2 sm:mt-0">
                <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${statusStyle}`}>
                  {job.status}
                </span>
               </dd>
            </div>
            {/* Add other job details here in a similar dl/dt/dd format */}
         </dl>
      </div>
    </div>
  );
}

export default JobDetail;
