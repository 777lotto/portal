import { useState, useEffect } from 'react';
// Import the new 'api' client instead of the old 'getProfile' function
import { api } from '../lib/api';
import type { User } from '@portal/shared';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // The token state is still useful for triggering the effect
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    // This effect simply checks for the token's existence
    const t = localStorage.getItem('token');
    setToken(t);
  }, []);

  useEffect(() => {
    const loadUser = async () => {
      // We only try to fetch the user if a token exists
      if (token) {
        try {
          // Use the new Hono RPC client to fetch the profile
          const res = await api.profile.$get();

          // Check if the request was successful
          if (!res.ok) {
            // The custom fetchJson will handle 401 redirects,
            // but we can still catch other errors here.
            throw new Error(`Server responded with status ${res.status}`);
          }

          // Parse the JSON from the response
          const profileData = await res.json();
          setUser(profileData);
        } catch (err: any) {
          // The error might come from fetchJson (e.g., 401 redirect)
          // or from the check above. We'll clear the user state.
          console.error("Auth Error:", err.message);
          setUser(null);
          // Don't set a generic error message if it's a 401,
          // as a redirect will happen.
          if (err.status !== 401) {
             setError('Failed to load your profile.');
          }
        } finally {
          setIsLoading(false);
        }
      } else {
        // If there's no token, we're done loading and there's no user.
        setIsLoading(false);
      }
    };
    loadUser();
  }, [token]); // This effect re-runs when the token changes (e.g., on login/logout)

  return { user, isLoading, error, token };
}
