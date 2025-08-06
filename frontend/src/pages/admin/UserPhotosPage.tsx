import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { adminGetUserPhotos } from '../../lib/api';
import { Photo } from '@portal/shared';

function UserPhotosPage() {
  const { userId } = useParams<{ userId: string }>();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userId) {
      const fetchPhotos = async () => {
        try {
          setIsLoading(true);
          const userPhotos = await adminGetUserPhotos(userId);
          setPhotos(userPhotos);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'An unknown error occurred.');
        } finally {
          setIsLoading(false);
        }
      };
      fetchPhotos();
    }
  }, [userId]);

  if (isLoading) {
    return <div className="text-center p-4">Loading photos...</div>;
  }

  if (error) {
    return <div className="text-center p-4 text-red-500">Error: {error}</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Photos for User {userId}</h1>
      {photos.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {photos.map(photo => (
            <div key={photo.id} className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
              <img src={photo.url} alt={`User upload`} className="w-full h-48 object-cover" />
              <div className="p-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Uploaded on: {new Date(photo.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-center text-gray-500">No photos found for this user.</p>
      )}
    </div>
  );
}

export default UserPhotosPage;
