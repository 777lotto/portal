// frontend/src/pages/UserPhotosPage.tsx
import { useRouter } from 'next/router';
import { useQuery } from 'react-query';
import { API } from '../../lib/api';

// You can build out a real PhotoGallery component later
// import PhotoGallery from '../../../../components/PhotoGallery';

const UserPhotosPage = () => {
  const router = useRouter();
  const { id } = router.query;

  // Update the API endpoint here
  const { data: photos, isLoading } = useQuery(['userPhotos', id], () =>
    API.get(`/admin/photos/user/${id}`)
  );

  if (isLoading) {
    return <div>Loading photos...</div>;
  }

  return (
    <div>
      <h1>User Photos</h1>
      {/* Placeholder for your photo gallery component */}
      <pre>{JSON.stringify(photos, null, 2)}</pre>
    </div>
  );
};

export default UserPhotosPage;
