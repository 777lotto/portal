import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { HTTPException } from 'hono/http-exception';
import type { User } from '@portal/shared';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token')); // Initialize from localStorage

  // This effect will run whenever the token changes in localStorage,
  // allowing other components to trigger re-authentication.
  useEffect(() => {
    const handleStorageChange = () => {
      setToken(localStorage.getItem('token'));
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  useEffect(() => {
    const loadUser = async () => {
      if (token) {
        try {
          // The Hono client directly returns the parsed JSON on success
          // or throws an HTTPException on failure.
          const profileData = await api.profile.$get();
          setUser(profileData);
          setError(null); // Clear any previous errors
        } catch (err) {
          // If the token is invalid, the API will return a 401, which Hono
          // throws as an HTTPException. We catch it here and clear the user state.
          console.error("Authentication Error:", err);
          setUser(null);
          // We don't set a user-facing error because this is an expected state
          // when a token is expired or invalid. The UI will handle the redirect.
          if (err instanceof HTTPException && err.response.status !== 401) {
             setError('Failed to load your profile.');
          }
        } finally {
          setIsLoading(false);
        }
      } else {
        // No token, so no user is logged in.
        setUser(null);
        setIsLoading(false);
      }
    };
    loadUser();
  }, [token]); // This effect re-runs when the token state changes.

  return { user, isLoading, error, token };
}
