// frontend/src/pages/admin/UserJobsPage.tsx
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { JobWithDetails } from '@portal/shared';

const fetchUserJobs = ({ queryKey }: { queryKey: [string, string | undefined] }) => {
    const [_key, userId] = queryKey;
    if (!userId) throw new Error('User ID is required');
    return api.admin.jobs.user[':user_id'].$get({ param: { user_id: userId } });
};

const UserJobsPage = () => {
  const { user_id } = useParams<{ user_id: string }>();
  const { data: jobs, isLoading, error } = useQuery<JobWithDetails[]>({
    queryKey: ['userJobs', user_id],
    queryFn: fetchUserJobs,
    enabled: !!user_id,
  });

  if (isLoading) return <div>Loading jobs...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Jobs for User</h1>
      <pre>{JSON.stringify(jobs, null, 2)}</pre>
    </div>
  );
};

export default UserJobsPage;
