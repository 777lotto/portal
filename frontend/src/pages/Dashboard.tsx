// frontend/src/pages/Dashboard.tsx
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import type { User, Job, DashboardInvoice, Quote, Draft } from '@portal/shared';
import { useAuth } from '../hooks/useAuth';
import { handleApiError } from '../lib/utils';

// --- REFACTORED: Data Fetching Functions ---

const fetchDashboardData = async (user: User | null) => {
  if (!user) throw new Error("User not authenticated");

  const endpoints: Promise<any>[] = [
    api.quotes.pending.$get(),
    user.role === 'admin' ? api.admin.jobs.$get() : api.jobs.$get(),
    user.role === 'admin' ? api.admin.invoices.open.$get() : api.invoices.open.$get(),
  ];

  if (user.role === 'admin') {
    endpoints.push(api.admin.drafts.$get());
  }

  const results = await Promise.all(endpoints);

  for (const res of results) {
    if (!res.ok) throw await handleApiError(res, 'Failed to load dashboard data');
  }

  const [quotesRes, jobsRes, invoicesRes, draftsRes] = results;

  const quotesData = await quotesRes.json();
  const jobsData = await jobsRes.json();
  const invoicesData = await invoicesRes.json();
  const draftsData = user.role === 'admin' ? await draftsRes.json() : { drafts: [] };

  return {
    pendingQuotes: quotesData.quotes as Quote[],
    upcomingJobs: (user.role === 'admin' ? jobsData.jobs as Job[] : jobsData.jobs as Job[]).filter(j => j.status !== 'pending' && j.status !== 'draft').slice(0, 10),
    openInvoices: invoicesData.invoices as DashboardInvoice[],
    drafts: draftsData.drafts as Draft[],
  };
};

function Dashboard() {
  const { user } = useAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard', user?.id],
    queryFn: () => fetchDashboardData(user),
    enabled: !!user,
  });

  const downloadPdfMutation = useMutation({
    mutationFn: async ({ invoiceId, invoiceNumber }: { invoiceId: string, invoiceNumber: string | null }) => {
      const res = await api.invoices[':invoiceId'].pdf.$get({ param: { invoiceId } });
      if (!res.ok) throw await handleApiError(res, 'Failed to download invoice.');
      return { blob: await res.blob(), name: `invoice-${invoiceNumber || invoiceId}.pdf` };
    },
    onSuccess: ({ blob, name }) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    },
    onError: (err: Error) => {
      // Ideally, use a toast notification here
      alert(err.message);
    }
  });

  if (isLoading || !user) return <div className="text-center p-8">Loading dashboard...</div>;
  if (error) return <div className="rounded-md bg-red-500/10 p-4 text-sm text-red-500">{(error as Error).message}</div>;

  const { upcomingJobs, pendingQuotes, openInvoices, drafts } = data || {};

  return (
    <div className="mx-auto max-w-7xl">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-text-primary-light dark:text-text-primary-dark">Welcome, {user.name}!</h1>
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
            {upcomingJobs && upcomingJobs.length > 0 ? (
              upcomingJobs.map(job => (
                <Link key={job.id} to={`/jobs/${job.id}`} className="block p-3 rounded-md transition text-text-secondary-light dark:text-text-secondary-dark hover:bg-secondary-light dark:hover:bg-secondary-dark">
                  {job.job_title} - {new Date(job.job_start_time).toLocaleString()}
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
                {pendingQuotes && pendingQuotes.length > 0 ? (
                    pendingQuotes.map(quote => (
                        <Link key={quote.id} to={`/quotes/${quote.id}`} className="block p-3 rounded-md transition text-text-secondary-light dark:text-text-secondary-dark hover:bg-secondary-light dark:hover:bg-secondary-dark">
                            {user?.role === 'admin' && `${quote.customerName} - `}
                            {quote.job_title} - {quote.status === 'pending_quote' ? 'Awaiting your approval' : 'Pending admin review'}
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
              {drafts && drafts.length > 0 ? (
                drafts.map(draft => (
                  <Link key={draft.id} to={`/jobs/${draft.id}`} className="block p-3 rounded-md transition text-text-secondary-light dark:text-text-secondary-dark hover:bg-secondary-light dark:hover:bg-secondary-dark">
                    {`${draft.customerName} - `}
                    {draft.job_title} - {draft.status}
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
            {openInvoices && openInvoices.length > 0 ? (
              openInvoices.map(invoice => {
                const invoiceLink = user?.role === 'admin'
                  ? `/admin/jobs/${invoice.job_id}`
                  : `/pay-invoice/${invoice.id}`;

                return (
                  <div key={invoice.id} className="flex justify-between items-center p-3 rounded-md transition hover:bg-secondary-light dark:hover:bg-secondary-dark">
                    <Link to={invoiceLink} className="flex-grow">
                      <div className="flex justify-between">
                        <span>
                          {user?.role === 'admin' && invoice.customerName ? `${invoice.customerName} - ` : ''}
                          Invoice #{invoice.invoice_number}
                        </span>
                        <span className="font-semibold">${((invoice.total_amount_cents || 0) / 100).toFixed(2)}</span>
                      </div>
                      {invoice.due_date && <small className="text-text-secondary-light dark:text-text-secondary-dark">Due: {new Date(invoice.due_date).toLocaleDateString()}</small>}
                    </Link>
                    {user?.role !== 'admin' && (
                      <button
                        onClick={() => downloadPdfMutation.mutate({ invoiceId: invoice.id, invoiceNumber: invoice.invoice_number })}
                        className="btn btn-secondary ml-4"
                        disabled={downloadPdfMutation.isPending}
                      >
                        {downloadPdfMutation.isPending ? 'Downloading...' : 'Download PDF'}
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
