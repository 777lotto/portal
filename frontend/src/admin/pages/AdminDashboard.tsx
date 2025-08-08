// frontend/src/admin/pages/AdminDashboard.tsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
// Path updated to reflect the new file location
import { getProfile, adminGetAllJobDetails, adminGetDrafts } from '../../lib/api';
import type { User, JobWithDetails } from '@portal/shared';

/**
 * Renders the dashboard for an admin user.
 * It provides a comprehensive overview of all jobs, quotes, invoices, and drafts
 * across all customers.
 */
function AdminDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [upcomingJobs, setUpcomingJobs] = useState<JobWithDetails[]>([]);
  const [openInvoices, setOpenInvoices] = useState<JobWithDetails[]>([]);
  const [pendingQuotes, setPendingQuotes] = useState<JobWithDetails[]>([]);
  const [drafts, setDrafts] = useState<JobWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const profileData = await getProfile();
        setUser(profileData);

        // Fetch all jobs, quotes, and invoices with full details
        const allJobDetails = await adminGetAllJobDetails();

        // Fetch all drafts separately
        const draftsData = await adminGetDrafts();

        // Categorize all fetched items based on their status
        setUpcomingJobs(allJobDetails.filter(j => j.status === 'upcoming'));
        setPendingQuotes(allJobDetails.filter(j => j.status === 'pending'));
        setOpenInvoices(allJobDetails.filter(j => j.status === 'payment_needed'));
        setDrafts(draftsData); // Drafts come from their own dedicated endpoint

      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    loadDashboard();
  }, []);

  if (isLoading) return <div className="text-center p-8">Loading admin dashboard...</div>;
  if (error) return <div className="rounded-md bg-red-500/10 p-4 text-sm text-red-500">{error}</div>;

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6">
      <header className="flex justify-between items-center mb-6">
        {user && <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Admin Dashboard</h1>}
      </header>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Upcoming Jobs Card */}
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Upcoming Jobs</h3>
          <div className="space-y-3">
            {upcomingJobs.length > 0 ? (
              upcomingJobs.map(job => (
                <Link key={job.id} to={`/admin/jobs/${job.id}`} className="block p-3 rounded-md transition text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                  {job.customerName} - {job.title}
                </Link>
              ))
            ) : <p className="text-gray-500 dark:text-gray-400">No upcoming jobs.</p>}
          </div>
        </div>

        {/* Pending Quotes Card */}
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Pending Quotes</h3>
          <div className="space-y-3">
            {pendingQuotes.length > 0 ? (
              pendingQuotes.map(quote => (
                <Link key={quote.id} to={`/admin/jobs/${quote.id}`} className="block p-3 rounded-md transition text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                  {quote.customerName} - {quote.title}
                </Link>
              ))
            ) : <p className="text-gray-500 dark:text-gray-400">No pending quotes.</p>}
          </div>
        </div>

        {/* Drafts Card */}
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Drafts</h3>
          <div className="space-y-3">
            {drafts.length > 0 ? (
              drafts.map(draft => (
                <Link key={draft.id} to={`/admin/jobs/${draft.id}`} className="block p-3 rounded-md transition text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                  {draft.customerName} - {draft.title} <span className="text-sm capitalize text-yellow-600">({draft.status.replace(/_/g, ' ')})</span>
                </Link>
              ))
            ) : <p className="text-gray-500 dark:text-gray-400">No drafts.</p>}
          </div>
        </div>

        {/* Open Invoices Card */}
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Open Invoices</h3>
          <div className="space-y-3">
            {openInvoices.length > 0 ? (
              openInvoices.map(job => (
                <Link key={job.id} to={`/admin/jobs/${job.id}`} className="block p-3 rounded-md transition hover:bg-gray-100 dark:hover:bg-gray-700">
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-800 dark:text-gray-200">{job.customerName} - {job.title}</span>
                    <span className="font-semibold text-green-600 dark:text-green-400">${((job.total_amount_cents || 0) / 100).toFixed(2)}</span>
                  </div>
                </Link>
              ))
            ) : <p className="text-gray-500 dark:text-gray-400">No open invoices.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
