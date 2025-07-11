// frontend/src/components/AuthForm.tsx - UPDATED
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { checkUser, login, requestPasswordReset, verifyResetCode, setPassword, signup, loginWithToken } from '../lib/api';
import { ApiError } from '../lib/fetchJson';

// Declare the global Turnstile type
declare global {
  interface Window {
    renderCfTurnstile?: () => void;
    onTurnstileSuccess?: (token: string) => void;
  }
}

interface Props {
  setToken: (token: string) => void;
}

type Step =
  | 'IDENTIFY'
  | 'LOGIN_PASSWORD'
  | 'SIGNUP_DETAILS'
  | 'CHOOSE_VERIFY_METHOD'
  | 'VERIFY_CODE'
  | 'SET_PASSWORD';

type FlowContext = 'LOGIN' | 'SIGNUP' | 'PASSWORD_RESET';

function AuthForm({ setToken }: Props) {
  const [step, setStep] = useState<Step>('IDENTIFY');
  const [flowContext, setFlowContext] = useState<FlowContext>('LOGIN');

  const [formData, setFormData] = useState({
    identifier: '',
    name: '',
    company_name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    code: '',
  });

  const [contactInfo, setContactInfo] = useState<{ email?: string; phone?: string }>({});
  const [passwordSetToken, setPasswordSetToken] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [error, setError] = useState<React.ReactNode>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    window.onTurnstileSuccess = (token: string) => setTurnstileToken(token);

    if (step === 'LOGIN_PASSWORD' || step === 'SET_PASSWORD') {
        setTimeout(() => {
            if (window.renderCfTurnstile) {
                window.renderCfTurnstile();
            }
        }, 100);
    }

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
    setError(null);
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const clearMessages = () => {
      setError(null);
      setMessage(null);
  }

  const handleIdentify = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    setIsLoading(true);

    try {
      const response = await checkUser(formData.identifier);
      setContactInfo({ email: response.email, phone: response.phone });

      if (response.status === 'EXISTING_WITH_PASSWORD') {
        setFlowContext('LOGIN');
        setStep('LOGIN_PASSWORD');
      } else if (response.status === 'EXISTING_NO_PASSWORD') {
        setFlowContext('LOGIN');
        setStep('CHOOSE_VERIFY_METHOD');
      } else {
        setFlowContext('SIGNUP');
        const isEmail = formData.identifier.includes('@');
        setFormData(prev => ({
            ...prev,
            email: isEmail ? prev.identifier : '',
            phone: !isEmail ? prev.identifier : ''
        }));
        setStep('SIGNUP_DETAILS');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!turnstileToken) {
        setError("Please complete the security check.");
        return;
    }
    clearMessages();
    setIsLoading(true);

    try {
      const response = await login({
        email: contactInfo.email || formData.identifier,
        password: formData.password,
        'cf-turnstile-response': turnstileToken,
      });
      if (response.token) {
        setToken(response.token);
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
      setTurnstileToken('');
    }
  };

  const handleDetailsSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.name && !formData.company_name) {
          setError("Please enter either your name or a company/community name.");
          return;
      }
      clearMessages();
      setStep('CHOOSE_VERIFY_METHOD');
  }

  const handleRequestCode = async (channel: 'email' | 'sms') => {
    clearMessages();
    setIsLoading(true);
    try {
        const identifier = flowContext === 'SIGNUP'
            ? (channel === 'email' ? formData.email : formData.phone)
            : formData.identifier;
        await requestPasswordReset(identifier, channel);
        setMessage(`A verification code has been sent to your ${channel}.`);
        setStep('VERIFY_CODE');
    } catch (err: any) {
        setError(err.message);
    } finally {
        setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    setIsLoading(true);
    try {
        const identifier = flowContext === 'SIGNUP'
            ? (contactInfo.email || formData.email || contactInfo.phone || formData.phone)
            : formData.identifier;
        const response = await verifyResetCode(identifier, formData.code);
        if (response.passwordSetToken) {
            if (flowContext === 'LOGIN') {
                const sessionResponse = await loginWithToken(response.passwordSetToken);
                setToken(sessionResponse.token);
                navigate('/dashboard', { replace: true });
            } else {
                setPasswordSetToken(response.passwordSetToken);
                setStep('SET_PASSWORD');
            }
        } else {
            throw new Error("Verification failed to return a token.");
        }
    } catch (err: any) {
        setError(err instanceof ApiError ? err.message : 'An unexpected error occurred.');
    } finally {
        setIsLoading(false);
    }
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!turnstileToken) {
      setError("Please complete the security check.");
      return;
    }
    clearMessages();
    setIsLoading(true);

    try {
      const response = flowContext === 'SIGNUP'
        ? await signup({
            name: formData.name,
            company_name: formData.company_name,
            email: formData.email,
            phone: formData.phone,
            password: formData.password,
            'cf-turnstile-response': turnstileToken,
          })
        : await setPassword(formData.password, passwordSetToken);

      if (response.token) {
        setToken(response.token);
        navigate('/dashboard', { replace: true });
      } else {
        throw new Error("Authentication failed: No token received.");
      }
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
      setTurnstileToken('');
    }
  };


  const renderIdentify = () => (
    <form onSubmit={handleIdentify} className="space-y-6">
      <div className="text-center">
        <h3 className="card-title">Sign In or Sign Up</h3>
        <p className="mt-2 text-sm text-text-secondary-light dark:text-text-secondary-dark">Enter your email or phone number to begin.</p>
      </div>
      <div>
        <label htmlFor="identifier" className="block text-sm font-medium text-text-primary-light dark:text-text-primary-dark">Email or Phone Number</label>
        <div className="mt-1">
            <input type="text" id="identifier" name="identifier" value={formData.identifier} onChange={handleChange} className="form-control" required autoFocus />
        </div>
      </div>
      <div>
        <button type="submit" className="w-full btn btn-primary" disabled={isLoading}>{isLoading ? 'Continuing...' : 'Continue'}</button>
      </div>
    </form>
  );

  const renderLoginPassword = () => (
    <form onSubmit={handleLogin} className="space-y-6">
        <div className="text-center">
            <h3 className="card-title">Welcome Back!</h3>
            <p className="mt-2 text-sm text-text-secondary-light dark:text-text-secondary-dark">Enter your password to sign in.</p>
        </div>
        <div>
            <label htmlFor="password">Password</label>
            <input type="password" id="password" name="password" value={formData.password} onChange={handleChange} className="form-control" required autoComplete="current-password" autoFocus/>
        </div>
        <div className="flex justify-center" id="turnstile-container"></div>
        <div>
            <button type="submit" className="w-full btn btn-primary" disabled={isLoading || !turnstileToken}>
                {isLoading ? 'Signing In...' : 'Sign In'}
            </button>
        </div>
        <div className="text-sm text-center flex justify-between">
            <button type="button" className="btn btn-link" onClick={() => {
                clearMessages();
                setFlowContext('PASSWORD_RESET');
                setStep('CHOOSE_VERIFY_METHOD');
            }}>
                Forgot Password?
            </button>
            <button type="button" className="btn btn-link" onClick={() => {
                clearMessages();
                setFlowContext('LOGIN');
                setStep('CHOOSE_VERIFY_METHOD');
            }}>
                Sign in with a code
            </button>
        </div>
    </form>
  );

  const renderSignupDetails = () => (
      <form onSubmit={handleDetailsSubmit} className="space-y-6">
           <div className="text-center">
                <h3 className="card-title">Complete Your Profile</h3>
                <p className="mt-2 text-sm text-text-secondary-light dark:text-text-secondary-dark">Just a few more details to create your account.</p>
            </div>
            <div>
              <label htmlFor="name" className="block text-sm font-medium">Full Name</label>
              <input type="text" id="name" name="name" value={formData.name} onChange={handleChange} className="form-control mt-1" autoFocus/>
            </div>
            <div>
              <label htmlFor="company_name" className="block text-sm font-medium">Company or Community Name</label>
              <input type="text" id="company_name" name="company_name" value={formData.company_name} onChange={handleChange} className="form-control mt-1" />
              <p className="mt-2 text-xs text-text-secondary-light dark:text-text-secondary-dark">Please provide at least a name or a company name.</p>
            </div>
          <div>
              <button type="submit" className="w-full btn btn-primary" disabled={isLoading || (!formData.name && !formData.company_name)}>
                  Continue
              </button>
          </div>
      </form>
  );

  const renderChooseVerifyMethod = () => {
    const methods = flowContext === 'SIGNUP'
        ? { email: formData.email, phone: formData.phone }
        : contactInfo;
    return (
        <div className="space-y-4">
            <div className="text-center">
                <h3 className="card-title">Verify Your Identity</h3>
                <p className="mt-2 text-sm text-text-secondary-light dark:text-text-secondary-dark">How would you like to receive your one-time code?</p>
            </div>
            <div className="flex flex-col space-y-3">
                {methods.email && (
                    <button onClick={() => handleRequestCode('email')} className="w-full btn btn-info" disabled={isLoading}>
                        {isLoading ? 'Sending...' : `Email code to ${methods.email}`}
                    </button>
                )}
                {methods.phone && (
                    <button onClick={() => handleRequestCode('sms')} className="w-full btn btn-info" disabled={isLoading}>
                        {isLoading ? 'Sending...' : `Text code to ${methods.phone}`}
                    </button>
                )}
            </div>
        </div>
    );
  };

  const renderVerifyCode = () => (
      <form onSubmit={handleVerifyCode} className="space-y-6">
           <div className="text-center">
                <h3 className="card-title">Enter Verification Code</h3>
                {message && <div className="alert alert-info mt-4">{message}</div>}
           </div>
          <div>
              <label htmlFor="code">6-Digit Code</label>
              <input type="text" id="code" name="code" value={formData.code} onChange={handleChange} className="form-control mt-1" required minLength={6} maxLength={6} autoFocus/>
          </div>
          <div>
              <button type="submit" className="w-full btn btn-primary" disabled={isLoading}>{isLoading ? 'Verifying...' : 'Verify and Continue'}</button>
          </div>
      </form>
  );

  const renderSetPassword = () => (
    <form onSubmit={handleSetPassword} className="space-y-6">
        <div className="text-center">
            <h3 className="card-title">Create a Secure Password</h3>
            <p className="mt-2 text-sm text-text-secondary-light dark:text-text-secondary-dark">This will be used to access your account.</p>
        </div>
         <div>
             <label htmlFor="password">Password (min. 8 characters)</label>
             <input type="password" id="password" name="password" value={formData.password} onChange={handleChange} className="form-control mt-1" required minLength={8} autoComplete="new-password" autoFocus/>
         </div>
         <div>
             <label htmlFor="confirmPassword">Confirm Password</label>
             <input type="password" id="confirmPassword" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} className="form-control mt-1" required autoComplete="new-password"/>
         </div>
         <div className="flex justify-center" id="turnstile-container"></div>
         <div>
             <button type="submit" className="w-full btn btn-primary" disabled={isLoading || !turnstileToken}>
                {isLoading ? 'Saving...' : 'Complete and Sign In'}
            </button>
         </div>
    </form>
  );

  const renderStep = () => {
    switch (step) {
      case 'IDENTIFY': return renderIdentify();
      case 'LOGIN_PASSWORD': return renderLoginPassword();
      case 'SIGNUP_DETAILS': return renderSignupDetails();
      case 'CHOOSE_VERIFY_METHOD': return renderChooseVerifyMethod();
      case 'VERIFY_CODE': return renderVerifyCode();
      case 'SET_PASSWORD': return renderSetPassword();
      default: return renderIdentify();
    }
  };

  return (
    <div className="min-h-full flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
             <div className="card">
                <div className="card-body">
                    {error && <div className="alert alert-danger" role="alert">{error}</div>}
                    {renderStep()}
                     {step !== 'IDENTIFY' && (
                        <div className="text-center mt-4">
                            <button className="btn btn-link" onClick={() => { clearMessages(); setStep('IDENTIFY'); }}>
                                Start Over
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    </div>
  );
}

export default AuthForm;
