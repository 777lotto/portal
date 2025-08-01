import { useState, useEffect, useMemo, useCallback } from 'react';
// Import the new 'api' client.
import { api } from '../lib/api.js';
import { ApiError } from '../lib/fetchJson';
import type { PhotoWithNotes, User, Job, LineItem } from '@portal/shared';
import { useDropzone } from 'react-dropzone';
import { jwtDecode } from 'jwt-decode';

interface UserPayload {
  role: 'customer' | 'admin';
}

// Helper function to handle API responses
async function fetchAndParse<T>(promise: Promise<Response>): Promise<T> {
    const res = await promise;
    if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'An unknown error occurred' }));
        throw new ApiError(errorData.error || `Request failed with status ${res.status}`, res.status);
    }
    return res.json() as Promise<T>;
}

function CustomerPhotos() {
  const [photos, setPhotos] = useState<PhotoWithNotes[]>([]);
  const [filters, setFilters] = useState({
    createdAt: '',
    job_id: '',
    item_id: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPhotos = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const activeFilters = Object.fromEntries(
          Object.entries(filters).filter(([, value]) => value !== '')
        );

        // --- UPDATED ---
        const data = await fetchAndParse<PhotoWithNotes[]>(api.photos.$get({ query: activeFilters }));
        // --- END UPDATE ---

        setPhotos(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPhotos();
  }, [filters]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  if (isLoading) return <p>Loading photos...</p>;
  if (error) return <div className="alert alert-danger">{error}</div>;

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {photos.length > 0 ? (
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
          <p>No photos found matching your criteria.</p>
        )}
      </div>
    </div>
  );
}

function AdminPhotos() {
  const [users, setUsers] = useState<User[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedJob, setSelectedJob] = useState<string>('');
  const [selectedItem, setSelectedItem] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'danger', text: string } | null>(null);

  useEffect(() => {
    fetchAndParse<User[]>(api.admin.users.$get()).then(setUsers);
  }, []);

  useEffect(() => {
    if (selectedUser) {
      fetchAndParse<Job[]>(api.admin.jobs['user'][':user_id'].$get({ param: { user_id: selectedUser } })).then(setJobs);
    } else {
      setJobs([]);
    }
    setSelectedJob('');
  }, [selectedUser]);

  useEffect(() => {
    if (selectedJob) {
      fetchAndParse<LineItem[]>(api.jobs[':id']['line-items'].$get({ param: { id: selectedJob } })).then(setLineItems);
    } else {
      setLineItems([]);
    }
    setSelectedItem('');
  }, [selectedJob]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!selectedUser) {
      setMessage({ type: 'danger', text: 'Please select a user before uploading.' });
      return;
    }
    setMessage(null);
    setIsSubmitting(true);
    try {
      const uploadPromises = acceptedFiles.map(file => {
        const formData = new FormData();
        formData.append('photo', file);
        formData.append('user_id', selectedUser);
        if (selectedJob) formData.append('job_id', selectedJob);
        if (selectedItem) formData.append('item_id', selectedItem);
        if (notes) formData.append('notes', notes);
        // For file uploads, it's often easier to use a dedicated fetch call
        // that is configured to handle multipart/form-data.
        return fetch(`/api/admin/users/${selectedUser}/photos`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`},
          body: formData,
        }).then(res => {
            if (!res.ok) throw new Error('Upload failed');
            return res.json();
        });
      });
      await Promise.all(uploadPromises);
      setMessage({ type: 'success', text: `${acceptedFiles.length} photo(s) uploaded successfully!` });
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
            <select id="user" className="form-control" value={selectedUser} onChange={e => setSelectedUser(e.target.value)} required>
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
                  <option key={job.id} value={job.id}>{job.title} - {new Date(job.start).toLocaleDateString()}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="item" className="form-label">Associate with Line Item (Optional)</label>
              <select id="item" className="form-control" value={selectedItem} onChange={e => setSelectedItem(e.target.value)} disabled={!selectedJob}>
                <option value="">-- Select an Item --</option>
                {lineItems.map(item => (
                  <option key={item.id} value={item.id.toString()}>{item.description}</option>
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

function Photos() {
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const decoded = jwtDecode<UserPayload>(token);
        setUserRole(decoded.role);
      } catch (e) {
        console.error("Invalid token:", e);
      }
    }
  }, []);

  if (userRole === 'admin') return <AdminPhotos />;
  return <CustomerPhotos />;
}

export default Photos;
