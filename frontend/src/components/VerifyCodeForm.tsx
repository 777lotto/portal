// File: 777lotto/portal/portal-bet/frontend/src/components/VerifyCodeForm.tsx

import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { verifyResetCode } from '../lib/api';
import { ApiError } from '../lib/fetchJson';

function VerifyCodeForm() {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const identifier = location.state?.identifier;

  // If the user lands here directly without an identifier, redirect them.
  if (!identifier) {
    navigate('/forgot-password', { replace: true });
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await verifyResetCode(identifier, code);
      if (response.passwordSetToken) {
        // On success, navigate to the final step, passing the special token.
        navigate('/set-password', { state: { passwordSetToken: response.passwordSetToken }, replace: true });
      } else {
        throw new Error("Verification failed: No token received.");
      }
    } catch (err: any) {
        setError(err instanceof ApiError ? err.message : 'An unexpected error occurred.');
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
              <h3 className="card-title text-center">Enter Verification Code</h3>
              <p className="text-center text-muted mb-4">A 6-digit code was sent to {identifier}.</p>
              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label htmlFor="code">Verification Code</label>
                  <input
                    type="text"
                    id="code"
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    className="form-control"
                    required
                    minLength={6}
                    maxLength={6}
                  />
                </div>

                {error && <div className="alert alert-danger">{error}</div>}

                <div className="d-grid">
                  <button type="submit" className="btn btn-primary" disabled={isLoading}>
                    {isLoading ? 'Verifying...' : 'Verify and Continue'}
                  </button>
                </div>

                <div className="text-center mt-3">
                  <p><Link to="/forgot-password">Request a new code</Link></p>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VerifyCodeForm;
