// frontend/src/pages/admin/UserNotesPage.tsx
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
// Import the new 'api' client.
import { api } from '../../lib/api';
import type { Note } from '@portal/shared';

// --- React Query Fetcher ---
const fetchUserNotes = async (userId: string) => {
  const res = await api.admin.notes.user[':user_id'].$get({ param: { user_id: userId } });
  if (!res.ok) throw new Error('Failed to fetch user notes');
  return res.json();
};

const UserNotesPage = () => {
  const { user_id } = useParams<{ user_id: string }>();

  // --- UPDATED ---
  const { data: notes, isLoading, error } = useQuery<Note[]>({
    queryKey: ['userNotes', user_id],
    queryFn: () => fetchUserNotes(user_id!),
    enabled: !!user_id,
  });
  // --- END UPDATE ---

  if (isLoading) return <div>Loading notes...</div>;
  if (error) return <div>Error: {(error as Error).message}</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Notes for User</h1>
      {/* Placeholder for your notes list component */}
      <pre>{JSON.stringify(notes, null, 2)}</pre>
    </div>
  );
};

export default UserNotesPage;
