// frontend/src/pages/Photos.tsx
import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDropzone } from 'react-dropzone';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import type { PhotoWithNotes, User, Job, LineItem } from '@portal/shared';
import { handleApiError } from '../lib/utils';

// --- REFACTORED: Customer Photos Component ---

const fetchCustomerPhotos = async (filters: Record<string, string>) => {
  const activeFilters = Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== '')
  );
  const res = await api.photos.$get({ query: activeFilters });
  if (!res.ok) throw await handleApiError(res, 'Failed to fetch photos.');
  const data = await res.json();
  return data.photos;
};

function CustomerPhotos() {
  const [filters, setFilters] = useState({ createdAt: '', job_id: '', item_id: '' });
  const { data: photos, isLoading, error } = useQuery({
    queryKey: ['customerPhotos', filters],
    queryFn: () => fetchCustomerPhotos(filters),
  });

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
      <h2 className="text-2xl font-bold mb-4">Your Photos</h2>
      <div className="card mb-4">
        <div className="card-body">
          <h5 className="card-title">Filter Photos</h5>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label htmlFor="createdAt" className="form-label">Date</label>
              <input type="date" id="createdAt" name="createdAt" value={filters.createdAt} onChange={handleFilterChange} className="form-control" />
            </div>
            <div>
              <label htmlFor="job_id" className="form-label">Job ID</label>
              <input type="text" id="job_id" name="job_id" value={filters.job_id} onChange={handleFilterChange} className="form-control" placeholder="Job ID"/>
            </div>
            <div>
              <label htmlFor="item_id" className="form-label">Line Item ID</label>
              <input type="text" id="item_id" name="item_id" value={filters.item_id} onChange={handleFilterChange} className="form-control" placeholder="Item ID"/>
            </div>
          </div>
        </div>
      </div>
      {isLoading && <p>Loading photos...</p>}
      {error && <div className="alert alert-danger">{(error as Error).message}</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {photos && photos.length > 0 ? (
          photos.map(photo => (
            <div key={photo.id} className="card h-100">
                <a href={photo.url} target="_blank" rel="noopener noreferrer">
                  <img src={photo.url} alt={`Photo from ${new Date(photo.createdAt).toLocaleDateString()}`} className="card-img-top" style={{ aspectRatio: '16/9', objectFit: 'cover' }} />
                </a>
                <div className="card-body">
                   <p className="card-text"><small className="text-muted">Uploaded: {new Date(photo.createdAt).toLocaleString()}</small></p>
                   {photo.job_id && <p className="card-text"><small className="text-muted">Job ID: {photo.job_id}</small></p>}
                   {photo.item_id && <p className="card-text"><small className="text-muted">Item ID: {photo.item_id}</small></p>}
                   {photo.notes && photo.notes.length > 0 && (
                      <div className="mt-3">
                          <h6>Notes:</h6>
                          <ul className="list-unstyled">
                              {photo.notes.map(note => (
                                  <li key={note.id} className="mb-2">
                                      <p className="mb-0">{note.content}</p>
                                      <small className="text-muted">{new Date(note.createdAt).toLocaleString()}</small>
                                  </li>
                              ))}
                          </ul>
                      </div>
                   )}
                </div>
              </div>
          ))
        ) : (
          !isLoading && <p>No photos found matching your criteria.</p>
        )}
      </div>
    </div>
  );
}

// --- REFACTORED: Admin Photos Component ---

function AdminPhotos() {
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedJob, setSelectedJob] = useState('');
  const [selectedItem, setSelectedItem] = useState('');
  const [notes, setNotes] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'danger', text: string } | null>(null);
  const queryClient = useQueryClient();

  const { data: users = [] } = useQuery({
    queryKey: ['adminUsers'],
    queryFn: async () => (await api.admin.users.$get()).json().then(d => d.users),
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['userJobs', selectedUser],
    queryFn: async () => api.admin.jobs.user[':user_id'].$get({ param: { user_id: selectedUser } }).then(res => res.json()).then(d => d.jobs),
    enabled: !!selectedUser,
  });

  const { data: lineItems = [] } = useQuery({
    queryKey: ['jobLineItems', selectedJob],
    queryFn: async () => api.jobs[':id']['line-items'].$get({ param: { id: selectedJob } }).then(res => res.json()).then(d => d.lineItems),
    enabled: !!selectedJob,
  });

  const uploadMutation = useMutation({
    mutationFn: async (acceptedFiles: File[]) => {
      if (!selectedUser) throw new Error('Please select a user before uploading.');

      const uploadPromises = acceptedFiles.map(file => {
        const formData = new FormData();
        formData.append('photo', file);
        formData.append('user_id', selectedUser);
        if (selectedJob) formData.append('job_id', selectedJob);
        if (selectedItem) formData.append('item_id', selectedItem);
        if (notes) formData.append('notes', notes);

        // Hono RPC client doesn't support multipart/form-data, so we use fetch directly here.
        // This is a known pattern for file uploads.
        return fetch(`/api/admin/users/${selectedUser}/photos`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`},
          body: formData,
        }).then(async res => {
            if (!res.ok) throw await handleApiError(res, 'Upload failed');
            return res.json();
        });
      });
      return Promise.all(uploadPromises);
    },
    onSuccess: (data, variables) => {
      setMessage({ type: 'success', text: `${variables.length} photo(s) uploaded successfully!` });
      queryClient.invalidateQueries({ queryKey: ['customerPhotos'] }); // Invalidate customer view
      setSelectedJob('');
      setSelectedItem('');
      setNotes('');
    },
    onError: (error: Error) => {
      setMessage({ type: 'danger', text: `Upload failed: ${error.message}` });
    }
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setMessage(null);
    uploadMutation.mutate(acceptedFiles);
  }, [uploadMutation]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'image/*': [] } });

  const filteredUsers = useMemo(() => {
    const lowercasedQuery = userSearch.toLowerCase();
    if (!lowercasedQuery) return users;
    return users.filter(user =>
      user.name?.toLowerCase().includes(lowercasedQuery) ||
      user.email?.toLowerCase().includes(lowercasedQuery) ||
      user.phone?.toLowerCase().includes(lowercasedQuery)
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
            <input type="text" id="userSearch" className="form-control mb-2" placeholder="Search by name, email, or phone..." value={userSearch} onChange={e => setUserSearch(e.target.value)} />
            <select id="user" className="form-control" value={selectedUser} onChange={e => { setSelectedUser(e.target.value); setSelectedJob(''); setSelectedItem(''); }} required>
              <option value="">-- Select a User --</option>
              {filteredUsers.map(user => (
                <option key={user.id} value={user.id}>
                  {user.name || user.company_name} ({user.email || user.phone})
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="job" className="form-label">Associate with Job (Optional)</label>
              <select id="job" className="form-control" value={selectedJob} onChange={e => { setSelectedJob(e.target.value); setSelectedItem(''); }} disabled={!selectedUser}>
                <option value="">-- Select a Job --</option>
                {jobs.map(job => (
                  <option key={job.id} value={job.id}>{job.job_title} - {new Date(job.job_start_time).toLocaleDateString()}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="item" className="form-label">Associate with Line Item (Optional)</label>
              <select id="item" className="form-control" value={selectedItem} onChange={e => setSelectedItem(e.target.value)} disabled={!selectedJob}>
                <option value="">-- Select an Item --</option>
                {lineItems.map(item => (
                  <option key={item.id} value={item.id}>{item.description}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="notes" className="form-label">Notes (Optional)</label>
            <textarea id="notes" className="form-control" rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add any relevant notes for these photos..."></textarea>
          </div>
          <div {...getRootProps()} className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700">
            <input {...getInputProps()} />
            {isDragActive ? <p>Drop the files here...</p> : <p>Drag 'n' drop photos here, or click to select files</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Main Photos Component ---
function Photos() {
  const { user } = useAuth();
  if (user?.role === 'admin') return <AdminPhotos />;
  return <CustomerPhotos />;
}

export default Photos;
