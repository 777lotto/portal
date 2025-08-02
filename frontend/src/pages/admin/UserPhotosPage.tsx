// frontend/src/pages/admin/UserPhotosPage.tsx
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Photo } from '@portal/shared';

const fetchUserPhotos = ({ queryKey }: { queryKey: [string, string | undefined] }) => {
  const [_key, userId] = queryKey;
  if (!userId) throw new Error('User ID is required');
  return api.admin.photos.user[':user_id'].$get({ param: { user_id: userId } });
};

const UserPhotosPage = () => {
  const { user_id } = useParams<{ user_id: string }>();
  const { data: photos, isLoading, error } = useQuery<Photo[]>({
    queryKey: ['userPhotos', user_id],
    queryFn: fetchUserPhotos,
    enabled: !!user_id,
  });

  if (isLoading) return <div>Loading photos...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Photos for User</h1>
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
