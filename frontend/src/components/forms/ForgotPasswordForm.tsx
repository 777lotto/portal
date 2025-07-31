// frontend/src/components/ForgotPasswordForm.tsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiPost } from '../../lib/api';

function ForgotPasswordForm() {
  const [identifier, setIdentifier] = useState('');
  const [channel, setChannel] = useState('email');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setIsLoading(true);

    try {
      const response = await apiPost<{ message: string }>('/api/request-password-reset', { identifier, channel });
      // MODIFIED: On success, navigate to the verify code form instead of just showing a message.
      // Pass the identifier so the next form knows who is verifying.
      navigate('/verify-code', { state: { identifier } });
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
              <h3 className="card-title text-center">Reset Password</h3>
              <p className="text-center text-muted mb-4">Enter your email or phone number to receive a reset link.</p>
              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label htmlFor="identifier">Email or Phone Number</label>
                  <input
                    type="text"
                    id="identifier"
                    value={identifier}
                    onChange={e => setIdentifier(e.target.value)}
                    className="form-control"
                    required
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label">Send link via:</label>
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="radio"
                      name="channel"
                      id="channelEmail"
                      value="email"
                      checked={channel === 'email'}
                      onChange={() => setChannel('email')}
                    />
                    <label className="form-check-label" htmlFor="channelEmail">
                      Email
                    </label>
                  </div>
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="radio"
                      name="channel"
                      id="channelSms"
                      value="sms"
                      checked={channel === 'sms'}
                      onChange={() => setChannel('sms')}
                    />
                    <label className="form-check-label" htmlFor="channelSms">
                      Text Message (SMS)
                    </label>
                  </div>
                </div>

                {message && <div className="alert alert-success">{message}</div>}
                {error && <div className="alert alert-danger">{error}</div>}

                <div className="d-grid">
                  <button type="submit" className="btn btn-primary" disabled={isLoading}>
                    {isLoading ? 'Sending...' : 'Send Reset Link'}
                  </button>
                </div>

                <div className="text-center mt-3">
                  <p><Link to="/login">Back to Login</Link></p>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ForgotPasswordForm;
