// frontend/src/components/SetPasswordForm.tsx

import { useState } from 'react';
// MODIFIED: Remove useSearchParams, add useLocation
import { useNavigate, useLocation } from 'react-router-dom';
// MODIFIED: Remove getUserFromResetToken
import { setPassword } from '../lib/api';
import { ApiError } from '../lib/fetchJson';

interface Props {
  setToken: (token: string) => void;
}

function SetPasswordForm({ setToken }: Props) {
  const navigate = useNavigate();
  const location = useLocation(); // MODIFIED: Use location to get state

  // MODIFIED: The passwordSetToken comes from the previous step
  const passwordSetToken = location.state?.passwordSetToken;

  const [password, setPasswordState] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // If the user lands here without a token, redirect them.
  if (!passwordSetToken) {
    navigate('/login', { replace: true });
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
      // MODIFIED: Pass password and the special token to the API
      const response = await setPassword(password, passwordSetToken);
      setToken(response.token);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  // MODIFIED: The form is much simpler now. We don't need to load user info.
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
