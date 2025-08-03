// frontend/src/pages/admin/UserNotesPage.tsx
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Note } from '@portal/shared';

/**
 * REFACTORED: The data-fetching function for React Query.
 * It now correctly unwraps the enveloped response from the API.
 */
const fetchUserNotes = async (userId: string) => {
  const res = await api.admin.notes.user[':user_id'].$get({ param: { user_id: userId } });
    if (!res.ok) {
        throw new Error('Failed to fetch user notes');
    }
    const data = await res.json();
    return data.notes;
};

/**
 * REFACTORED: The page now displays notes in a user-friendly list.
 * This replaces the previous raw JSON view.
 */
const UserNotesPage = () => {
  const { user_id } = useParams<{ user_id: string }>();
  const { data: notes, isLoading, error } = useQuery<Note[]>({
    queryKey: ['userNotes', user_id],
    queryFn: () => fetchUserNotes(user_id!),
    enabled: !!user_id,
  });

  if (isLoading) return <div>Loading notes...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Notes for User</h1>
      <div className="space-y-4">
        {notes?.map(note => (
            <div key={note.id} className="card bg-base-100 shadow-md">
                <div className="card-body">
                    <p>{note.content}</p>
                    <div className="text-xs text-gray-500 mt-2 text-right">
                        <span>Noted on {new Date(note.createdAt).toLocaleString()}</span>
                        {note.job_id && <span> for Job ID: {note.job_id}</span>}
                    </div>
                </div>
            </div>
        ))}
        {notes?.length === 0 && (
            <p>No notes found for this user.</p>
        )}
      </div>
    </div>
  );
};

export default UserNotesPage;
