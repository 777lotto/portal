// frontend/src/components/JobOrQuoteDetail.tsx
import { useParams, Navigate } from 'react-router-dom';
import useSWR from 'swr';
import { apiGet } from '../lib/api';
import type { Job } from '@portal/shared';
import JobDetail from './JobDetail';

function JobOrQuoteDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: job, error } = useSWR<Job>(id ? `/api/jobs/${id}` : null, apiGet);

  if (error) return <div className="rounded-md bg-red-100 p-4 text-sm text-red-700">Failed to load job details.</div>;
  if (!job) return <div className="text-center p-8">Loading...</div>;

  if (job.status.startsWith('quote_') || job.status === 'pending_quote' || job.status === 'finalized_quote') {
    return <Navigate to={`/quotes/${job.id}`} replace />;
  }

  return <JobDetail />;
}

export default JobOrQuoteDetail;
