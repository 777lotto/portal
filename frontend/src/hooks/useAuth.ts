
import { useState, useEffect } from 'react';
import { getProfile } from '../lib/api';
import type { User } from '@portal/shared';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const t = localStorage.getItem('token');
    setToken(t);
  }, []);

  useEffect(() => {
    const loadUser = async () => {
      if (token) {
        try {
          const profileData = await getProfile();
          setUser(profileData);
        } catch (err: any) {
          setError('Failed to load your profile. Please try again.');
        } finally {
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
    };
    loadUser();
  }, [token]);

  return { user, isLoading, error, token };
}
