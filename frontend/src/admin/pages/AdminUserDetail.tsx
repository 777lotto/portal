import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import useSWR, { mutate } from 'swr';
import { apiGet } from '../../lib/api';
import type { User, Job, Photo, Note } from '@portal/shared';
import AddJobModal from '../modals/AddJobModal';
import EditUserModal from '../modals/EditUserModal'; // Import EditUserModal

const UserTabs = ({ userId, onJobAdded }: { userId: string, onJobAdded: () => void }) => {
    const { data: jobs, isLoading: jobsLoading, error: jobsError } = useSWR<Job[]>(`/api/admin/jobs/user/${userId}`, apiGet);
    const { data: photos, isLoading: photosLoading, error: photosError } = useSWR<Photo[]>(`/api/admin/photos/user/${userId}`, apiGet);
    const { data: notes, isLoading: notesLoading, error: notesError } = useSWR<Note[]>(`/api/admin/notes/user/${userId}`, apiGet);
    const [activeTab, setActiveTab] = useState('jobs');

    const renderJobs = () => (
        <div className="space-y-3">
            {jobsLoading && <p>Loading jobs...</p>}
            {jobsError && <p className="text-red-500">Error loading jobs.</p>}
            {jobs && jobs.length > 0 ? (
                jobs.map(job => (
                    <div key={job.id} className="card p-4 flex justify-between items-center">
                        <div>
                            <Link to={`/admin/jobs/${job.id}`} className="font-semibold text-event-blue hover:underline">{job.title || 'Untitled Job'}</Link>
                            <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">Created: {new Date(job.createdAt).toLocaleDateString()}</p>
                        </div>
                        <span className="text-xs font-semibold uppercase px-2 py-1 rounded-full bg-gray-200 text-gray-800">{job.status.replace(/_/g, ' ')}</span>
                    </div>
                ))
            ) : <div className="card p-4 text-center">No jobs found.</div>}
        </div>
    );

    const renderPhotos = () => (
        <div>
            {photosLoading && <p>Loading photos...</p>}
            {photosError && <p className="text-red-500">Error loading photos.</p>}
            {photos && photos.length > 0 ? (
                 <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {photos.map(photo => (
                        <a key={photo.id} href={photo.url} target="_blank" rel="noopener noreferrer" className="aspect-w-1 aspect-h-1 block">
                            <img src={photo.url} alt="Job photo" className="object-cover w-full h-full rounded-lg shadow-md hover:opacity-80 transition-opacity"/>
                        </a>
                    ))}
                </div>
            ) : <div className="card p-4 text-center">No photos found.</div>}
        </div>
    );

    const renderNotes = () => (
        <div className="space-y-3">
            {notesLoading && <p>Loading notes...</p>}
            {notesError && <p className="text-red-500">Error loading notes.</p>}
            {notes && notes.length > 0 ? (
                notes.map(note => (
                    <div key={note.id} className="card p-4">
                        <p className="text-text-primary-light dark:text-text-primary-dark">{note.content}</p>
                        <small className="text-text-secondary-light dark:text-text-secondary-dark mt-2 block">
                            {new Date(note.createdAt).toLocaleString()}
                        </small>
                    </div>
                ))
            ) : <div className="card p-4 text-center">No notes found.</div>}
        </div>
    );

    return (
        <div className="mt-6">
            <div className="border-b border-border-light dark:border-border-dark">
                <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                    <button className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'jobs' ? 'border-event-blue text-event-blue' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`} onClick={() => setActiveTab('jobs')}>Jobs</button>
                    <button className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'photos' ? 'border-event-blue text-event-blue' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`} onClick={() => setActiveTab('photos')}>Photos</button>
                    <button className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'notes' ? 'border-event-blue text-event-blue' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`} onClick={() => setActiveTab('notes')}>Notes</button>
                </nav>
            </div>
            <div className="pt-6">
                {activeTab === 'jobs' && renderJobs()}
                {activeTab === 'photos' && renderPhotos()}
                {activeTab === 'notes' && renderNotes()}
            </div>
        </div>
    );
};


const AdminUserDetail = () => {
  const { user_id } = useParams<{ user_id: string }>();
  const [isAddJobModalOpen, setAddJobModalOpen] = useState(false);
  const [isEditUserModalOpen, setEditUserModalOpen] = useState(false); // State for edit user modal

  const { data: user, error, isLoading, mutate: mutateUser } = useSWR<User>(user_id ? `/api/admin/users/${user_id}` : null, apiGet);

  const handleJobAdded = () => {
    mutate(`/api/admin/jobs/user/${user_id}`); // Re-fetch jobs list
  };

  const handleUserUpdated = (updatedUser: User) => {
    mutateUser(updatedUser, false); // Optimistically update user data
    setEditUserModalOpen(false);
  };

  if (isLoading) return <div className="p-4 text-center">Loading user details...</div>;
  if (error || !user) return <div className="p-4"><div className="alert alert-danger">Error loading user data. {(error as any)?.message || 'User not found.'}</div></div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Modals */}
      {isAddJobModalOpen && (
        <AddJobModal
          isOpen={isAddJobModalOpen}
          onClose={() => setAddJobModalOpen(false)}
          onSave={handleJobAdded}
          selectedDate={new Date()}
          initialSelectedUserId={user.id.toString()} // Pass the user ID to the modal
        />
      )}
      {isEditUserModalOpen && (
        <EditUserModal
          isOpen={isEditUserModalOpen}
          onClose={() => setEditUserModalOpen(false)}
          user={user}
          onUserUpdated={handleUserUpdated}
        />
      )}

      {/* User Header Card */}
      <div className="card mt-4">
        <div className="card-body">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold text-text-primary-light dark:text-text-primary-dark">{user.company_name || user.name}</h1>
                    <p className="mt-1 text-text-secondary-light dark:text-text-secondary-dark">{user.email} | {user.phone}</p>
                    <p className="mt-1 text-sm text-text-secondary-light dark:text-text-secondary-dark">{user.address}</p>
                </div>
                <div className="flex space-x-2">
                     <button className="btn btn-secondary" onClick={() => setEditUserModalOpen(true)}>
                        Edit User
                    </button>
                    <button className="btn btn-primary" onClick={() => setAddJobModalOpen(true)}>
                        Add Job
                    </button>
                </div>
            </div>
        </div>
      </div>

      {/* Tabs for Jobs, Photos, Notes */}
      {user_id && <UserTabs userId={user_id} onJobAdded={handleJobAdded} />}
    </div>
  );
};

export default AdminUserDetail;
