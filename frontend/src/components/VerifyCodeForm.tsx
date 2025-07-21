// File: 777lotto/portal/portal-bet/frontend/src/components/VerifyCodeForm.tsx

import { useState, useCallback } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { verifyResetCode } from '../lib/api';
import { ApiError } from '../lib/fetchJson';
import StyledDigitInput from './StyledDigitInput'; // Make sure to import

function VerifyCodeForm() {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const identifier = location.state?.identifier;

  if (!identifier) {
    navigate('/forgot-password', { replace: true });
  }

  const handleSubmit = useCallback(async (submittedCode: string) => {
    setError(null);
    setIsLoading(true);

    try {
      const response = await verifyResetCode(identifier, submittedCode);
      if (response.passwordSetToken) {
        navigate('/set-password', { state: { passwordSetToken: response.passwordSetToken }, replace: true });
      } else {
        throw new Error("Verification failed: No token received.");
      }
    } catch (err: any) {
        setError(err instanceof ApiError ? err.message : 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, [identifier, navigate]);

  return (
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
