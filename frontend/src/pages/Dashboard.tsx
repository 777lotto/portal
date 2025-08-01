// frontend/src/pages/Dashboard.tsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
// Import the new 'api' client.
import { api } from '../lib/api';
import { ApiError } from '../lib/fetchJson';
import type { User, Job, DashboardInvoice } from '@portal/shared';

// Helper function to handle API responses
async function fetchAndParse<T>(promise: Promise<Response>): Promise<T> {
    const res = await promise;
    if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'An unknown error occurred' }));
        throw new ApiError(errorData.error || `Request failed with status ${res.status}`, res.status);
    }
    return res.json() as Promise<T>;
}

function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [upcomingJobs, setUpcomingJobs] = useState<Job[]>([]);
  const [openInvoices, setOpenInvoices] = useState<DashboardInvoice[]>([]);
  const [pendingQuotes, setPendingQuotes] = useState<Job[]>([]);
  const [drafts, setDrafts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null);


  const handleDownloadPdf = async (invoiceId: string, invoiceNumber: string | null) => {
    setDownloadingInvoiceId(invoiceId);
    setError(null);
    try {
      // --- UPDATED ---
      // This still uses fetch directly because it's handling a blob (file),
      // but we can use our custom fetchJson wrapper which adds the auth header.
      // Note: The custom fetchJson needs to be able to handle non-JSON responses.
      const response = await fetch(`/api/invoices/${invoiceId}/pdf`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem("token")}` }
      });
      // --- END UPDATE ---

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

        // --- UPDATED ---
        const profileData = await fetchAndParse<User>(api.profile.$get());
        setUser(profileData);

        const quotesData = await fetchAndParse<Job[]>(api.quotes.pending.$get());
        setPendingQuotes(quotesData);

        if (profileData.role === 'admin') {
          const [jobsData, invoicesData, draftsData] = await Promise.all([
            fetchAndParse<Job[]>(api.admin.jobs.$get()),
            fetchAndParse<DashboardInvoice[]>(api.admin.invoices.open.$get()),
            fetchAndParse<any[]>(api.admin.drafts.$get()),
          ]);
          setUpcomingJobs(jobsData.filter(j => j.status !== 'pending' && j.status !== 'draft').slice(0, 10));
          setOpenInvoices(invoicesData);
          setDrafts(draftsData);
        } else {
          const [jobsData, invoicesData] = await Promise.all([
            fetchAndParse<Job[]>(api.jobs.$get()),
            fetchAndParse<DashboardInvoice[]>(api.invoices.open.$get()),
          ]);
          setUpcomingJobs(jobsData.filter(j => j.status !== 'pending' && j.status !== 'draft').slice(0, 5));
          setOpenInvoices(invoicesData);
        }
        // --- END UPDATE ---

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
          <Link to="/booking" className="btn btn-primary">
            Schedule Next Service
          </Link>
        )}
      </header>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card p-6">
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

        <div className="card p-6">
            <h3 className="text-xl font-semibold mb-4 text-text-primary-light dark:text-text-primary-dark">
                Pending Quotes
            </h3>
            <div className="space-y-3">
                {pendingQuotes.length > 0 ? (
                    pendingQuotes.map(quote => (
                        <Link key={quote.id} to={`/quotes/${quote.id}`} className="block p-3 rounded-md transition text-text-secondary-light dark:text-text-secondary-dark hover:bg-secondary-light dark:hover:bg-secondary-dark">
                            {user?.role === 'admin' && `${(quote as any).customerName} - `}
                            {quote.title} - {quote.status === 'pending_quote' ? 'Awaiting your approval' : 'Pending admin review'}
                        </Link>
                    ))
                ) : <p className="text-text-secondary-light dark:text-text-secondary-dark">No pending quotes.</p>}
            </div>
        </div>

        {user?.role === 'admin' && (
          <div className="card p-6">
            <h3 className="text-xl font-semibold mb-4 text-text-primary-light dark:text-text-primary-dark">
              Drafts
            </h3>
            <div className="space-y-3">
              {drafts.length > 0 ? (
                drafts.map(draft => (
                  <Link key={draft.id} to={`/jobs/${draft.id}`} className="block p-3 rounded-md transition text-text-secondary-light dark:text-text-secondary-dark hover:bg-secondary-light dark:hover:bg-secondary-dark">
                    {`${draft.customerName} - `}
                    {draft.title} - {draft.status}
                  </Link>
                ))
              ) : <p className="text-text-secondary-light dark:text-text-secondary-dark">No drafts.</p>}
            </div>
          </div>
        )}

         <div className="card p-6">
           <h3 className="text-xl font-semibold mb-4 text-text-primary-light dark:text-text-primary-dark">
            {user?.role === 'admin' ? "All Open Invoices" : "Your Open Invoices"}
           </h3>
           <div className="space-y-3">
            {openInvoices.length > 0 ? (
              openInvoices.map(invoice => {
                const invoiceLink = user?.role === 'admin'
                  ? `/admin/jobs/${(invoice as any).job_id}`
                  : `/pay-invoice/${invoice.id}`;

                return (
                  <div key={invoice.id} className="flex justify-between items-center p-3 rounded-md transition hover:bg-secondary-light dark:hover:bg-secondary-dark">
                    <Link to={invoiceLink} className="flex-grow">
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
