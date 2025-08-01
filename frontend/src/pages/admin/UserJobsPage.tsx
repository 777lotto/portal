// frontend/src/pages/admin/UserJobsPage.tsx
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
// Import the new 'api' client.
import { api } from '../../lib/api';
import type { JobWithDetails } from '@portal/shared';
// NOTE: Assuming JobsAndQuotesTable is a component you have.
// import JobsAndQuotesTable from './JobsAndQuotesTable';

// --- React Query Fetcher ---
const fetchUserJobs = async (userId: string) => {
    const res = await api.admin.jobs.user[':user_id'].$get({ param: { user_id: userId } });
    if (!res.ok) throw new Error('Failed to fetch user jobs');
    return res.json();
};

const UserJobsPage = () => {
  const { user_id } = useParams<{ user_id: string }>();

  // --- UPDATED ---
  const { data: jobs, isLoading, error } = useQuery<JobWithDetails[]>({
    queryKey: ['userJobs', user_id],
    queryFn: () => fetchUserJobs(user_id!),
    enabled: !!user_id, // Only run the query if user_id exists
  });
  // --- END UPDATE ---

  if (isLoading) return <div>Loading jobs...</div>;
  if (error) return <div>Error: {(error as Error).message}</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Jobs for User</h1>
      {/* Placeholder for your jobs table component */}
      <pre>{JSON.stringify(jobs, null, 2)}</pre>
      {/* <JobsAndQuotesTable jobs={jobs} /> */}
    </div>
  );
};

export default UserJobsPage;
