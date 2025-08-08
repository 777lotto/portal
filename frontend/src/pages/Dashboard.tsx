// frontend/src/pages/Dashboard.tsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getProfile, getJobs } from '../lib/api';
import type { User, Job } from '@portal/shared';

/**
 * Renders the dashboard for a regular customer.
 * It displays an agenda of actionable items (quotes, jobs, invoices)
 * and a history of completed jobs.
 */
function CustomerDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [upcomingJobs, setUpcomingJobs] = useState<Job[]>([]);
  const [openInvoices, setOpenInvoices] = useState<Job[]>([]);
  const [pendingQuotes, setPendingQuotes] = useState<Job[]>([]);
  const [completedJobs, setCompletedJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch the user's profile
        const profileData = await getProfile();
        setUser(profileData);

        // Fetch all jobs for the logged-in customer
        const allJobs = await getJobs();

        // Categorize all fetched jobs based on their status
        setUpcomingJobs(allJobs.filter(j => j.status === 'upcoming'));
        setPendingQuotes(allJobs.filter(j => j.status === 'pending'));
        setOpenInvoices(allJobs.filter(j => j.status === 'payment_needed'));
        setCompletedJobs(allJobs.filter(j => j.status === 'complete'));

      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    loadDashboard();
  }, []);

  if (isLoading) return <div className="text-center p-8">Loading dashboard...</div>;
  if (error) return <div className="rounded-md bg-red-500/10 p-4 text-sm text-red-500">{error}</div>;

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6">
      <header className="flex justify-between items-center mb-6">
        {user && <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Welcome, {user.name}!</h1>}
      </header>

      {/* Actionable Items Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {/* Upcoming Jobs Card */}
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Upcoming Jobs</h3>
          <div className="space-y-3">
            {upcomingJobs.length > 0 ? (
              upcomingJobs.map(job => (
                <Link key={job.id} to={`/jobs/${job.id}`} className="block p-3 rounded-md transition text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                  {job.title} - {new Date(job.createdAt).toLocaleDateString()}
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
                <Link key={quote.id} to={`/quotes/${quote.id}`} className="block p-3 rounded-md transition text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                  {quote.title} - <span className="font-bold text-blue-600 dark:text-blue-400">Action Required</span>
                </Link>
              ))
            ) : <p className="text-gray-500 dark:text-gray-400">No pending quotes.</p>}
          </div>
        </div>

        {/* Open Invoices Card */}
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Open Invoices</h3>
          <div className="space-y-3">
            {openInvoices.length > 0 ? (
              openInvoices.map(job => (
                <Link key={job.id} to={`/pay-invoice/${job.stripe_invoice_id}`} className="block p-3 rounded-md transition hover:bg-gray-100 dark:hover:bg-gray-700">
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-800 dark:text-gray-200">{job.title}</span>
                    <span className="font-semibold text-green-600 dark:text-green-400">${((job.total_amount_cents || 0) / 100).toFixed(2)}</span>
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {job.due && `Due: ${new Date(job.due).toLocaleDateString()}`}
                  </div>
                </Link>
              ))
            ) : <p className="text-gray-500 dark:text-gray-400">No open invoices.</p>}
          </div>
        </div>
      </div>

      {/* Job History Section */}
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Job History</h3>
        <div className="space-y-2">
          {completedJobs.length > 0 ? (
            completedJobs.map(job => (
              <Link key={job.id} to={`/jobs/${job.id}`} className="block p-3 rounded-md transition text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                {job.title} - Completed on {new Date(job.updatedAt).toLocaleDateString()}
              </Link>
            ))
          ) : <p className="text-gray-500 dark:text-gray-400">No previous jobs.</p>}
        </div>
      </div>
    </div>
  );
}

export default CustomerDashboard;
