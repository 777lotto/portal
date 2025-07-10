// frontend/src/components/SetPasswordForm.tsx
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getUserFromResetToken, setPassword } from '../lib/api';
import { ApiError } from '../lib/fetchJson';

interface Props {
  setToken: (token: string) => void;
}

function SetPasswordForm({ setToken }: Props) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [token, setTokenInternal] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const resetToken = searchParams.get('token');
    if (!resetToken) {
      setError('No password reset token found in the URL. Please check the link and try again.');
      setIsLoading(false);
      return;
    }
    setTokenInternal(resetToken);

    const fetchUser = async () => {
      try {
        const userData = await getUserFromResetToken(resetToken);
        setName(userData.name);
        setEmail(userData.email);
        setPhone(userData.phone || '');
      } catch (err: any) {
        setError(err.message || 'The password reset link is invalid or has expired.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchUser();
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!token) {
      setError('Token is missing.');
      return;
    }
    setError(null);
    setIsLoading(true);

    try {
      const response = await setPassword({ token, password });
      setToken(response.token);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div className="text-center p-8">Loading...</div>;
  }

  return (
    <div className="container mt-5">
      <div className="row justify-content-center">
        <div className="col-md-6">
          <div className="card">
            <div className="card-body">
              <h3 className="card-title text-center">Set Your Password</h3>
              <p className="text-center text-muted mb-4">Complete your account setup by creating a password.</p>
              {/* Added this note for clarity */}
              <p className="text-center text-muted mb-4 small">Your name, email, and phone can be changed later in your account settings.</p>
              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label htmlFor="name">Name</label>
                  <input type="text" id="name" value={name} className="form-control" disabled />
                </div>
                 <div className="mb-3">
                  <label htmlFor="email">Email (Cannot be changed here)</label>
                  <input type="email" id="email" value={email} className="form-control" disabled />
                </div>
                 <div className="mb-3">
                  <label htmlFor="phone">Phone (Cannot be changed here)</label>
                  <input type="tel" id="phone" value={phone} className="form-control" disabled />
                </div>
                <div className="mb-3">
                  <label htmlFor="password">New Password</label>
                  <input type="password" id="password" value={password} onChange={e => setPassword(e.target.value)} className="form-control" required minLength={8} />
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
