import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { HTTPException } from 'hono/http-exception';
import type { User } from '@portal/shared';
import { useQuery } from '@tanstack/react-query';

export function useAuth() {
  // State for the token remains, as it's driven by localStorage, not a server query.
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));

  // This effect listens for cross-tab token changes (e.g., login/logout in another tab).
  useEffect(() => {
    const handleStorageChange = () => {
      setToken(localStorage.getItem('token'));
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // --- Refactored Data Fetching with TanStack Query ---
  // useQuery now manages fetching the user profile based on the token.
  // It handles caching, background refetching, and loading/error states automatically.
  const { data: user, isLoading, error, isError } = useQuery<User, Error>({
    // The query is uniquely identified by 'profile' and the current 'token'.
    // If the token changes, TanStack Query will automatically refetch the data.
    queryKey: ['profile', token],

    // The query function to execute.
    queryFn: async () => {
      // The Hono client directly returns the parsed JSON on success
      // or throws an HTTPException on failure.
      const profileData = await api.profile.$get();
      return profileData;
    },

    // The query will only run if a token exists.
    enabled: !!token,

    // Don't retry on authentication errors (401). It's an expected state,
    // not a temporary network failure.
    retry: (failureCount, err) => {
      if (err instanceof HTTPException && err.response.status === 401) {
        return false;
      }
      // Use default retry behavior for other errors (e.g., network issues)
      return failureCount < 3;
    },

    // Stale time can be configured to prevent refetching on every window focus
    // if the user session is considered stable for a period.
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // If the query fails (e.g., with a 401), the user is effectively logged out.
  // We return `null` for the user in that case.
  const authenticatedUser = isError ? null : user;

  return {
    user: authenticatedUser,
    isLoading,
    error,
    token,
    // A convenient boolean flag
    isAuthenticated: !isLoading && !!authenticatedUser
  };
}
