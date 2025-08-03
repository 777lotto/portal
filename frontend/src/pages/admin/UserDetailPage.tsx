import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../lib/api';
import type { User } from '@portal/shared';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { HTTPException } from 'hono/http-exception';

/**
 * A helper function to extract a user-friendly error message from various error types.
 * @param error The error object, which can be an HTTPException, Error, or unknown.
 * @returns A promise that resolves to a string containing the error message.
 */
const getErrorMessage = async (error: unknown): Promise<string> => {
  if (error instanceof HTTPException) {
    try {
      // Attempt to parse the JSON body of the HTTP response for a detailed message.
      const data = await error.response.json();
      return data.message || data.error || 'An unexpected error occurred.';
    } catch (e) {
      // Fallback if the response body isn't valid JSON.
      return 'An unexpected error occurred parsing the error response.';
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unknown error occurred.';
};


export function UserDetailPage() {
  const { user_id } = useParams<{ user_id: string }>();
  const queryClient = useQueryClient();

  // State for controlled form inputs.
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  // State for displaying success or error messages to the user.
  const [message, setMessage] = useState<{ type: 'success' | 'danger'; text: string } | null>(null);

  // --- Data Fetching with TanStack Query ---
  // useQuery handles fetching, caching, and state management for the user data.
  const { data: user, isLoading, error: queryError } = useQuery<User, Error>({
    queryKey: ['admin', 'user', user_id],
    queryFn: async () => {
      if (!user_id) throw new Error("User ID is required");
      const res = await api.admin.users[':user_id'].$get({ param: { user_id } });
      if (!res.ok) {
        // Wrap non-ok responses in HTTPException to be handled by our error logic.
        throw new HTTPException(res.status, { res });
      }
      const data = await res.json();
      return data.user;
    },
    enabled: !!user_id, // The query will not run until the user_id is available.
  });

  // --- Data Mutation with TanStack Query ---
  // useMutation handles the state for the update operation (loading, error, success).
  const { mutate: updateUser, isPending: isUpdating } = useMutation({
    mutationFn: (updatedUserData: { email: string; phone: string; address: string }) => {
      if (!user_id) throw new Error("User ID is required");
      // The API call to update the user.
      return api.admin.users[':user_id'].$put({
        param: { user_id },
        json: updatedUserData,
      });
    },
    onSuccess: async (res) => {
      if (!res.ok) {
        // Handle cases where the API returns a non-2xx status code on mutation.
        throw new HTTPException(res.status, { res });
      }
      setMessage({ type: 'success', text: 'User updated successfully!' });
      // Invalidate the user query to trigger a refetch of the latest data.
      await queryClient.invalidateQueries({ queryKey: ['admin', 'user', user_id] });
    },
    onError: async (err) => {
        // On failure, extract and display an error message.
        const text = await getErrorMessage(err);
        setMessage({ type: 'danger', text });
    },
  });

  // Effect to populate the form fields once the user data is successfully fetched.
  useEffect(() => {
    if (user) {
      setEmail(user.email ?? '');
      setPhone(user.phone ?? '');
      setAddress(user.address ?? '');
      setMessage(null); // Clear any previous messages on data load
    }
  }, [user]);

  // Effect to display an error message if the initial data fetch fails.
  useEffect(() => {
    if (queryError) {
        getErrorMessage(queryError).then(text => setMessage({ type: 'danger', text }));
    }
  }, [queryError]);

  // Form submission handler.
  const handleUpdateUser = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null); // Clear previous messages before submitting.
    updateUser({ email, phone, address });
  };

  // Display a loading spinner while the initial data is being fetched.
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  // Display an error and a way back if the user could not be found or an error occurred.
  if (!user) {
    return (
        <div className="container mx-auto p-4 text-center">
            <h1 className="text-2xl font-bold mb-4">User Not Found</h1>
            {message && (
                <div className={`alert alert-${message.type} shadow-lg max-w-md mx-auto`}>
                    <div>
                        <span>{message.text}</span>
                    </div>
                </div>
            )}
             <Link to="/admin/users" className="btn btn-primary mt-4">Back to Users List</Link>
        </div>
    );
  }

  // --- Render the main component ---
  return (
    <div className="container mx-auto p-4">
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="card-title text-2xl">{user.name}</h1>
              <p className="text-gray-500">{user.email}</p>
            </div>
            <Link to="/admin/users" className="btn btn-ghost">Back to Users</Link>
          </div>

          {message && (
            <div className={`alert alert-${message.type} shadow-lg mt-4`}>
              <div>
                <span>{message.text}</span>
              </div>
            </div>
          )}

          <div className="divider">Update Details</div>

          <form onSubmit={handleUpdateUser} className="space-y-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text">Email</span>
              </label>
              <input
                type="email"
                placeholder="Email"
                className="input input-bordered"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text">Phone</span>
              </label>
              <input
                type="tel"
                placeholder="Phone"
                className="input input-bordered"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text">Address</span>
              </label>
              <textarea
                className="textarea textarea-bordered"
                placeholder="Address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              ></textarea>
            </div>
            <div className="card-actions justify-end">
              <button type="submit" className="btn btn-primary" disabled={isUpdating}>
                {isUpdating && <span className="loading loading-spinner"></span>}
                Update User
              </button>
            </div>
          </form>

          <div className="divider">Manage User</div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            <div className="card bg-gray-50 dark:bg-gray-800">
              <div className="card-body">
                <h2 className="card-title">Jobs & Quotes</h2>
                <p>View, edit, or create new jobs and quotes for this user.</p>
                <div className="justify-end card-actions">
                  <Link to={`/admin/users/${user.id}/jobs`} className="btn btn-primary">Manage Jobs</Link>
                </div>
              </div>
            </div>
            <div className="card bg-gray-50 dark:bg-gray-800">
              <div className="card-body">
                <h2 className="card-title">Photos</h2>
                <p>View or upload photos associated with this user's jobs.</p>
                <div className="justify-end card-actions">
                  <Link to={`/admin/users/${user.id}/photos`} className="btn btn-primary">Manage Photos</Link>
                </div>
              </div>
            </div>
            <div className="card bg-gray-50 dark:bg-gray-800">
              <div className="card-body">
                <h2 className="card-title">Notes</h2>
                <p>View or add internal notes for this user.</p>
                <div className="justify-end card-actions">
                  <Link to={`/admin/users/${user.id}/notes`} className="btn btn-primary">Manage Notes</Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
