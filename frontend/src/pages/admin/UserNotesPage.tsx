// frontend/src/pages/UserNotesPage.tsx
import { useRouter } from 'next/router';
import { useQuery } from 'react-query';
import { API } from '../../lib/api';

// You can build out a real NotesList component later
// import NotesList from '../../../../components/NotesList';

const UserNotesPage = () => {
  const router = useRouter();
  const { id } = router.query;

  // Update the API endpoint here
  const { data: notes, isLoading } = useQuery(['userNotes', id], () =>
    API.get(`/admin/notes/user/${id}`)
  );

  if (isLoading) {
    return <div>Loading notes...</div>;
  }

  return (
    <div>
      <h1>User Notes</h1>
       {/* Placeholder for your notes list component */}
      <pre>{JSON.stringify(notes, null, 2)}</pre>
    </div>
  );
};

export default UserNotesPage;
