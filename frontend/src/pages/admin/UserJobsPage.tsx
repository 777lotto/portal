import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { adminGetUserJobs } from '../../lib/api';
import { Job } from '@portal/shared';

function UserJobsPage() {
  const { userId } = useParams<{ userId: string }>();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userId) {
      const fetchJobs = async () => {
        try {
          setIsLoading(true);
          const userJobs = await adminGetUserJobs(userId);
          setJobs(userJobs);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'An unknown error occurred.');
        } finally {
          setIsLoading(false);
        }
      };
      fetchJobs();
    }
  }, [userId]);

  if (isLoading) {
    return <div className="text-center p-4">Loading jobs...</div>;
  }

  if (error) {
    return <div className="text-center p-4 text-red-500">Error: {error}</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Jobs for User {userId}</h1>
      <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg">
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {jobs.length > 0 ? (
            jobs.map(job => (
              <li key={job.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700">
                <Link to={`/jobs/${job.id}`} className="block">
                  <div className="flex justify-between">
                    <span className="font-semibold">{job.title}</span>
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      job.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                      job.status === 'invoiced' ? 'bg-blue-100 text-blue-800' :
                      job.status === 'quoted' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {job.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {new Date(job.start_time).toLocaleString()}
                  </p>
                </Link>
              </li>
            ))
          ) : (
            <p className="p-4 text-center text-gray-500">No jobs found for this user.</p>
          )}
        </ul>
      </div>
    </div>
  );
}

export default UserJobsPage;
