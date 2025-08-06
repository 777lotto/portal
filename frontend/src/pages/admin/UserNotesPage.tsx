import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { adminGetUserNotes, adminAddUserNote } from '../../lib/api';
import { Note } from '@portal/shared';

function UserNotesPage() {
  const { userId } = useParams<{ userId: string }>();
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNotes = async () => {
    if (userId) {
      try {
        setIsLoading(true);
        const userNotes = await adminGetUserNotes(userId);
        setNotes(userNotes);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchNotes();
  }, [userId]);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (userId && newNote.trim()) {
      try {
        await adminAddUserNote(userId, newNote);
        setNewNote('');
        fetchNotes(); // Refresh notes list
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to add note.');
      }
    }
  };

  if (isLoading) {
    return <div className="text-center p-4">Loading notes...</div>;
  }

  if (error) {
    return <div className="text-center p-4 text-red-500">Error: {error}</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Notes for User {userId}</h1>

      <form onSubmit={handleAddNote} className="mb-6">
        <textarea
          className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
          rows={4}
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Add a new note..."
        />
        <button
          type="submit"
          className="mt-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
        >
          Add Note
        </button>
      </form>

      <div className="space-y-4">
        {notes.length > 0 ? (
          notes.map(note => (
            <div key={note.id} className="bg-white dark:bg-gray-800 p-4 shadow-md rounded-lg">
              <p>{note.content}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                - {new Date(note.created_at).toLocaleString()}
              </p>
            </div>
          ))
        ) : (
          <p className="text-center text-gray-500">No notes found for this user.</p>
        )}
      </div>
    </div>
  );
}

export default UserNotesPage;
