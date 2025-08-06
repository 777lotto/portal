import React, { useState, useEffect } from 'react';
import { fetchJson } from '../../lib/fetchJson';
import { useAuth } from '../../hooks/useAuth';
import type { User, Photo, ChatMessage } from '@portal/shared';

interface ChatPhotoSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPhotoSelect: (attachment: ChatMessage['attachment']) => void;
  chatUser: User; // The user the chat is with
}

const ChatPhotoSelectorModal: React.FC<ChatPhotoSelectorModalProps> = ({ isOpen, onClose, onPhotoSelect, chatUser }) => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { user: currentUser } = useAuth();

  useEffect(() => {
    if (isOpen && currentUser) {
      const fetchPhotos = async () => {
        setIsLoading(true);
        try {
          // Determine the correct API endpoint based on the user's role
          const url = currentUser.role === 'admin'
            ? `/api/admin/users/${chatUser.id}/photos`
            : `/api/customer/photos`;

          const response = await fetchJson<{ success: boolean; photos?: Photo[] }>(url);
          if (response.success && response.photos) {
            setPhotos(response.photos);
          }
        } catch (error) {
          console.error("Failed to fetch photos:", error);
          setPhotos([]);
        } finally {
          setIsLoading(false);
        }
      };
      fetchPhotos();
    }
  }, [isOpen, currentUser, chatUser]);

  if (!isOpen) {
    return null;
  }

  const handleSelectPhoto = (photo: Photo) => {
    // Find the public variant of the image
    const publicVariant = photo.variants.find(v => v.endsWith('/public')) || photo.variants[0];
    if (publicVariant) {
      onPhotoSelect({
        url: publicVariant,
        fileName: photo.filename,
        fileType: 'image/jpeg', // Assuming image/jpeg, as the API doesn't provide a mime type
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[60]">
      <div className="card w-full max-w-3xl h-[85vh] flex flex-col bg-base-100 shadow-xl">
        <div className="card-header flex justify-between items-center p-4 border-b">
          <h5 className="card-title text-xl">Select a Photo</h5>
          <button onClick={onClose} className="btn btn-sm btn-circle btn-ghost">✕</button>
        </div>
        <div className="card-body overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex justify-center items-center h-full">
              <span className="loading loading-spinner loading-lg"></span>
            </div>
          ) : (
            <>
              {photos.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {photos.map((photo) => (
                    <div key={photo.id} className="cursor-pointer group relative" onClick={() => handleSelectPhoto(photo)}>
                       <img
                        src={photo.variants.find(v => v.endsWith('/public')) || photo.variants[0]}
                        alt={photo.filename}
                        className="w-full h-32 object-cover rounded-lg shadow-md transition-all duration-300 group-hover:scale-105 group-hover:shadow-lg"
                        />
                         <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 flex items-center justify-center transition-opacity duration-300">
                            <p className="text-white text-center text-xs p-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300 break-all">{photo.filename}</p>
                        </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex justify-center items-center h-full">
                    <p className="text-base-content-secondary">No photos found.</p>
                </div>
              )}
            </>
          )}
        </div>
        <div className="card-footer p-4 border-t">
          <button onClick={onClose} className="btn w-full sm:w-auto">Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default ChatPhotoSelectorModal;
