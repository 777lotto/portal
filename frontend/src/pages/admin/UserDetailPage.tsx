import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
// Import the new 'api' client.
import { api } from '../../lib/api';
import { ApiError } from '../../lib/fetchJson';
import type { User, StripeInvoice } from '@portal/shared';
// import { InvoiceEditor } from './InvoiceEditor'; // This component was not provided

type Message = { type: 'success' | 'danger'; text: string; };

export function UserDetailPage() {
  const { user_id } = useParams<{ user_id: string }>();
  const [user, setUser] = useState<User | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeInvoice, setActiveInvoice] = useState<StripeInvoice | null>(null);

  const fetchData = useCallback(async () => {
    if (!user_id) return;
    try {
      // --- UPDATED ---
      const res = await api.admin.users[':user_id'].$get({ param: { user_id } });
      if (!res.ok) throw new Error('Failed to fetch user data');
      const userData = await res.json();
      // --- END UPDATE ---
      setUser(userData);
    } catch (err: any)      {
      setMessage({ type: 'danger', text: `Failed to fetch user data: ${err.message}` });
    }
  }, [user_id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // These handlers were in the original file but not fully implemented.
  // They are preserved here for you to connect to your UI/modals.
  const handleCreateInvoiceClick = async () => {
    if (!user_id) return;
    setIsSubmitting(true);
    setMessage(null);
    try {
        // Example of how this might be implemented:
        // const res = await api.admin.users[':user_id'].invoices.$post({ param: { user_id } });
        // const { invoice } = await res.json();
        // setActiveInvoice(invoice);
        // fetchData(); // or mutate
        setMessage({ type: 'success', text: 'Draft invoice created!' });
    } catch (err: any) {
        setMessage({ type: 'danger', text: `Failed to create invoice: ${err.message}` });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleImportInvoices = async () => {
      if (!user_id) return;
      setIsSubmitting(true);
      setMessage(null);
      try {
          // const res = await api.admin.users[':user_id'].invoices.import.$post({ param: { user_id } });
          // const result = await res.json();
          // setMessage({ type: 'success', text: `Imported ${result.imported} invoices.` });
          // fetchData(); // or mutate
      } catch (err: any) {
          setMessage({ type: 'danger', text: `Failed to import invoices: ${err.message}` });
      } finally {
          setIsSubmitting(false);
      }
  };

  if (!user) {
    return <div className="text-center p-8">Loading user details...</div>;
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
            <div className="flex gap-2 mb-3">
                <button className="btn btn-primary" onClick={handleCreateInvoiceClick} disabled={isSubmitting}>
                    {isSubmitting ? 'Creating...' : 'Create New Invoice'}
                </button>
                 <button className="btn btn-secondary" onClick={handleImportInvoices} disabled={isSubmitting}>
                    {isSubmitting ? 'Importing...' : 'Import from Stripe'}
                </button>
            </div>

            <hr />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
              <div className="card bg-gray-50 dark:bg-gray-800">
                <div className="card-body">
                  <h2 className="card-title">Jobs & Quotes</h2>
                  <p>View, edit, or create new jobs and quotes for this user.</p>
                  <div className="justify-end card-actions">
                    <Link to={`/admin/users/${user.id}/jobs`} className="btn btn-primary">Manage Jobs</Link>
                  </div>
                </div>
              </div>

              <div className="card bg-gray-50 dark:bg-gray-800">
                <div className="card-body">
                  <h2 className="card-title">Photos</h2>
                  <p>View or upload photos associated with this user's jobs.</p>
                  <div className="justify-end card-actions">
                    <Link to={`/admin/users/${user.id}/photos`} className="btn btn-primary">Manage Photos</Link>
                  </div>
                </div>
              </div>

              <div className="card bg-gray-50 dark:bg-gray-800">
                <div className="card-body">
                  <h2 className="card-title">Notes</h2>
                  <p>View or add internal notes for this user.</p>
                  <div className="justify-end card-actions">
                    <Link to={`/admin/users/${user.id}/notes`} className="btn btn-primary">Manage Notes</Link>
                  </div>
                </div>
              </div>
            </div>
        </div>
      </div>
      {/* {activeInvoice && <InvoiceEditor invoice={activeInvoice} onClose={() => setActiveInvoice(null)} onUpdate={fetchData} />} */}
    </div>
  );
}
