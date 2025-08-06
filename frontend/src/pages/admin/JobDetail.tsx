import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { apiGet, getLineItemsForJob, apiPost, apiPostFormData, adminFinalizeJob, markInvoiceAsPaid, addInvoiceItem, deleteInvoiceItem, finalizeInvoice, getInvoice, adminInvoiceJob } from '../../lib/api.js';
import type { Job, LineItem, Photo, Note, StripeInvoice, StripeInvoiceItem } from '@portal/shared';
import { jwtDecode } from 'jwt-decode';
import RecurrenceRequestModal from '../../components/modals/RecurrenceRequestModal.js';
import QuoteProposalModal from '../../components/modals/QuoteProposalModal.js';

interface UserPayload {
  id: number;
  role: 'customer' | 'admin';
}

const parseRRule = (rrule: string | null | undefined): string => {
    if (!rrule) return 'Not set';
    const parts = rrule.split(';');
    const rules: Record<string, string> = {};
    parts.forEach(part => {
        const [key, value] = part.split('=');
        if (key && value) rules[key] = value;
    });
    const frequency = rules.FREQ;
    const interval = rules.INTERVAL ? parseInt(rules.INTERVAL, 10) : 1;
    const byDay = rules.BYDAY;
    let description = 'Recurs';
    if (frequency === 'DAILY') description += interval > 1 ? ` every ${interval} days` : ' daily';
    else if (frequency === 'WEEKLY') description += interval > 1 ? ` every ${interval} weeks` : ' weekly';
    else if (frequency === 'MONTHLY') description += interval > 1 ? ` every ${interval} months` : ' monthly';
    if (byDay) {
        const dayMap: Record<string, string> = { SU: 'Sunday', MO: 'Monday', TU: 'Tuesday', WE: 'Wednesday', TH: 'Thursday', FR: 'Friday', SA: 'Saturday' };
        const days = byDay.split(',').map(d => dayMap[d]).join(', ');
        description += ` on ${days}`;
    }
    return description;
};

function JobDetail() {
  const { id: jobId } = useParams<{ id: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [invoice, setInvoice] = useState<StripeInvoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<UserPayload | null>(null);
  const [isRecurrenceModalOpen, setIsRecurrenceModalOpen] = useState(false);
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isEditingJob, setIsEditingJob] = useState(false);
  const [editingLineItem, setEditingLineItem] = useState<Partial<LineItem> | null>(null);
  const [newNote, setNewNote] = useState('');
  const [editedJobData, setEditedJobData] = useState<Partial<Job>>({});
  const [isEditingInvoice, setIsEditingInvoice] = useState(false);
  const [newInvoiceItem, setNewInvoiceItem] = useState({ description: '', amount: '' });

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        setUser(jwtDecode<UserPayload>(token));
      } catch (e) {
        console.error("Invalid token:", e);
      }
    }
  }, []);

  const fetchJobDetails = useCallback(async () => {
    if (!jobId) return;
    try {
      setError(null);
      const [jobData, lineItemsData, photosData, notesData] = await Promise.all([
        apiGet<Job>(`/api/jobs/${jobId}`),
        getLineItemsForJob(jobId),
        apiGet<Photo[]>(`/api/jobs/${jobId}/photos`),
        apiGet<Note[]>(`/api/jobs/${jobId}/notes`)
      ]);
      setJob(jobData);
      setLineItems(lineItemsData);
      setPhotos(photosData);
      setNotes(notesData);
      setEditedJobData(jobData);
      if (jobData.stripe_invoice_id && jobData.status === 'invoice_draft') {
        const invoiceData = await getInvoice(jobData.stripe_invoice_id);
        setInvoice(invoiceData);
      }
    } catch (err: any) {
      setError(err.message || 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    setIsLoading(true);
    fetchJobDetails();
  }, [jobId, fetchJobDetails]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!jobId || user?.role !== 'admin' || !job) return;
    setError(null);
    try {
      const uploadPromises = acceptedFiles.map(file => {
        const formData = new FormData();
        formData.append('photo', file);
        formData.append('user_id', String(job.user_id));
        formData.append('job_id', jobId);
        return apiPostFormData(`/api/admin/users/${job.user_id}/photos`, formData);
      });
      await Promise.all(uploadPromises);
      fetchJobDetails();
    } catch (err: any) {
      setError(`Upload failed: ${err.message}`);
    }
  }, [jobId, user, job, fetchJobDetails]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'image/*': [] }, disabled: user?.role !== 'admin' });

  const handleNoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim() || !jobId || user?.role !== 'admin' || !job) return;
    try {
      await apiPost(`/api/admin/users/${job.user_id}/notes`, {
        content: newNote,
        job_id: jobId,
      });
      setNewNote('');
      fetchJobDetails();
    } catch (err: any) {
      setError(`Failed to add note: ${err.message}`);
    }
  };

  const handleJobUpdate = async () => {
    if (!jobId || user?.role !== 'admin') return;
    try {
      await apiPost(`/api/admin/jobs/${jobId}/details`, editedJobData, 'PUT');
      setIsEditingJob(false);
      fetchJobDetails();
    } catch (err: any) {
      setError(`Failed to update job: ${err.message}`);
    }
  };

  const handleLineItemUpdate = async () => {
    if (!editingLineItem || !jobId || user?.role !== 'admin') return;
    try {
      const url = editingLineItem.id ? `/api/admin/jobs/${jobId}/line-items/${editingLineItem.id}` : `/api/admin/jobs/${jobId}/line-items`;
      const method = editingLineItem.id ? 'PUT' : 'POST';
      await apiPost(url, {
        ...editingLineItem,
        unit_total_amount_cents: Math.round(Number(editingLineItem.unit_total_amount_cents || 0))
      }, method);
      setEditingLineItem(null);
      fetchJobDetails();
    } catch (err: any) {
      setError(`Failed to save line item: ${err.message}`);
    }
  };

  const handleLineItemDelete = async (lineItemId: number) => {
    if (!jobId || user?.role !== 'admin' || !window.confirm("Are you sure you want to delete this line item?")) return;
    try {
        await apiPost(`/api/admin/jobs/${jobId}/line-items/${lineItemId}`, {}, 'DELETE');
        fetchJobDetails();
    } catch (err: any) {
        setError(`Failed to delete line item: ${err.message}`);
    }
  };

  const handleFinalizeJob = async () => {
    if (!jobId || !window.confirm("This will finalize the job and send an invoice to the customer. This action cannot be undone. Continue?")) return;
    try {
        await adminFinalizeJob(jobId);
        fetchJobDetails();
    } catch (err: any) {
        setError(`Failed to finalize job: ${err.message}`);
    }
  };

  const handleMarkAsPaid = async () => {
    if (!jobId || !job?.stripe_invoice_id || !window.confirm("Are you sure you want to mark this invoice as paid?")) return;
    setIsUpdating(true);
    try {
        await markInvoiceAsPaid(job.stripe_invoice_id);
        fetchJobDetails();
    } catch (err: any) {
        setError(`Failed to mark as paid: ${err.message}`);
    } finally {
        setIsUpdating(false);
    }
  };

  const handleAcceptQuote = async () => {
    if (!job?.id) return;
    try {
        await apiPost(`/api/jobs/${job.id}/accept`, {});
        fetchJobDetails();
        setIsQuoteModalOpen(false);
    } catch (err: any) {
        setError(`Failed to accept quote: ${err.message}`);
    }
};

const handleDeclineQuote = async () => {
    if (!job?.id) return;
    try {
        await apiPost(`/api/jobs/${job.id}/decline`, {});
        fetchJobDetails();
        setIsQuoteModalOpen(false);
    } catch (err: any) {
        setError(`Failed to decline quote: ${err.message}`);
    }
};

const handleReviseQuote = async (revisionReason: string) => {
    if (!job?.id) return;
    try {
        await apiPost(`/api/jobs/${job.id}/revise`, { revisionReason });
        fetchJobDetails();
        setIsQuoteModalOpen(false);
    } catch (err: any) {
        setError(`Failed to revise quote: ${err.message}`);
    }
};

  const handleAddInvoiceItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInvoiceItem.description || !newInvoiceItem.amount || !invoice) return;
    setIsUpdating(true);
    setError(null);
    try {
      const amountInCents = Math.round(parseFloat(newInvoiceItem.amount) * 100);
      await addInvoiceItem(invoice.id, { description: newInvoiceItem.description, amount: amountInCents });
      setNewInvoiceItem({ description: '', amount: '' });
      fetchJobDetails();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteInvoiceItem = async (itemId: string) => {
    if (!window.confirm('Are you sure you want to delete this line item?') || !invoice) return;
    setIsUpdating(true);
    setError(null);
    try {
      await deleteInvoiceItem(invoice.id, itemId);
      fetchJobDetails();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleFinalizeInvoice = async () => {
    if (!window.confirm('This will finalize the invoice and send it to the customer. Are you sure?') || !invoice) return;
    setIsUpdating(true);
    setError(null);
    try {
      await finalizeInvoice(invoice.id);
      setIsEditingInvoice(false);
      fetchJobDetails();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRequestPayment = async () => {
    if (!jobId || !window.confirm("This will generate an invoice and send a payment request to the customer. Are you sure?")) return;
    setIsUpdating(true);
    setError(null);
    try {
        await adminInvoiceJob(jobId);
        setSuccessMessage('Payment request sent successfully!');
        fetchJobDetails();
    } catch (err: any) {
        setError(`Failed to request payment: ${err.message}`);
    } finally {
        setIsUpdating(false);
    }
  };

  const statusStyle = (status: string) => {
      switch (status.toLowerCase()) {
        case 'upcoming': return 'bg-yellow-100 text-yellow-800';
        case 'confirmed': return 'bg-blue-100 text-blue-800';
        case 'completed':
        case 'paid':
             return 'bg-green-100 text-green-800';
        case 'payment_needed': return 'bg-orange-100 text-orange-800';
        case 'past_due': return 'bg-red-100 text-red-800';
        case 'cancelled': return 'bg-gray-100 text-gray-800';
        default: return 'bg-gray-100 text-gray-800';
      }
  };

  if (isLoading) return <div className="text-center p-8">Loading job details...</div>;
  if (error && !job) return <div className="rounded-md bg-red-100 p-4 text-sm text-red-700">{error}</div>;
  if (!job) return <div className="text-center p-8"><h2>Job not found</h2></div>;

  const hasRecurrence = job.recurrence && job.recurrence !== 'none';
  const showRequestPaymentButton = user?.role === 'admin' && (job.status === 'pending' || job.status === 'upcoming');

  return (
    <>
      {isRecurrenceModalOpen && (
        <RecurrenceRequestModal
          isOpen={isRecurrenceModalOpen}
          onClose={() => setIsRecurrenceModalOpen(false)}
          job={job}
          onSuccess={() => {
            setSuccessMessage(`Your recurrence ${hasRecurrence ? 'update' : 'request'} has been submitted.`);
            setTimeout(() => setSuccessMessage(null), 5000);
            fetchJobDetails();
          }}
        />
      )}
      <QuoteProposalModal
          isOpen={isQuoteModalOpen}
          onClose={() => setIsQuoteModalOpen(false)}
          onConfirm={handleAcceptQuote}
          onDecline={handleDeclineQuote}
          onRevise={handleReviseQuote}
          jobId={jobId!}
      />
      <div className="max-w-7xl mx-auto space-y-6">
        {error && <div className="alert alert-danger mb-4">{error}</div>}
        {successMessage && <div className="alert alert-success mb-4">{successMessage}</div>}
        <div className="card">
          <div className="card-header flex justify-between items-center">
            <div>
              {isEditingJob ? (
                  <input
                      type="text"
                      value={editedJobData.title || ''}
                      onChange={(e) => setEditedJobData({...editedJobData, title: e.target.value})}
                      className="form-control text-2xl font-bold"
                  />
              ) : (
                  <h2 className="card-title">{job.title}</h2>
              )}
            </div>
            <div className="flex items-center gap-2">
                {user?.role === 'admin' && !isEditingJob && (
                    <button className="btn btn-secondary" onClick={() => setIsEditingJob(true)}>Edit Job</button>
                )}
                {/* --- JobToInvoice Button --- */}
                {showRequestPaymentButton && (
                    <button
                        className="btn btn-success"
                        onClick={handleRequestPayment}
                        disabled={isUpdating}
                    >
                        {isUpdating ? 'Sending...' : 'Request Payment'}
                    </button>
                )}
            </div>
          </div>
          <div className="card-body">
              {isEditingJob ? (
                   <div className="space-y-4">
                      <div>
                          <label className="form-label">Description</label>
                          <textarea
                              value={editedJobData.description || ''}
                              onChange={(e) => setEditedJobData({...editedJobData, description: e.target.value})}
                              className="form-control"
                              rows={3}
                          />
                      </div>
                      <div className="flex justify-end gap-2">
                          <button className="btn btn-secondary" onClick={() => { setIsEditingJob(false); setEditedJobData(job); }}>Cancel</button>
                          <button className="btn btn-primary" onClick={handleJobUpdate}>Save Changes</button>
                      </div>
                   </div>
              ) : (
                   <dl className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2">
                      <div className="sm:col-span-1">
                         <dt className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">Status</dt>
                         <dd className="mt-1 text-sm">
                          <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${statusStyle(job.status)}`}>
                            {job.status.replace(/_/g, ' ')}
                          </span>
                         </dd>
                      </div>
                      <div className="sm:col-span-1">
                         <dt className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">Total Cost</dt>
                         <dd className="mt-1 text-sm font-semibold">${((job.total_amount_cents || 0) / 100).toFixed(2)}</dd>
                      </div>
                      {job.description && (
                        <div className="sm:col-span-2">
                           <dt className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">Description</dt>
                           <dd className="mt-1 text-sm">{job.description}</dd>
                        </div>
                      )}
                       {hasRecurrence && (
                        <div className="sm:col-span-1">
                           <dt className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">Recurrence</dt>
                           <dd className="mt-1 text-sm font-semibold">{parseRRule(job.recurrence)}</dd>
                        </div>
                      )}
                       {job.stripe_quote_id && (
                        <div className="sm:col-span-1">
                           <dt className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">Quote</dt>
                           <dd className="mt-1 text-sm">
                                <a href={`https://dashboard.stripe.com/quotes/${job.stripe_quote_id}`} target="_blank" rel="noopener noreferrer" className="text-event-blue hover:underline">
                                   View Quote
                                </a>
                           </dd>
                        </div>
                      )}
                       {job.stripe_invoice_id && (
                        <div className="sm:col-span-1">
                           <dt className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">Invoice</dt>
                           <dd className="mt-1 text-sm">
                               <Link to={`/pay-invoice/${job.stripe_invoice_id}`} className="text-event-blue hover:underline">
                                   View Invoice
                               </Link>
                           </dd>
                        </div>
                      )}
                       {job.stripe_invoice_id && user?.role === 'admin' && job.status !== 'paid' && job.status !== 'completed' && (
                        <div className="sm:col-span-1">
                            <dt className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">Admin Actions</dt>
                            <dd className="mt-1 text-sm">
                                <button
                                    onClick={handleMarkAsPaid}
                                    className="btn btn-sm btn-success"
                                    disabled={isUpdating}
                                >
                                    {isUpdating ? 'Updating...' : 'Mark Paid'}
                                </button>
                                {job.status === 'invoice_draft' && (
                                  <button onClick={() => setIsEditingInvoice(true)} className="btn btn-sm btn-secondary ml-2">Edit Draft Invoice</button>
                                )}
                            </dd>
                        </div>
                       )}
                   </dl>
              )}
          </div>
          {user?.role === 'admin' && ['upcoming', 'confirmed'].includes(job.status) && (
              <div className="card-footer text-right p-4">
                  <button className="btn btn-success" onClick={handleFinalizeJob}>Finalize Job & Send Invoice</button>
              </div>
          )}
        </div>

        {isEditingInvoice && invoice && (
          <div className="card">
            <div className="card-header"><h3 className="card-title text-xl">Editing Draft Invoice: {invoice.id}</h3></div>
            <div className="card-body">
              <strong>Line Items:</strong>
              {invoice.lines.data.length === 0 ? <p>No items yet.</p> : (
                <ul>
                  {invoice.lines.data.map((item: StripeInvoiceItem) => (
                    <li key={item.id} className="flex justify-between items-center">
                      <span>{item.description} - ${(item.amount / 100).toFixed(2)}</span>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDeleteInvoiceItem(item.id)} disabled={isUpdating}>X</button>
                    </li>
                  ))}
                </ul>
              )}
              <form onSubmit={handleAddInvoiceItem} className="row g-3 align-items-end mb-4 mt-4">
                <div className="col-md-6">
                  <label htmlFor="description" className="form-label">Description</label>
                  <input type="text" className="form-control" id="description" value={newInvoiceItem.description} onChange={(e) => setNewInvoiceItem({ ...newInvoiceItem, description: e.target.value })} required />
                </div>
                <div className="col-md-4">
                  <label htmlFor="amount" className="form-label">Amount ($)</label>
                  <input type="number" className="form-control" id="amount" step="0.01" value={newInvoiceItem.amount} onChange={(e) => setNewInvoiceItem({ ...newInvoiceItem, amount: e.target.value })} required />
                </div>
                <div className="col-md-2">
                  <button type="submit" className="btn btn-info w-100" disabled={isUpdating}>Add</button>
                </div>
              </form>
            </div>
            <div className="card-footer flex justify-end gap-2">
              <button className="btn btn-secondary" onClick={() => setIsEditingInvoice(false)}>Cancel</button>
              <button className="btn btn-success" onClick={handleFinalizeInvoice} disabled={isUpdating || invoice.lines.data.length === 0}>
                {isUpdating ? 'Finalizing...' : 'Finalize & Send'}
              </button>
            </div>
          </div>
        )}

        <div className="card">
            <div className="card-header flex justify-between items-center">
              <h3 className="card-title text-xl">Service Line Items</h3>
              {user?.role === 'admin' && !editingLineItem && (
                  <button className="btn btn-primary" onClick={() => setEditingLineItem({})}>Add Item</button>
              )}
            </div>
            <div className="card-body">
                {lineItems.length > 0 ? (
                    <ul className="divide-y divide-border-light dark:divide-border-dark">
                        {lineItems.map(item => (
                            <li key={item.id} className="py-3 flex justify-between items-center">
                                <span>{item.description}</span>
                                <div className="flex items-center gap-4">
                                  <span className="font-medium">${((item.unit_total_amount_cents || 0) / 100).toFixed(2)} x {item.quantity}</span>
                                  {user?.role === 'admin' && (
                                      <div className="flex gap-2">
                                          <button className="btn btn-sm btn-secondary" onClick={() => setEditingLineItem(item)}>Edit</button>
                                          <button className="btn btn-sm btn-danger" onClick={() => handleLineItemDelete(item.id)}>Del</button>
                                      </div>
                                  )}
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : <p>No service items found for this job.</p>}
                {editingLineItem && (
                  <div className="mt-4 p-4 border rounded-md bg-secondary-light/50 dark:bg-secondary-dark/50 space-y-3">
                      <h4 className="font-semibold">{editingLineItem.id ? 'Edit' : 'Add'} Line Item</h4>
                       <input
                          type="text"
                          placeholder="Description"
                          value={editingLineItem.description || ''}
                          onChange={(e) => setEditingLineItem({...editingLineItem, description: e.target.value})}
                          className="form-control"
                      />
                      <input
                          type="number"
                          placeholder="Quantity"
                          value={editingLineItem.quantity || 1}
                          onChange={(e) => setEditingLineItem({...editingLineItem, quantity: parseInt(e.target.value)})}
                          className="form-control"
                      />
                      <input
                          type="number"
                          placeholder="Unit Price ($)"
                          step="0.01"
                          value={editingLineItem.unit_total_amount_cents !== undefined ? (editingLineItem.unit_total_amount_cents / 100).toFixed(2) : ''}
                          onChange={(e) => setEditingLineItem({...editingLineItem, unit_total_amount_cents: parseFloat(e.target.value) * 100 })}
                          className="form-control"
                      />
                      <div className="flex justify-end gap-2">
                          <button className="btn btn-secondary" onClick={() => setEditingLineItem(null)}>Cancel</button>
                          <button className="btn btn-primary" onClick={handleLineItemUpdate}>Save Item</button>
                      </div>
                  </div>
                )}
            </div>
             <div className="card-footer bg-secondary-light dark:bg-secondary-dark p-4 flex justify-end">
                  <span className="text-lg font-bold">Total: ${((job.total_amount_cents || 0) / 100).toFixed(2)}</span>
             </div>
        </div>

        <div className="card">
            <div className="card-header"><h3 className="card-title text-xl">Photos</h3></div>
            <div className="card-body">
                {photos.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {photos.map(photo => (
                            <a key={photo.id} href={photo.url} target="_blank" rel="noopener noreferrer">
                                <img src={photo.url} alt={`Job photo taken on ${new Date(photo.createdAt).toLocaleDateString()}`} className="rounded-lg object-cover aspect-square"/>
                            </a>
                        ))}
                    </div>
                ) : <p>No photos found for this job.</p>}
            </div>
            {user?.role === 'admin' && (
               <div className="card-footer p-4" {...getRootProps()}>
                  <input {...getInputProps()} />
                  <div className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-secondary-light dark:hover:bg-secondary-dark transition-colors">
                      {isDragActive ? <p>Drop files here...</p> : <p>Drag & drop photos or click to upload</p>}
                  </div>
               </div>
            )}
        </div>

        <div className="card">
            <div className="card-header"><h3 className="card-title text-xl">Notes</h3></div>
            <div className="card-body">
                {notes.length > 0 ? (
                    <ul className="space-y-4">
                        {notes.map(note => (
                            <li key={note.id} className="p-3 bg-secondary-light dark:bg-secondary-dark rounded-md">
                                <p className="text-sm">{note.content}</p>
                                <small className="text-text-secondary-light dark:text-text-secondary-dark">{new Date(note.createdAt).toLocaleString()}</small>
                            </li>
                        ))}
                    </ul>
                ) : <p>No notes found for this job.</p>}
            </div>
            {user?.role === 'admin' && (
               <div className="card-footer p-4">
                  <form onSubmit={handleNoteSubmit} className="flex gap-2">
                      <input
                          type="text"
                          value={newNote}
                          onChange={(e) => setNewNote(e.target.value)}
                          className="form-control flex-grow"
                          placeholder="Add a new note..."
                      />
                      <button type="submit" className="btn btn-primary">Add Note</button>
                  </form>
               </div>
            )}
        </div>
      </div>
    </>
  );
}

export default JobDetail;
