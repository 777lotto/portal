// /pages/admin/UserJobsPage.tsx

import { useRouter } from 'next/router';
import { useQuery } from 'react-query';
import JobsAndQuotesTable from './JobsAndQuotesTable';
import { API } from '../../lib/api';

const UserJobs = () => {
  const router = useRouter();
  const { id } = router.query;

  // --- UPDATED API ENDPOINT ---
  const { data: jobs, isLoading } = useQuery(['userJobs', id], () =>
    API.get(`/admin/jobs/user/${id}`)
  );

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h1>User Jobs</h1>
      <JobsAndQuotesTable jobs={jobs} />
    </div>
  );
};

export default UserJobs;
