// frontend/src/components/forms/SetPasswordForm.tsx

import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
// Import the new 'api' client
import { api } from '../../lib/api';
import { ApiError } from '../../lib/fetchJson';

interface Props {
  setToken: (token: string) => void;
}

function SetPasswordForm({ setToken }: Props) {
  const navigate = useNavigate();
  const location = useLocation();

  const passwordSetToken = location.state?.passwordSetToken;

  const [password, setPasswordState] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // If the user lands here without a token, redirect them.
  if (!passwordSetToken) {
    // We can't call navigate directly in the render body.
    // A simple solution is to return null and let an effect handle the redirect.
    // Or for this case, just show an error.
    return (
        <div className="container mt-5">
            <div className="alert alert-danger">
                Invalid session. Please start the password reset process again.
            </div>
        </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setError(null);
    setIsLoading(true);

    try {
      // --- UPDATED ---
      // Use the Hono RPC client to set the password.
      // The passwordSetToken is sent as a Bearer token in the header.
      const res = await api['set-password'].$post({ json: { password } }, {
        headers: {
          Authorization: `Bearer ${passwordSetToken}`
        }
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new ApiError(errorData.error || 'Failed to set password', res.status);
      }

      const response = await res.json();
      // --- END UPDATE ---

      setToken(response.token);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'An unexpected error occurred.');
    } finally {
      setIsLoading(true);
    }
  };

  // No changes needed to the JSX render logic below
  return (
    <div className="container mt-5">
      <div className="row justify-content-center">
        <div className="col-md-6">
          <div className="card">
            <div className="card-body">
              <h3 className="card-title text-center">Set Your New Password</h3>
              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label htmlFor="password">New Password</label>
                  <input type="password" id="password" value={password} onChange={e => setPasswordState(e.target.value)} className="form-control" required minLength={8} />
                </div>
                 <div className="mb-3">
                  <label htmlFor="confirmPassword">Confirm New Password</label>
                  <input type="password" id="confirmPassword" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="form-control" required />
                </div>
                {error && <div className="alert alert-danger">{error}</div>}
                <div className="d-grid">
                  <button type="submit" className="btn btn-primary" disabled={isLoading}>
                    {isLoading ? 'Saving...' : 'Set Password and Login'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SetPasswordForm;
