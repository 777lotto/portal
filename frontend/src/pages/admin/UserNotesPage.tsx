// frontend/src/pages/admin/UserNotesPage.tsx
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Note } from '@portal/shared';

const fetchUserNotes = ({ queryKey }: { queryKey: [string, string | undefined] }) => {
  const [_key, userId] = queryKey;
  if (!userId) throw new Error('User ID is required');
  return api.admin.notes.user[':user_id'].$get({ param: { user_id: userId } });
};

const UserNotesPage = () => {
  const { user_id } = useParams<{ user_id: string }>();
  const { data: notes, isLoading, error } = useQuery<Note[]>({
    queryKey: ['userNotes', user_id],
    queryFn: fetchUserNotes,
    enabled: !!user_id,
  });

  if (isLoading) return <div>Loading notes...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Notes for User</h1>
      <pre>{JSON.stringify(notes, null, 2)}</pre>
    </div>
  );
};

export default UserNotesPage;
