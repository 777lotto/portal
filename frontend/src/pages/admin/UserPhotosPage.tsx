// frontend/src/pages/admin/UserPhotosPage.tsx
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Photo } from '@portal/shared';

/**
 * REFACTORED: The data-fetching function for React Query.
 * It now correctly unwraps the enveloped response from the API.
 */
const fetchUserPhotos = async (userId: string) => {
  const res = await api.admin.photos.user[':user_id'].$get({ param: { user_id: userId } });
  if (!res.ok) {
    throw new Error('Failed to fetch user photos');
  }
  const data = await res.json();
  return data.photos;
};

const UserPhotosPage = () => {
  const { user_id } = useParams<{ user_id: string }>();
  const { data: photos, isLoading, error } = useQuery<Photo[]>({
    queryKey: ['userPhotos', user_id],
    queryFn: () => fetchUserPhotos(user_id!),
    enabled: !!user_id,
  });

  if (isLoading) return <div>Loading photos...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Photos for User</h1>
      {photos && photos.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {photos.map(photo => (
                <a key={photo.id} href={photo.url} target="_blank" rel="noopener noreferrer" className="card card-compact bg-base-100 shadow-xl image-full">
                    <figure><img src={photo.url} alt={`Job photo taken on ${new Date(photo.createdAt).toLocaleDateString()}`} className="object-cover w-full h-full"/></figure>
                    <div className="card-body justify-end opacity-0 hover:opacity-100 transition-opacity duration-300">
                        <p className="text-white text-xs">Job ID: {photo.job_id}</p>
                        <p className="text-white text-xs">Uploaded: {new Date(photo.createdAt).toLocaleDateString()}</p>
                    </div>
                </a>
            ))}
        </div>
      ) : (
        <p>No photos found for this user.</p>
      )}
    </div>
  );
};

export default UserPhotosPage;
