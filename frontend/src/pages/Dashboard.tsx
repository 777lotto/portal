// 777lotto/portal/portal-fold/frontend/src/components/Dashboard.tsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getProfile, getJobs, adminGetJobsAndQuotes } from '../lib/api.js';
import type { User, Job, JobWithDetails } from '@portal/shared';

function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [upcomingJobs, setUpcomingJobs] = useState<(Job | JobWithDetails)[]>([]);
  const [openInvoices, setOpenInvoices] = useState<(Job | JobWithDetails)[]>([]);
  const [pendingQuotes, setPendingQuotes] = useState<(Job | JobWithDetails)[]>([]);
  const [drafts, setDrafts] = useState<(Job | JobWithDetails)[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const profileData = await getProfile();
        setUser(profileData);

        let allJobs: (Job | JobWithDetails)[] = [];

        if (profileData.role === 'admin') {
          // Fetches all jobs with customer details included
          allJobs = await adminGetJobsAndQuotes();
        } else {
          // Fetches all jobs for the logged-in customer (uses the updated endpoint)
          allJobs = await getJobs();
        }

        // Categorize all fetched jobs based on their status
        setUpcomingJobs(allJobs.filter(j => j.status === 'upcoming'));
        setPendingQuotes(allJobs.filter(j => j.status === 'pending'));
        setOpenInvoices(allJobs.filter(j => j.status === 'payment_needed'));

        if (profileData.role === 'admin') {
          setDrafts(allJobs.filter(j => j.status === 'quote_draft' || j.status === 'invoice_draft' || j.status === 'job_draft'));
        }

      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    loadDashboard();
  }, []);

  if (isLoading) return <div className="text-center p-8">Loading dashboard...</div>;
  if (error) return <div className="rounded-md bg-event-red/10 p-4 text-sm text-event-red">{error}</div>;

  const getJobLink = (jobId: string) => {
    return user?.role === 'admin' ? `/admin/jobs/${jobId}` : `/jobs/${jobId}`;
  }

  return (
    <div className="mx-auto max-w-7xl">
      <header className="flex justify-between items-center mb-6">
        {user && <h1 className="text-3xl font-bold tracking-tight text-text-primary-light dark:text-text-primary-dark">Welcome, {user.name}!</h1>}
      </header>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Upcoming Jobs Card */}
        <div className="bg-primary-light dark:bg-tertiary-dark shadow-sm rounded-lg p-6 border border-border-light dark:border-border-dark">
          <h3 className="text-xl font-semibold mb-4 text-text-primary-light dark:text-text-primary-dark">
            Upcoming Jobs
          </h3>
          <div className="space-y-3">
            {upcomingJobs.length > 0 ? (
              upcomingJobs.map(job => (
                <Link key={job.id} to={getJobLink(job.id)} className="block p-3 rounded-md transition text-text-secondary-light dark:text-text-secondary-dark hover:bg-secondary-light dark:hover:bg-secondary-dark">
                  {(user?.role === 'admin' && (job as JobWithDetails).customerName) && `${(job as JobWithDetails).customerName} - `}
                  {job.title} - {new Date(job.createdAt).toLocaleString()}
                </Link>
              ))
            ) : <p className="text-text-secondary-light dark:text-text-secondary-dark">No upcoming jobs.</p>}
          </div>
        </div>

        {/* Pending Quotes Card */}
        <div className="bg-primary-light dark:bg-tertiary-dark shadow-sm rounded-lg p-6 border border-border-light dark:border-border-dark">
            <h3 className="text-xl font-semibold mb-4 text-text-primary-light dark:text-text-primary-dark">
                Pending Quotes
            </h3>
          <div className="space-y-3">
            {pendingQuotes.length > 0 ? (
                pendingQuotes.map(quote => {
                  const quoteLink = user?.role === 'admin' ? getJobLink(quote.id) : `/quotes/${quote.id}`;
                  return (
                    <Link key={quote.id} to={quoteLink} className="block p-3 rounded-md transition text-text-secondary-light dark:text-text-secondary-dark hover:bg-secondary-light dark:hover:bg-secondary-dark">
                        {user?.role === 'admin' && (quote as JobWithDetails).customerName ? `${(quote as JobWithDetails).customerName} - ` : ''}
                        {quote.title} - <span className="font-bold">{user?.role === 'admin' ? 'Pending Customer Review' : 'Action Required'}</span>
                    </Link>
                  );
                })
              ) : <p className="text-text-secondary-light dark:text-text-secondary-dark">No pending quotes.</p>}
        </div>
        </div>

        {/* Drafts Card (Admin Only) */}
        {user?.role === 'admin' && (
          <div className="bg-primary-light dark:bg-tertiary-dark shadow-sm rounded-lg p-6 border border-border-light dark:border-border-dark">
            <h3 className="text-xl font-semibold mb-4 text-text-primary-light dark:text-text-primary-dark">
              Drafts
            </h3>
            <div className="space-y-3">
              {drafts.length > 0 ? (
                drafts.map(draft => (
                  <Link key={draft.id} to={`/admin/jobs/${draft.id}`} className="block p-3 rounded-md transition text-text-secondary-light dark:text-text-secondary-dark hover:bg-secondary-light dark:hover:bg-secondary-dark">
                    {(draft as JobWithDetails).customerName && `${(draft as JobWithDetails).customerName} - `}
                    {draft.title} - {draft.status.replace(/_/g, ' ')}
                  </Link>
                ))
              ) : <p className="text-text-secondary-light dark:text-text-secondary-dark">No drafts.</p>}
            </div>
          </div>
        )}

        {/* Open Invoices Card */}
         <div className="bg-primary-light dark:bg-tertiary-dark shadow-sm rounded-lg p-6 border border-border-light dark:border-border-dark">
           <h3 className="text-xl font-semibold mb-4 text-text-primary-light dark:text-text-primary-dark">
            Open Invoices
           </h3>
           <div className="space-y-3">
            {openInvoices.length > 0 ? (
              openInvoices.map(job => {
                const linkPath = user?.role === 'admin' ? `/admin/jobs/${job.id}` : `/pay-invoice/${job.stripe_invoice_id}`;
                return (
                  <div key={job.id} className="flex justify-between items-center p-3 rounded-md transition hover:bg-secondary-light dark:hover:bg-secondary-dark">
                    <Link to={linkPath} className="flex-grow">
                      <div className="flex justify-between">
                        <span className="font-medium">
                          {(user?.role === 'admin' && (job as JobWithDetails).customerName) && `${(job as JobWithDetails).customerName} - `}
                          {job.title}
                        </span>
                        <span className="font-semibold">${((job.total_amount_cents || 0) / 100).toFixed(2)}</span>
                      </div>
                      <div className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                        {job.stripe_invoice_id && `Invoice #${job.stripe_invoice_id.substring(3)}`}
                        {job.due && ` - Due: ${new Date(job.due).toLocaleDateString()}`}
                      </div>
                    </Link>
                  </div>
                )
              })
            ) : <p className="text-text-secondary-light dark:text-text-secondary-dark">No open invoices.</p>}
           </div>
         </div>
       </div>
    </div>
  );
}

export default Dashboard;
