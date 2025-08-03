import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { HTTPException } from 'hono/http-exception';
import type { User } from '@portal/shared';

type Message = { type: 'success' | 'danger'; text: string; };

export function UserDetailPage() {
  const { user_id } = useParams<{ user_id: string }>();
  const [user, setUser] = useState<User | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleApiError = async (err: unknown, defaultMessage: string) => {
    if (err instanceof HTTPException) {
        const errorJson = await err.response.json().catch(() => ({}));
        setMessage({ type: 'danger', text: errorJson.message || errorJson.error || defaultMessage });
    } else {
        setMessage({ type: 'danger', text: (err as Error).message || defaultMessage });
    }
  };

  const fetchData = useCallback(async () => {
    if (!user_id) return;
    try {
      // REFACTORED: Correctly parse the JSON and access the 'user' property
      const response = await api.admin.users[':user_id'].$get({ param: { user_id } });
      const data = await response.json();
      setUser(data.user);
    } catch (err) {
      handleApiError(err, 'Failed to fetch user data');
    }
  }, [user_id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateInvoiceClick = async () => {
    if (!user_id) return;
    setIsSubmitting(true);
    setMessage(null);
    try {
        // This endpoint likely returns a new invoice object
        const response = await api.admin.invoices.$post({ json: { user_id } });
        const data = await response.json();
        setMessage({ type: 'success', text: `Draft invoice created! ID: ${data.invoice.id}` });
        // Optionally, navigate to the new invoice or refresh relevant data
    } catch (err) {
        handleApiError(err, 'Failed to create invoice');
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleImportInvoices = async () => {
      if (!user_id) return;
      setIsSubmitting(true);
      setMessage(null);
      try {
          const response = await api.admin.invoices.import.$post({ json: { user_id } });
          const result = await response.json();
          setMessage({ type: 'success', text: `Imported ${result.importedCount} invoices.` });
          fetchData();
      } catch (err) {
          handleApiError(err, 'Failed to import invoices');
      } finally {
          setIsSubmitting(false);
      }
  };

  if (!user) return <div className="text-center p-8">Loading user details...</div>;

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
    </div>
  );
}
