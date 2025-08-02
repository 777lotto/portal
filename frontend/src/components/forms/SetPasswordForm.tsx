// frontend/src/components/forms/SetPasswordForm.tsx
import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { HTTPError } from 'hono/client';

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

  if (!passwordSetToken) {
    return (
        <div className="container mt-5">
            <div className="alert alert-danger">
                Invalid session. Please <Link to="/forgot-password">start the password reset process</Link> again.
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
      const response = await api['set-password'].$post({ json: { password } }, {
        headers: { Authorization: `Bearer ${passwordSetToken}` }
      });
      setToken(response.token);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
        if (err instanceof HTTPError) {
            const errorJson = await err.response.json().catch(() => ({}));
            setError(errorJson.error || 'Failed to set password');
        } else {
            setError('An unexpected error occurred.');
        }
    } finally {
      setIsLoading(false); // Changed from true to false
    }
  };

  return (
    // ... JSX is unchanged ...
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
