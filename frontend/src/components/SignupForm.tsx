import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signup, checkUser, requestPasswordReset } from '../lib/api.js';
import { ApiError } from '../lib/fetchJson';


declare global {
  interface Window {
    onTurnstileSuccess?: (token: string) => void;
  }
}

interface Props {
  setToken: (token: string) => void;
}

type Step = 'IDENTIFY' | 'DETAILS' | 'PASSWORD' | 'EXISTING_PROMPT';

function SignupForm({ setToken }: Props) {
  const [step, setStep] = useState<Step>('IDENTIFY');
  const [formData, setFormData] = useState({
    identifier: '',
    name: '',
    company_name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });

  const [turnstileToken, setTurnstileToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    window.onTurnstileSuccess = (token: string) => setTurnstileToken(token);
    if (window.renderCfTurnstile) window.renderCfTurnstile();
    return () => {
      delete window.onTurnstileSuccess;
      const container = document.getElementById('turnstile-container');
      if (container) {
        container.innerHTML = '';
        delete container.dataset.rendered;
      }
    };
  }, [step]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleIdentify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const response = await checkUser(formData.identifier);
      if (response.status === 'NEW') {
        const isEmail = formData.identifier.includes('@');
        setFormData(prev => ({ ...prev, email: isEmail ? prev.identifier : '', phone: !isEmail ? prev.identifier : '' }));
        setStep('DETAILS');
      } else if (response.status === 'EXISTING_NO_PASSWORD') {
        setStep('EXISTING_PROMPT');
      } else { // EXISTING_WITH_PASSWORD
        setError('An account with this email or phone already exists.');
        setMessage('Please log in instead.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestReset = async (channel: 'email' | 'sms') => {
      setIsLoading(true);
      setError(null);
      setMessage(null);
      try {
          await requestPasswordReset(formData.identifier, channel);
          setMessage(`A link to set your password has been sent to your ${channel}.`);
      } catch (err: any) {
          setError(err.message);
      } finally {
          setIsLoading(false);
      }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!turnstileToken) {
      setError("Please wait for the security check to complete.");
      return;
    }
    setError(null);
    setIsLoading(true);

    try {
      const payload = {
        email: formData.email,
        phone: formData.phone,
        name: formData.name,
        company_name: formData.company_name,
        password: formData.password,
        'cf-turnstile-response': turnstileToken,
      };
      const response = await signup(payload);
      if (response.token) {
        setToken(response.token);
        navigate('/dashboard');
      } else {
        throw new Error("Signup failed: No token received.");
      }
    } catch (err: any) {
        setError(err instanceof ApiError ? err.message : 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderStep = () => {
      switch(step) {
          case 'IDENTIFY':
              return (
                <form onSubmit={handleIdentify}>
                    <h3 className="card-title text-center">Sign Up</h3>
                    <p className="text-center text-muted mb-4">Enter your email or phone to get started.</p>
                    <div className="mb-3">
                        <label htmlFor="identifier">Email or Phone Number</label>
                        <input type="text" id="identifier" name="identifier" value={formData.identifier} onChange={handleChange} className="form-control" required />
                    </div>
                    {error && <div className="alert alert-danger">{error}</div>}
                    {message && <div className="alert alert-info">{message}</div>}
                    <div className="d-grid">
                        <button type="submit" className="btn btn-primary" disabled={isLoading}>{isLoading ? 'Checking...' : 'Continue'}</button>
                    </div>
                </form>
              );
          case 'DETAILS':
              return (
                 <form onSubmit={(e) => { e.preventDefault(); setStep('PASSWORD'); }}>
                    <h3 className="card-title text-center">Your Details</h3>
                     <div className="mb-3">
                         <label htmlFor="name">Full Name</label>
                         <input type="text" id="name" name="name" value={formData.name} onChange={handleChange} className="form-control" required />
                     </div>
                      <div className="mb-3">
                         <label htmlFor="company_name">Company or Community Name (Optional)</label>
                         <input type="text" id="company_name" name="company_name" value={formData.company_name} onChange={handleChange} className="form-control" />
                     </div>
                     <div className="d-grid">
                         <button type="submit" className="btn btn-primary">Next</button>
                     </div>
                 </form>
              );
        case 'PASSWORD':
            return (
                <form onSubmit={handleSubmit}>
                    <h3 className="card-title text-center">Create a Password</h3>
                     <div className="mb-3">
                         <label htmlFor="password">Password</label>
                         <input type="password" id="password" name="password" value={formData.password} onChange={handleChange} className="form-control" required minLength={8} />
                     </div>
                     <div className="mb-3">
                         <label htmlFor="confirmPassword">Confirm Password</label>
                         <input type="password" id="confirmPassword" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} className="form-control" required />
                     </div>
                     <div className="mb-3 d-flex justify-content-center" id="turnstile-container"></div>
                     {error && <div className="alert alert-danger">{error}</div>}
                     <div className="d-grid">
                         <button type="submit" className="btn btn-primary" disabled={isLoading || !turnstileToken}>{isLoading ? 'Creating Account...' : 'Finish Signup'}</button>
                     </div>
                </form>
            );
        case 'EXISTING_PROMPT':
            return (
                <div>
                    <h3 className="card-title text-center">Welcome Back!</h3>
                    <p className="text-center text-muted mb-4">It looks like you already have a guest account with us. To continue, please set a password.</p>
                    {message && <div className="alert alert-success">{message}</div>}
                    {error && <div className="alert alert-danger">{error}</div>}
                    <div className="d-grid gap-2">
                         <button onClick={() => handleRequestReset('email')} className="btn btn-info" disabled={isLoading || !formData.identifier.includes('@')}>{isLoading ? 'Sending...' : 'Send Link to Email'}</button>
                         <button onClick={() => handleRequestReset('sms')} className="btn btn-info" disabled={isLoading || formData.identifier.includes('@')}>{isLoading ? 'Sending...' : 'Send Link via Text'}</button>
                    </div>
                </div>
            )
      }
  }

  return (
    <div className="container mt-5">
      <div className="row justify-content-center">
        <div className="col-md-6">
          <div className="card">
            <div className="card-body">
                {renderStep()}
                <p className="text-center mt-3">
                  Already have an account? <Link to="/login">Login</Link>
                </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SignupForm;
