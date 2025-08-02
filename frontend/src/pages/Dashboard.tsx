// frontend/src/pages/Dashboard.tsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import type { User, Job, DashboardInvoice } from '@portal/shared';
import { HTTPException } from 'hono/http-exception'; // Import Hono's error class

function Dashboard() {
  // State hooks remain the same
  const [user, setUser] = useState<User | null>(null);
  const [upcomingJobs, setUpcomingJobs] = useState<Job[]>([]);
  const [openInvoices, setOpenInvoices] = useState<DashboardInvoice[]>([]);
  const [pendingQuotes, setPendingQuotes] = useState<Job[]>([]);
  const [drafts, setDrafts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null);

  // The handleDownloadPdf function can be simplified slightly, as we don't need ApiError
  const handleDownloadPdf = async (invoiceId: string, invoiceNumber: string | null) => {
    setDownloadingInvoiceId(invoiceId);
    setError(null);
    try {
      // The Hono client isn't used for file blobs, so direct fetch is correct here.
      // We add the auth token manually.
      const response = await fetch(`/api/invoices/${invoiceId}/pdf`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem("token")}` }
      });

      if (!response.ok) {
        // We can get a more specific error message from the response if available
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to download invoice. Please try again.`);
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

        // --- REFACTORED DATA FETCHING ---
        // The Hono client (`api`) automatically handles parsing JSON and throwing
        // an `HTTPException` on failure. The `fetchAndParse` helper is no longer needed.

        const profileData = await api.profile.$get();
        setUser(profileData);

        const quotesData = await api.quotes.pending.$get();
        setPendingQuotes(quotesData);

        if (profileData.role === 'admin') {
          const [jobsData, invoicesData, draftsData] = await Promise.all([
            api.admin.jobs.$get(),
            api.admin.invoices.open.$get(),
            api.admin.drafts.$get(),
          ]);
          setUpcomingJobs(jobsData.filter(j => j.status !== 'pending' && j.status !== 'draft').slice(0, 10));
          setOpenInvoices(invoicesData);
          setDrafts(draftsData);
        } else {
          const [jobsData, invoicesData] = await Promise.all([
            api.jobs.$get(),
            api.invoices.open.$get(),
          ]);
          setUpcomingJobs(jobsData.filter(j => j.status !== 'pending' && j.status !== 'draft').slice(0, 5));
          setOpenInvoices(invoicesData);
        }

      } catch (err: any) {
        // --- REFACTORED ERROR HANDLING ---
        if (err instanceof HTTPException) {
          // If it's an HTTPException from Hono, we can get the error message from the response body
          const errorJson = await err.response.json();
          setError(errorJson.error || 'An error occurred.');
        } else {
          // For any other type of error
          setError(err.message);
        }
      } finally {
        setIsLoading(false);
      }
    };
    loadDashboard();
  }, []);

  // The JSX part of the component remains unchanged
  if (isLoading) return <div className="text-center p-8">Loading dashboard...</div>;
  if (error) return <div className="rounded-md bg-red-500/10 p-4 text-sm text-red-500">{error}</div>;

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
      {/* ... rest of the JSX is the same ... */}
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
                    {user?.role !== 'admin' && (
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
