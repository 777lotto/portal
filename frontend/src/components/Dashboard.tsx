// 777lotto/portal/portal-fold/frontend/src/components/Dashboard.tsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getProfile, getJobs, getOpenInvoices, adminGetAllJobs, adminGetAllOpenInvoices, getPendingQuotes } from '../lib/api.js';
import type { User, Job, DashboardInvoice } from '@portal/shared';

function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [upcomingJobs, setUpcomingJobs] = useState<Job[]>([]);
  const [openInvoices, setOpenInvoices] = useState<DashboardInvoice[]>([]);
  const [pendingQuotes, setPendingQuotes] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null);


  const handleDownloadPdf = async (invoiceId: string, invoiceNumber: string | null) => {
    setDownloadingInvoiceId(invoiceId);
    setError(null);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/invoices/${invoiceId}/pdf`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to download invoice. Please try again.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${invoiceNumber || invoiceId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDownloadingInvoiceId(null);
    }
  };


  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const profileData = await getProfile();
        setUser(profileData);

        const [quotesData] = await Promise.all([
            getPendingQuotes()
        ]);
        setPendingQuotes(quotesData);

        if (profileData.role === 'admin') {
          const [jobsData, invoicesData] = await Promise.all([
            adminGetAllJobs(),
            adminGetAllOpenInvoices(),
          ]);
          setUpcomingJobs(jobsData.slice(0, 10));
          setOpenInvoices(invoicesData);
        } else {
          const [jobsData, invoicesData] = await Promise.all([
            getJobs(),
            getOpenInvoices(),
          ]);
          setUpcomingJobs(jobsData.slice(0, 5));
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
      <header className="flex justify-between items-center mb-6">
        {user && <h1 className="text-3xl font-bold tracking-tight text-text-primary-light dark:text-text-primary-dark">Welcome, {user.name}!</h1>}
        {user?.role !== 'admin' && (
          <Link to="/schedule" className="btn btn-primary">
            Schedule Next Service
          </Link>
        )}
      </header>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Upcoming Jobs Card */}
        <div className="bg-primary-light dark:bg-tertiary-dark shadow-sm rounded-lg p-6 border border-border-light dark:border-border-dark">
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

        {/* Pending Quotes Card */}
        <div className="bg-primary-light dark:bg-tertiary-dark shadow-sm rounded-lg p-6 border border-border-light dark:border-border-dark">
            <h3 className="text-xl font-semibold mb-4 text-text-primary-light dark:text-text-primary-dark">
                Pending Quotes
            </h3>
            <div className="space-y-3">
                {pendingQuotes.length > 0 ? (
                    pendingQuotes.map(quote => (
                        <Link key={quote.id} to={`/jobs/${quote.id}`} className="block p-3 rounded-md transition text-text-secondary-light dark:text-text-secondary-dark hover:bg-secondary-light dark:hover:bg-secondary-dark">
                            {user?.role === 'admin' && `${(quote as any).customerName} - `}
                            {quote.title} - {quote.status === 'pending_quote' ? 'Awaiting your approval' : 'Pending admin review'}
                        </Link>
                    ))
                ) : <p className="text-text-secondary-light dark:text-text-secondary-dark">No pending quotes.</p>}
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
                // --- MODIFICATION START ---
                // Determine the correct link based on user role.
                const invoiceLink = user?.role === 'admin'
                  ? `/admin/users/${invoice.userId}` // Admins go to the user detail page
                  : `/pay-invoice/${invoice.id}`;     // Customers go to the internal payment page

                // Both admins and customers will use the internal Link component.
                const linkProps = { to: invoiceLink };
                // --- MODIFICATION END ---

                return (
                  <div key={invoice.id} className="flex justify-between items-center p-3 rounded-md transition hover:bg-secondary-light dark:hover:bg-secondary-dark">
                    <Link {...linkProps} className="flex-grow">
                      <div className="flex justify-between">
                        <span>
                          {user?.role === 'admin' && invoice.customerName ? `${invoice.customerName} - ` : ''}
                          Invoice #{invoice.number}
                        </span>
                        <span className="font-semibold">${((invoice.total || 0) / 100).toFixed(2)}</span>
                      </div>
                      {invoice.due_date && <small className="text-text-secondary-light dark:text-text-secondary-dark">Due: {new Date(invoice.due_date * 1000).toLocaleDateString()}</small>}
                    </Link>
                    {user?.role === 'customer' && (
                      <button
                        onClick={() => handleDownloadPdf(invoice.id, invoice.number)}
                        className="btn btn-secondary ml-4"
                        disabled={downloadingInvoiceId === invoice.id}
                      >
                        {downloadingInvoiceId === invoice.id ? 'Downloading...' : 'Download PDF'}
                      </button>
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
