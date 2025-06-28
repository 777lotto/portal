// frontend/src/components/SignupForm.tsx - CORRECTED
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signup } from '../lib/api';
import Turnstile from './Turnstile';

interface Props {
  setToken: (token: string) => void;
}

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;

function SignupForm({ setToken }: Props) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
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
      const response = await signup({
        email,
        name,
        password,
        phone,
        'cf-turnstile-response': turnstileToken
      });
      if (response.token) {
        setToken(response.token);
        navigate('/dashboard');
      } else {
         throw new Error("Signup failed: No token received.");
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
              <h3 className="card-title text-center">Sign Up</h3>
              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label>Name</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} className="form-control" required />
                </div>
                 <div className="mb-3">
                  <label>Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="form-control" required />
                </div>
                 <div className="mb-3">
                  <label>Phone</label>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="form-control" required />
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
                    {isLoading ? 'Signing up...' : 'Sign Up'}
                  </button>
                </div>
                <p className="text-center mt-3">
                  Already have an account? <Link to="/login">Login</Link>
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SignupForm;
