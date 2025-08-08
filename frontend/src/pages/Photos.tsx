import { useState, useEffect, useMemo } from 'react';
import { getPhotos } from '../lib/api';
import type { PhotoWithNotes } from '@portal/shared';
import { Link } from 'react-router-dom';

function Photos() {
  const [photos, setPhotos] = useState<PhotoWithNotes[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch all photos for the logged-in customer
    const fetchPhotos = async () => {
      try {
        setIsLoading(true);
        setError(null);
        // The getPhotos function for customers doesn't need filters
        const data = await getPhotos();
        // Sort photos by most recent first
        const sortedData = data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setPhotos(sortedData);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPhotos();
  }, []);

  // Group photos by their associated job_id
  const photosByJob = useMemo(() => {
    const grouped: { [key: string]: { title: string, photos: PhotoWithNotes[] } } = {};
    photos.forEach(photo => {
      const key = photo.job_id?.toString() || 'general';
      if (!grouped[key]) {
        grouped[key] = {
          title: photo.job_title || 'General Photos',
          photos: []
        };
      }
      grouped[key].photos.push(photo);
    });
    return grouped;
  }, [photos]);


  if (isLoading) return <p>Loading photos...</p>;
  if (error) return <div className="alert alert-danger">{error}</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
      <h1 className="text-3xl font-bold mb-6">Your Photos</h1>
      {Object.keys(photosByJob).length === 0 && !isLoading && (
          <div className="text-center py-12">
            <p className="text-gray-500">You do not have any photos in your account yet.</p>
          </div>
      )}
      {Object.entries(photosByJob).map(([jobId, group]) => {
        if (group.photos.length === 0) return null;

        return (
          <div key={jobId} className="mb-8">
            <h2 className="text-2xl font-semibold mb-4 border-b pb-2">
              {jobId !== 'general' ? <Link to={`/jobs/${jobId}`} className="hover:underline">{group.title}</Link> : group.title}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {group.photos.map(photo => (
                <div key={photo.id} className="card overflow-hidden group shadow-lg">
                  <a href={photo.url} target="_blank" rel="noopener noreferrer" className="block h-48">
                    <img
                      src={photo.url}
                      alt={`Photo from ${new Date(photo.createdAt).toLocaleDateString()}`}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                    />
                  </a>
                   {(photo.notes && photo.notes.length > 0) &&
                    <div className="p-2 text-xs bg-gray-100 dark:bg-gray-800">
                      <p className="font-semibold">Notes:</p>
                      <p className="truncate" title={photo.notes[0].content}>{photo.notes[0].content}</p>
                    </div>
                   }
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  );
}

export default Photos;
