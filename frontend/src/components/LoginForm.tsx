// frontend/src/components/LoginForm.tsx - CORRECTED
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { login } from '../lib/api';
import Turnstile from './Turnstile';

interface Props {
  setToken: (token: string) => void;
}

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;

function LoginForm({ setToken }: Props) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!turnstileToken) {
      setError("Please complete the security check.");
      return;
    }
    setError(null);
    setIsLoading(true);

    try {
      const response = await login({
        email: identifier,
        password,
        'cf-turnstile-response': turnstileToken
      });
      if (response.token) {
        setToken(response.token);
        navigate('/dashboard');
      } else {
        throw new Error("Login failed: No token received.");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mt-5">
      <div className="row justify-content-center">
        <div className="col-md-6">
          <div className="card">
            <div className="card-body">
              <h3 className="card-title text-center">Login</h3>
              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label>Email</label>
                  <input type="email" value={identifier} onChange={e => setIdentifier(e.target.value)} className="form-control" required />
                </div>
                <div className="mb-3">
                  <label>Password</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="form-control" required />
                </div>
                <div className="mb-3 d-flex justify-content-center">
                    <Turnstile sitekey={TURNSTILE_SITE_KEY} onVerify={setTurnstileToken} />
                </div>
                {error && <div className="alert alert-danger">{error}</div>}
                <div className="d-grid">
                  <button type="submit" className="btn btn-primary" disabled={isLoading || !turnstileToken}>
                    {isLoading ? 'Logging in...' : 'Login'}
                  </button>
                </div>
                <div className="text-center mt-3">
                  <p>Don't have an account? <Link to="/signup">Sign up</Link></p>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginForm;
