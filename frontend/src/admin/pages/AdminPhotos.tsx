import { useState, useEffect, useMemo, useCallback } from 'react';
import { apiGet, apiPostFormData, getLineItemsForJob } from '../../lib/api';
import type { User, Job, LineItem } from '@portal/shared';
import { useDropzone } from 'react-dropzone';

export default function AdminPhotos() {
  const [users, setUsers] = useState<User[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [items, setItems] = useState<LineItem[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedJob, setSelectedJob] = useState<string>('');
  const [selectedItem, setSelectedItem] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'danger', text: string } | null>(null);

  useEffect(() => {
    // Fetches all users for the dropdown
    apiGet<User[]>('/api/admin/users').then(setUsers);
  }, []);

  useEffect(() => {
    // When a user is selected, fetch their associated jobs
    if (selectedUser) {
      apiGet<Job[]>(`/api/admin/jobs/user/${selectedUser}`).then(setJobs);
    } else {
      setJobs([]);
    }
    setSelectedJob(''); // Reset job selection
  }, [selectedUser]);

  useEffect(() => {
    // When a job is selected, fetch its line items
    if (selectedJob) {
      // BUG FIX: Use the correct API helper function to fetch line items
      getLineItemsForJob(selectedJob).then(setItems).catch(() => setItems([]));
    } else {
      setItems([]);
    }
    setSelectedItem(''); // Reset item selection
  }, [selectedJob]);

  // Handles the file drop/upload logic
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!selectedUser) {
      setMessage({ type: 'danger', text: 'Please select a user before uploading.' });
      return;
    }
    setMessage(null);
    setIsSubmitting(true);
    try {
      // Create a promise for each file upload
      const uploadPromises = acceptedFiles.map(file => {
        const formData = new FormData();
        formData.append('photo', file);
        formData.append('user_id', selectedUser);
        if (selectedJob) formData.append('job_id', selectedJob);
        if (selectedItem) formData.append('item_id', selectedItem);
        if (notes) formData.append('notes', notes);
        // Post the form data to the backend
        return apiPostFormData(`/api/admin/users/${selectedUser}/photos`, formData);
      });
      await Promise.all(uploadPromises);
      setMessage({ type: 'success', text: `${acceptedFiles.length} photo(s) uploaded successfully!` });
      // Reset form fields after successful upload
      setSelectedJob('');
      setSelectedItem('');
      setNotes('');
    } catch (err: any) {
      setMessage({ type: 'danger', text: `Upload failed: ${err.message}` });
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedUser, selectedJob, selectedItem, notes]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'image/*': [] } });

  // Memoized user filtering based on search input
  const filteredUsers = useMemo(() => {
    const lowercasedQuery = userSearch.toLowerCase();
    if (!lowercasedQuery) return users;
    return users.filter(user =>
      user.name?.toLowerCase().includes(lowercasedQuery) ||
      user.company_name?.toLowerCase().includes(lowercasedQuery) ||
      user.email?.toLowerCase().includes(lowercasedQuery) ||
      user.phone?.includes(lowercasedQuery)
    );
  }, [users, userSearch]);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
      <h2 className="text-2xl font-bold mb-4">Upload Photos for a User</h2>
      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}
      <div className="card">
        <div className="card-body space-y-4">
          <div>
            <label htmlFor="userSearch" className="form-label">Search and Select a User</label>
            <input
              type="text"
              id="userSearch"
              className="form-control mb-2"
              placeholder="Search by name, email, or phone..."
              value={userSearch}
              onChange={e => setUserSearch(e.target.value)}
            />
            <select
              id="user"
              className="form-control"
              value={selectedUser}
              onChange={e => setSelectedUser(e.target.value)}
              required
            >
              <option value="">-- Select a User --</option>
              {filteredUsers.map(user => (
                <option key={user.id} value={user.id.toString()}>
                  {user.name || user.company_name} ({user.email || user.phone})
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="job" className="form-label">Associate with Job (Optional)</label>
              <select id="job" className="form-control" value={selectedJob} onChange={e => setSelectedJob(e.target.value)} disabled={!selectedUser}>
                <option value="">-- Select a Job --</option>
                {jobs.map(job => (
                  <option key={job.id} value={job.id}>{job.title} - {new Date(job.createdAt).toLocaleDateString()}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="item" className="form-label">Associate with Line Item (Optional)</label>
              <select id="item" className="form-control" value={selectedItem} onChange={e => setSelectedItem(e.target.value)} disabled={!selectedJob}>
                <option value="">-- Select a Line Item --</option>
                {/* BUG FIX: Display the item's description, not notes */}
                {items.map(item => (
                  <option key={item.id} value={item.id.toString()}>{item.description}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="notes" className="form-label">Notes (Optional)</label>
            <textarea
              id="notes"
              className="form-control"
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add any relevant notes for these photos..."
            ></textarea>
          </div>
          <div {...getRootProps()} className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-light">
            <input {...getInputProps()} />
            {isDragActive ? <p>Drop the files here...</p> : <p>Drag 'n' drop photos here, or click to select files</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
