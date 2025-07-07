// frontend/src/components/LoginForm.tsx - CORRECTED
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { login } from '../lib/api.js';

// Add a type definition for our new global function
declare global {
  interface Window {
    onTurnstileSuccess?: (token: string) => void;
  }
}

interface Props {
  setToken: (token: string) => void;
}

function LoginForm({ setToken }: Props) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [turnstileToken, setTurnstileToken] = useState(''); // Re-add state for the token
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  // This effect will create the callback function that our Zaraz script calls
  useEffect(() => {
    window.onTurnstileSuccess = (token: string) => {
      setTurnstileToken(token);
    };

    // Cleanup the function when the component unmounts
    return () => {
      delete window.onTurnstileSuccess;
    };
  }, []); // Empty array ensures this only runs once

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Re-add the check for the token
    if (!turnstileToken) {
      setError("Please wait for the security check to complete.");
      return;
    }
    setError(null);
    setIsLoading(true);

    try {
      // Re-add the cf-turnstile-response to the payload
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
                  <label htmlFor="email">Email</label>
                  <input type="email" id="email" name="email" autoComplete="email" value={identifier} onChange={e => setIdentifier(e.target.value)} className="form-control" required />
                </div>
                <div className="mb-3">
                  <label htmlFor="password">Password</label>
                  <input type="password" id="password" name="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className="form-control" required />
                </div>
                {/* This container will be populated by the Zaraz script */}
                <div className="mb-3 d-flex justify-content-center" id="turnstile-container"></div>
                {error && <div className="alert alert-danger">{error}</div>}
                <div className="d-grid">
                  {/* Re-add the turnstile token check to the disabled property */}
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
