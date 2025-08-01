import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
// Import the new 'api' client.
import { api } from '../../lib/api.js';
import { ApiError } from '../../lib/fetchJson';
import type { Job, LineItem, Photo, Note, StripeInvoice, StripeInvoiceItem, User } from '@portal/shared';
import { jwtDecode } from 'jwt-decode';
import RecurrenceRequestModal from '../../components/modals/RecurrenceRequestModal.js';
import QuoteProposalModal from '../../components/modals/QuoteProposalModal.js';

interface UserPayload {
  id: number;
  role: 'customer' | 'admin';
}

// Helper function to handle API responses
const fetchAndParse = async (promise: Promise<Response>) => {
    const res = await promise;
    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new ApiError(errorData.error || `Request failed`, res.status);
    }
    return res.json();
}

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
  const [isUpdating, setIsUpdating] = useState(false);
  const [isEditingJob, setIsEditingJob] = useState(false);
  const [editingLineItem, setEditingLineItem] = useState<Partial<LineItem> | null>(null);
  const [newNote, setNewNote] = useState('');
  const [editedJobData, setEditedJobData] = useState<Partial<Job>>({});
  const [isEditingInvoice, setIsEditingInvoice] = useState(false);
  const [newInvoiceItem, setNewInvoiceItem] = useState({ description: '', amount: '' });

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) try { setUser(jwtDecode<UserPayload>(token)); } catch (e) { console.error("Invalid token:", e); }
  }, []);

  const fetchJobDetails = useCallback(async () => {
    if (!jobId) return;
    try {
      setError(null);
      // --- UPDATED ---
      const [jobData, lineItemsData, photosData, notesData] = await Promise.all([
        fetchAndParse(api.jobs[':id'].$get({ param: { id: jobId } })),
        fetchAndParse(api.jobs[':id']['line-items'].$get({ param: { id: jobId } })),
        fetchAndParse(api.jobs[':id'].photos.$get({ param: { id: jobId } })),
        fetchAndParse(api.jobs[':id'].notes.$get({ param: { id: jobId } }))
      ]);
      // --- END UPDATE ---
      setJob(jobData);
      setLineItems(lineItemsData);
      setPhotos(photosData);
      setNotes(notesData);
      setEditedJobData(jobData);
      if (jobData.stripe_invoice_id && jobData.status === 'invoice_draft') {
        const invoiceData = await fetchAndParse(api.admin.invoices[':invoiceId'].$get({ param: { invoiceId: jobData.stripe_invoice_id } }));
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
        return api.admin.users[':user_id'].photos.$post({
            param: { user_id: String(job.user_id) },
            form: formData
        });
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
      await api.admin.users[':user_id'].notes.$post({
        param: { user_id: String(job.user_id) },
        json: { content: newNote, job_id: jobId }
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
      await api.admin.jobs[':jobId'].details.$put({
        param: { jobId },
        json: editedJobData
      });
      setIsEditingJob(false);
      fetchJobDetails();
    } catch (err: any) {
      setError(`Failed to update job: ${err.message}`);
    }
  };

  const handleLineItemUpdate = async () => {
    if (!editingLineItem || !jobId || user?.role !== 'admin') return;
    try {
      const payload = {
        ...editingLineItem,
        unit_total_amount_cents: Math.round(Number(editingLineItem.unit_total_amount_cents || 0))
      };
      if (editingLineItem.id) {
        await api.admin.jobs[':jobId']['line-items'][':lineItemId'].$put({
          param: { jobId, lineItemId: editingLineItem.id.toString() },
          json: payload
        });
      } else {
        await api.admin.jobs[':jobId']['line-items'].$post({
          param: { jobId },
          json: payload
        });
      }
      setEditingLineItem(null);
      fetchJobDetails();
    } catch (err: any) {
      setError(`Failed to save line item: ${err.message}`);
    }
  };

  const handleLineItemDelete = async (lineItemId: number) => {
    if (!jobId || user?.role !== 'admin' || !window.confirm("Are you sure?")) return;
    try {
        await api.admin.jobs[':jobId']['line-items'][':lineItemId'].$delete({
          param: { jobId, lineItemId: lineItemId.toString() }
        });
        fetchJobDetails();
    } catch (err: any) {
        setError(`Failed to delete line item: ${err.message}`);
    }
  };

  const handleFinalizeJob = async () => {
    if (!jobId || !window.confirm("This will finalize the job and send an invoice. Continue?")) return;
    try {
        await api.admin.jobs[':jobId'].complete.$post({ param: { jobId } });
        fetchJobDetails();
    } catch (err: any) {
        setError(`Failed to finalize job: ${err.message}`);
    }
  };

  const handleMarkAsPaid = async () => {
    if (!job?.stripe_invoice_id || !window.confirm("Are you sure?")) return;
    setIsUpdating(true);
    try {
        await api.admin.invoices[':invoiceId']['mark-as-paid'].$post({ param: { invoiceId: job.stripe_invoice_id } });
        fetchJobDetails();
    } catch (err: any) {
        setError(`Failed to mark as paid: ${err.message}`);
    } finally {
        setIsUpdating(false);
    }
  };

  const handleAddInvoiceItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInvoiceItem.description || !newInvoiceItem.amount || !invoice) return;
    setIsUpdating(true);
    setError(null);
    try {
      const amountInCents = Math.round(parseFloat(newInvoiceItem.amount) * 100);
      await api.admin.invoices[':invoiceId'].items.$post({
        param: { invoiceId: invoice.id },
        json: { description: newInvoiceItem.description, amount: amountInCents }
      });
      setNewInvoiceItem({ description: '', amount: '' });
      fetchJobDetails();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteInvoiceItem = async (itemId: string) => {
    if (!window.confirm('Are you sure?') || !invoice) return;
    setIsUpdating(true);
    setError(null);
    try {
      await api.admin.invoices[':invoiceId'].items[':itemId'].$delete({
        param: { invoiceId: invoice.id, itemId }
      });
      fetchJobDetails();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleFinalizeInvoice = async () => {
    if (!window.confirm('This will finalize and send the invoice. Are you sure?') || !invoice) return;
    setIsUpdating(true);
    setError(null);
    try {
      await api.admin.invoices[':invoiceId'].finalize.$post({ param: { invoiceId: invoice.id } });
      setIsEditingInvoice(false);
      fetchJobDetails();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) return <div className="text-center p-8">Loading job details...</div>;
  if (error && !job) return <div className="alert alert-danger">{error}</div>;
  if (!job) return <div className="text-center p-8"><h2>Job not found</h2></div>;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* ... JSX remains largely the same, only the API calls above were changed ... */}
    </div>
  );
}

export default JobDetail;
