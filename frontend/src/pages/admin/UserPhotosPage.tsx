// frontend/src/pages/admin/UserPhotosPage.tsx
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
// Import the new 'api' client.
import { api } from '../../lib/api';
import type { Photo } from '@portal/shared';

// --- React Query Fetcher ---
const fetchUserPhotos = async (userId: string) => {
  const res = await api.admin.photos.user[':user_id'].$get({ param: { user_id: userId } });
  if (!res.ok) throw new Error('Failed to fetch user photos');
  return res.json();
};

const UserPhotosPage = () => {
  const { user_id } = useParams<{ user_id: string }>();

  // --- UPDATED ---
  const { data: photos, isLoading, error } = useQuery<Photo[]>({
    queryKey: ['userPhotos', user_id],
    queryFn: () => fetchUserPhotos(user_id!),
    enabled: !!user_id,
  });
  // --- END UPDATE ---

  if (isLoading) return <div>Loading photos...</div>;
  if (error) return <div>Error: {(error as Error).message}</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Photos for User</h1>
      {/* Placeholder for your photo gallery component */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {photos?.map(photo => (
            <a key={photo.id} href={photo.url} target="_blank" rel="noopener noreferrer">
                <img src={photo.url} alt={`Job photo taken on ${new Date(photo.createdAt).toLocaleDateString()}`} className="rounded-lg object-cover aspect-square"/>
            </a>
        ))}
      </div>
    </div>
  );
};

export default UserPhotosPage;
