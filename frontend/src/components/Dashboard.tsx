// 777lotto/portal/portal-bet/frontend/src/components/Dashboard.tsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getProfile, getJobs, getOpenInvoices, adminGetAllJobs, adminGetAllOpenInvoices } from '../lib/api.js';
import type { User, Job, DashboardInvoice } from '@portal/shared';

function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [upcomingJobs, setUpcomingJobs] = useState<Job[]>([]);
  const [openInvoices, setOpenInvoices] = useState<DashboardInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setIsLoading(true);
        setError(null);
        // MODIFICATION: Logic now splits based on user role
        const profileData = await getProfile();
        setUser(profileData);

        if (profileData.role === 'admin') {
          const [jobsData, invoicesData] = await Promise.all([
            adminGetAllJobs(),
            adminGetAllOpenInvoices(),
          ]);
          setUpcomingJobs(jobsData.filter((j: Job) => new Date(j.start) > new Date()).slice(0, 10)); // Show more for admin
          setOpenInvoices(invoicesData);
        } else {
          // Existing customer logic
          const [jobsData, invoicesData] = await Promise.all([
            getJobs(),
            getOpenInvoices(),
          ]);
          setUpcomingJobs(jobsData.filter((j: Job) => new Date(j.start) > new Date()).slice(0, 5));
          setOpenInvoices(invoicesData);
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

  return (
    <div className="mx-auto max-w-7xl">
      <header>
        {user && <h1 className="text-3xl font-bold tracking-tight text-text-primary-light dark:text-text-primary-dark mb-6">Welcome, {user.name}!</h1>}
      </header>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Upcoming Jobs Card */}
        <div className="bg-primary-light dark:bg-tertiary-dark shadow-sm rounded-lg p-6 border border-border-light dark:border-border-dark">
          {/* MODIFICATION: Dynamic title */}
          <h3 className="text-xl font-semibold mb-4 text-text-primary-light dark:text-text-primary-dark">
            {user?.role === 'admin' ? "All Upcoming Jobs" : "Your Upcoming Jobs"}
          </h3>
          <div className="space-y-3">
            {upcomingJobs.length > 0 ? (
              upcomingJobs.map(job => (
                <Link key={job.id} to={`/jobs/${job.id}`} className="block p-3 rounded-md transition text-text-secondary-light dark:text-text-secondary-dark hover:bg-secondary-light dark:hover:bg-secondary-dark">
                  {job.title} - {new Date(job.start).toLocaleString()}
                </Link>
              ))
            ) : <p className="text-text-secondary-light dark:text-text-secondary-dark">No upcoming jobs.</p>}
          </div>
        </div>
        {/* Open Invoices Card */}
         <div className="bg-primary-light dark:bg-tertiary-dark shadow-sm rounded-lg p-6 border border-border-light dark:border-border-dark">
           <h3 className="text-xl font-semibold mb-4 text-text-primary-light dark:text-text-primary-dark">
            {user?.role === 'admin' ? "All Open Invoices" : "Your Open Invoices"}
           </h3>
           <div className="space-y-3">
            {openInvoices.length > 0 ? (
              openInvoices.map(invoice => {
                const invoiceLink = user?.role === 'admin' && invoice.userId
                  ? `/admin/users/${invoice.userId}`
                  : invoice.hosted_invoice_url;

                const linkProps = user?.role === 'customer'
                  ? { href: invoiceLink, target: "_blank", rel: "noopener noreferrer" }
                  : { to: invoiceLink };

                const Component = user?.role === 'admin' ? Link : 'a';

                return (
                  <div key={invoice.id} className="flex justify-between items-center p-3 rounded-md transition hover:bg-secondary-light dark:hover:bg-secondary-dark">
                    <Component {...linkProps} className="flex-grow">
                      <div className="flex justify-between">
                        <span>
                          {user?.role === 'admin' && invoice.customerName ? `${invoice.customerName} - ` : ''}
                          Invoice #{invoice.number}
                        </span>
                        <span className="font-semibold">${((invoice.total || 0) / 100).toFixed(2)}</span>
                      </div>
                      {invoice.due_date && <small className="text-text-secondary-light dark:text-text-secondary-dark">Due: {new Date(invoice.due_date * 1000).toLocaleDateString()}</small>}
                    </Component>
                    {user?.role === 'customer' && invoice.hosted_invoice_url && (
                      <a
                        href={`${invoice.hosted_invoice_url}/pdf`}
                        download
                        className="btn btn-secondary ml-4"
                      >
                        Download PDF
                      </a>
                    )}
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
