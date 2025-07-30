import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiGet, adminCreateJob, adminImportInvoicesForUser } from '../../lib/api';
import type { User, StripeInvoice } from '@portal/shared';
import { InvoiceEditor } from './InvoiceEditor';

type Message = { type: 'success' | 'danger'; text: string; };

export function AdminUserDetail() {
  const { user_id } = useParams<{ user_id: string }>();
  const [user, setUser] = useState<User | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeInvoice, setActiveInvoice] = useState<StripeInvoice | null>(null);

  const fetchData = useCallback(async () => {
    if (!user_id) return;
    try {
      // We only need to fetch the user's primary data now.
      const userData = await apiGet<User>(`/api/admin/users/${user_id}`);
      setUser(userData);
    } catch (err: any)      {
      setMessage({ type: 'danger', text: `Failed to fetch user data: ${err.message}` });
    }
  }, [user_id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // This function can remain as it's a primary action for this page.
  const handleCreateInvoiceClick = async () => {
    if (!user_id) return;
    if (!window.confirm("Are you sure you want to create a new draft invoice for this user?")) {
        return;
    }
    setMessage(null);
    setIsSubmitting(true);
    try {
        const { job } = await adminCreateJob({
            user_id: user_id,
            jobType: 'invoice',
            title: `Draft Invoice - ${new Date().toLocaleDateString()}`,
            start: new Date().toISOString(),
            services: [], // A draft invoice starts with no line items
            isDraft: true,
        });
        setMessage({ type: 'success', text: `Draft invoice created successfully! You can now add line items. Associated Job ID: ${job.id}` });
        fetchData();
    } catch (err: any) {
        setMessage({ type: 'danger', text: `Failed to create invoice: ${err.message}` });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleImportInvoices = async () => {
    if (!user_id) return;
    setIsSubmitting(true);
    try {
        await adminImportInvoicesForUser(user_id);
        setMessage({ type: 'success', text: 'Invoices imported successfully! Refreshing data...' });
        fetchData();
    } catch (err: any) {
        setMessage({ type: 'danger', text: `Failed to import invoices: ${err.message}` });
    } finally {
        setIsSubmitting(false);
    }
  };

  if (!user) return <div className="p-4">Loading user details...</div>;
  if (activeInvoice) {
    return <InvoiceEditor invoice={activeInvoice} onBack={() => setActiveInvoice(null)} onSave={fetchData} />;
  }

  return (
    <div className="container-fluid p-4">
      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      <div className="card">
        <div className="card-header">
            <h1 className="text-2xl font-bold">{user.company_name || user.name}</h1>
            <p>{user.email} | {user.phone}</p>
            <p>{user.address}</p>
        </div>
        <div className="card-body">
            <div className="d-flex gap-2 mb-3">
                <button className="btn btn-primary" onClick={handleCreateInvoiceClick} disabled={isSubmitting}>
                    {isSubmitting ? 'Creating...' : 'Create New Invoice'}
                </button>
                 <button className="btn btn-secondary" onClick={handleImportInvoices} disabled={isSubmitting}>
                    {isSubmitting ? 'Importing...' : 'Import from Stripe'}
                </button>
            </div>

            <hr />

            {/* --- NEW SECTION WITH LINKS --- */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
              <div className="card bg-light">
                <div className="card-body">
                  <h2 className="card-title">Jobs & Quotes</h2>
                  <p>View, edit, or create new jobs and quotes for this user.</p>
                  <div className="card-actions justify-end">
                    {/* Note: You will need to create a page component for this route */}
                    <Link to={`/admin/users/${user.id}/jobs`} className="btn btn-primary">Manage Jobs</Link>
                  </div>
                </div>
              </div>

              <div className="card bg-light">
                <div className="card-body">
                  <h2 className="card-title">Photos</h2>
                  <p>View or upload photos associated with this user's jobs.</p>
                  <div className="card-actions justify-end">
                    {/* Note: You will need to create a page component for this route */}
                    <Link to={`/admin/users/${user.id}/photos`} className="btn btn-primary">Manage Photos</Link>
                  </div>
                </div>
              </div>

              <div className="card bg-light">
                <div className="card-body">
                  <h2 className="card-title">Notes</h2>
                  <p>View or add internal notes for this user.</p>
                  <div className="card-actions justify-end">
                    {/* Note: You will need to create a page component for this route */}
                    <Link to={`/admin/users/${user.id}/notes`} className="btn btn-primary">Manage Notes</Link>
                  </div>
                </div>
              </div>
            </div>
        </div>
      </div>
    </div>
  );
}
