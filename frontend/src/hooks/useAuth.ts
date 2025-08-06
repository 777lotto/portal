// frontend/src/hooks/useAuth.ts
import { useState, useEffect, useCallback } from 'react';

/**
 * A custom hook to manage user authentication state.
 * It handles the auth token in localStorage and provides a loading state.
 */
export function useAuth() {
  // State for the auth token. Initial value is null.
  const [token, setTokenState] = useState<string | null>(null);
  // State to indicate if the auth check is in progress.
  const [loading, setLoading] = useState(true);

  // Effect to run on initial component mount.
  // It checks for a token in localStorage.
  useEffect(() => {
    try {
      // Attempt to retrieve the token from localStorage.
      const storedToken = localStorage.getItem('token');
      if (storedToken) {
        // If a token is found, update the state.
        setTokenState(storedToken);
      }
    } catch (error) {
      // Log any errors, e.g., if localStorage is not available.
      console.error('Failed to retrieve token from localStorage', error);
    } finally {
      // The loading process is complete.
      setLoading(false);
    }
  }, []);

  // A memoized function to update the token state and localStorage.
  const setToken = useCallback((newToken: string | null) => {
    setTokenState(newToken);
    if (newToken) {
      // If a new token is provided, store it.
      localStorage.setItem('token', newToken);
    } else {
      // If the new token is null, remove it from storage.
      localStorage.removeItem('token');
    }
  }, []);

  // Return the token, the function to set it, and the loading state.
  return { token, setToken, loading };
}
