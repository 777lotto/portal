// frontend/src/components/forms/VerifyCodeForm.tsx
import { useState, useCallback } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { HTTPError } from 'hono/client';
import StyledDigitInput from './StyledDigitInput';

function VerifyCodeForm() {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const identifier = location.state?.identifier;

  if (!identifier) {
    return (
        <div className="container mt-5">
            <div className="alert alert-danger">
                Invalid session. Please <Link to="/forgot-password">start the password reset process</Link> again.
            </div>
        </div>
    );
  }

  const handleSubmit = useCallback(async (submittedCode: string) => {
    setError(null);
    setIsLoading(true);
    try {
      const response = await api['verify-reset-code'].$post({ json: { identifier, code: submittedCode } });
      if (response.passwordSetToken) {
        navigate('/set-password', { state: { passwordSetToken: response.passwordSetToken }, replace: true });
      } else {
        throw new Error("Verification failed: No token received.");
      }
    } catch (err: any) {
        if (err instanceof HTTPError) {
            const errorJson = await err.response.json().catch(() => ({}));
            setError(errorJson.error || 'Failed to verify code');
        } else {
            setError('An unexpected error occurred.');
        }
    } finally {
      setIsLoading(false);
    }
  }, [identifier, navigate]);

  return (
    // ... JSX is unchanged ...
    <div className="container mt-5">
      <div className="row justify-content-center">
        <div className="col-md-6">
          <div className="card">
            <div className="card-body">
              <h3 className="card-title text-center">Enter Verification Code</h3>
              <p className="text-center text-muted mb-4">A 6-digit code was sent to {identifier}.</p>
              <form onSubmit={(e) => { e.preventDefault(); handleSubmit(code); }}>
                <div className="mb-3">
                  <StyledDigitInput
                    id="code"
                    label="Verification Code"
                    value={code}
                    onChange={setCode}
                    onComplete={handleSubmit}
                    digitCount={6}
                    autoComplete="one-time-code"
                    format="code"
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
