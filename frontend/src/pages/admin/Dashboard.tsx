// frontend/src/pages/admin/Dashboard.tsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { adminGetJobsAndQuotes } from '../../lib/api';
import type { JobWithDetails } from '@portal/shared';

/**
 * AdminDashboard component displays an overview for admin users, including
 * upcoming jobs, open invoices, pending quotes, and drafts.
 */
function AdminDashboard() {
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

        // Fetch all jobs, quotes, and drafts for the admin view.
        const allJobs = await adminGetJobsAndQuotes();

        // Categorize jobs based on their status.
        const upcoming = allJobs.filter(job => job.status === 'confirmed' && new Date(job.start_time) > new Date());
        const invoices = allJobs.filter(job => job.status === 'invoiced' || job.status === 'past_due');
        const quotes = allJobs.filter(job => job.status === 'quoted');
        const jobDrafts = allJobs.filter(job => job.status === 'draft');

        // Sort upcoming jobs by start time and update state.
        setUpcomingJobs(upcoming.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()));
        setOpenInvoices(invoices);
        setPendingQuotes(quotes);
        setDrafts(jobDrafts);

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred.';
        setError(errorMessage);
        console.error("Failed to load admin dashboard:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboard();
  }, []);

  if (isLoading) {
    return <div className="text-center p-8">Loading dashboard...</div>;
  }

  if (error) {
    return <div className="text-center p-8 text-red-500">Error loading dashboard: {error}</div>;
  }

  return (
    <div className="p-4 md:p-8 bg-background-light dark:bg-background-dark text-text-primary-light dark:text-text-primary-dark min-h-screen">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
        {/* Upcoming Jobs Section */}
        <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Upcoming Jobs</h2>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {upcomingJobs.length > 0 ? (
              upcomingJobs.map(job => (
                <div key={job.id} className="flex justify-between items-center p-3 rounded-md transition hover:bg-secondary-light dark:hover:bg-secondary-dark">
                  <Link to={`/jobs/${job.id}`} className="flex-grow">
                    <div className="flex justify-between">
                      <span className="font-medium">{job.customerName} - {job.title}</span>
                      <span className="font-semibold">${((job.total_amount_cents || 0) / 100).toFixed(2)}</span>
                    </div>
                    <div className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                      {new Date(job.start_time).toLocaleString()}
                    </div>
                  </Link>
                </div>
              ))
            ) : <p className="text-text-secondary-light dark:text-text-secondary-dark">No upcoming jobs.</p>}
          </div>
        </div>

        {/* Open Invoices Section */}
        <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Open Invoices</h2>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {openInvoices.length > 0 ? (
              openInvoices.map(job => (
                <div key={job.id} className="flex justify-between items-center p-3 rounded-md transition hover:bg-secondary-light dark:hover:bg-secondary-dark">
                  <Link to={`/jobs/${job.id}`} className="flex-grow">
                    <div className="flex justify-between">
                      <span className="font-medium">{job.customerName} - {job.title}</span>
                      <span className="font-semibold">${((job.total_amount_cents || 0) / 100).toFixed(2)}</span>
                    </div>
                    <div className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                      {job.stripe_invoice_id && `Invoice #${job.stripe_invoice_id.substring(3)}`}
                      {job.due && ` - Due: ${new Date(job.due).toLocaleDateString()}`}
                    </div>
                  </Link>
                </div>
              ))
            ) : <p className="text-text-secondary-light dark:text-text-secondary-dark">No open invoices.</p>}
          </div>
        </div>

        {/* Pending Quotes Section */}
        <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Pending Quotes</h2>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {pendingQuotes.length > 0 ? (
              pendingQuotes.map(job => (
                <div key={job.id} className="flex justify-between items-center p-3 rounded-md transition hover:bg-secondary-light dark:hover:bg-secondary-dark">
                  <Link to={`/jobs/${job.id}`} className="flex-grow">
                    <div className="flex justify-between">
                      <span className="font-medium">{job.customerName} - {job.title}</span>
                      <span className="font-semibold">${((job.total_amount_cents || 0) / 100).toFixed(2)}</span>
                    </div>
                  </Link>
                </div>
              ))
            ) : <p className="text-text-secondary-light dark:text-text-secondary-dark">No pending quotes.</p>}
          </div>
        </div>

        {/* Drafts Section */}
        <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Drafts</h2>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {drafts.length > 0 ? (
              drafts.map(job => (
                <div key={job.id} className="flex justify-between items-center p-3 rounded-md transition hover:bg-secondary-light dark:hover:bg-secondary-dark">
                  <Link to={`/jobs/${job.id}`} className="flex-grow">
                     <div className="flex justify-between">
                        <span className="font-medium">{job.customerName} - {job.title}</span>
                        <span className="font-semibold">${((job.total_amount_cents || 0) / 100).toFixed(2)}</span>
                      </div>
                  </Link>
                </div>
              ))
            ) : <p className="text-text-secondary-light dark:text-text-secondary-dark">No drafts.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
