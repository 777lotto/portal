// frontend/src/pages/admin/UserJobsPage.tsx
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { JobWithDetails } from '@portal/shared';

/**
 * REFACTORED: The data-fetching function for React Query.
 * It now correctly unwraps the enveloped response from the API.
 */
const fetchUserJobs = async (userId: string) => {
    const res = await api.admin.jobs.user[':user_id'].$get({ param: { user_id: userId } });
    if (!res.ok) {
        throw new Error('Failed to fetch user jobs');
    }
    const data = await res.json();
    return data.jobs;
};

/**
 * REFACTORED: The page now displays jobs in a structured table.
 * This replaces the previous JSON view for better readability and usability.
 */
const UserJobsPage = () => {
  const { user_id } = useParams<{ user_id: string }>();
  const { data: jobs, isLoading, error } = useQuery<JobWithDetails[]>({
    queryKey: ['userJobs', user_id],
    queryFn: () => fetchUserJobs(user_id!),
    enabled: !!user_id,
  });

  if (isLoading) return <div>Loading jobs...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Jobs for User</h1>
      <div className="overflow-x-auto">
        <table className="table w-full">
          <thead>
            <tr>
              <th>Job Title</th>
              <th>Status</th>
              <th>Created At</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {jobs?.map((job) => (
              <tr key={job.id} className="hover">
                <td>{job.job_title}</td>
                <td><span className="badge badge-ghost badge-sm">{job.status}</span></td>
                <td>{new Date(job.createdAt).toLocaleDateString()}</td>
                <td className="text-right">
                  <Link to={`/admin/jobs/${job.id}`} className="btn btn-primary btn-sm">
                    View Details
                  </Link>
                </td>
              </tr>
            ))}
            {jobs?.length === 0 && (
                <tr>
                    <td colSpan={4} className="text-center">No jobs found for this user.</td>
                </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UserJobsPage;
