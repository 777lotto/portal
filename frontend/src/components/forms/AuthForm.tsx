import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { HTTPException } from 'hono/http-exception';
import StyledDigitInput from './StyledDigitInput';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckUserResponse } from '@portal/shared';

type Step = 'IDENTIFY' | 'LOGIN_PASSWORD' | 'SIGNUP_DETAILS' | 'CHOOSE_VERIFY_METHOD' | 'VERIFY_CODE' | 'SET_PASSWORD';
type FlowContext = 'LOGIN' | 'SIGNUP' | 'PASSWORD_RESET';

// Helper to get a user-friendly error message from various error types.
const getErrorMessage = async (error: unknown): Promise<string> => {
  if (error instanceof HTTPException) {
    try {
      const data = await error.response.json();
      if (data.error?.issues) {
        return data.error.issues.map((issue: any) => issue.message).join(' ');
      }
      return data.message || data.error || 'An unexpected error occurred.';
    } catch (e) {
      return 'An unexpected error occurred parsing the error response.';
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unknown error occurred.';
};


function AuthForm() {
	const [step, setStep] = useState<Step>('IDENTIFY');
	const [flowContext, setFlowContext] = useState<FlowContext>('LOGIN');
	const [verificationChannel, setVerificationChannel] = useState<'email' | 'sms' | null>(null);
	const [formData, setFormData] = useState({
		identifier: '', name: '', company_name: '', email: '',
		phone: '', password: '', confirmPassword: '', code: '',
	});
	const [contactInfo, setContactInfo] = useState<{ email?: string; phone?: string }>({});
	const [passwordSetToken, setPasswordSetToken] = useState('');
	const [error, setError] = useState<React.ReactNode>(null);
	const [message, setMessage] = useState<string | null>(null);
	const navigate = useNavigate();
    const queryClient = useQueryClient();

    const setToken = (token: string) => {
        localStorage.setItem('token', token);
        // Invalidate the profile query to trigger a re-fetch in useAuth, which will update the app state
        queryClient.invalidateQueries({ queryKey: ['profile'] });
        navigate('/dashboard', { replace: true });
    };

    // --- Mutations for each step of the authentication flow ---

    const checkUserMutation = useMutation<CheckUserResponse, Error, string>({
        mutationFn: async (identifier) => {
            const res = await api['check-user'].$post({ json: { identifier } });
            if (!res.ok) throw new HTTPException(res.status, { res });
            return res.json();
        },
        onSuccess: (data, identifier) => {
            setContactInfo({ email: data.email, phone: data.phone });
            if (data.status === 'EXISTING_WITH_PASSWORD') {
                setFlowContext('LOGIN');
                setFormData((prev) => ({ ...prev, identifier }));
                setStep('LOGIN_PASSWORD');
            } else if (data.status === 'EXISTING_NO_PASSWORD') {
                setFlowContext('PASSWORD_RESET');
                setFormData((prev) => ({ ...prev, identifier }));
                setStep('CHOOSE_VERIFY_METHOD');
            } else { // 'NEW'
                setFlowContext('SIGNUP');
                const isEmail = identifier.includes('@');
                setFormData((prev) => ({ ...prev, identifier, email: isEmail ? identifier : '', phone: !isEmail ? identifier : '' }));
                setStep('SIGNUP_DETAILS');
            }
        },
        onError: async (err) => setError(await getErrorMessage(err)),
    });

    const loginMutation = useMutation({
        mutationFn: () => api.login.$post({ json: { email: formData.identifier, password: formData.password } }),
        onSuccess: async (res) => {
            if (!res.ok) throw new HTTPException(res.status, { res });
            const data = await res.json();
            if (data.token) setToken(data.token);
            else throw new Error('Login failed: No token received.');
        },
        onError: async (err) => setError(await getErrorMessage(err)),
    });

    const signupInitMutation = useMutation({
        mutationFn: () => api.signup.initialize.$post({ json: { name: formData.name, company_name: formData.company_name, email: formData.email, phone: formData.phone } }),
        onSuccess: async (res) => {
            if (!res.ok) throw new HTTPException(res.status, { res });
            const channel = formData.email ? 'email' : 'sms';
            requestCodeMutation.mutate(channel); // Automatically request code after successful signup initialization
        },
        onError: async (err) => setError(await getErrorMessage(err)),
    });

    const requestCodeMutation = useMutation({
        mutationFn: async (channel: 'email' | 'sms') => {
            const identifier = flowContext === 'SIGNUP' ? (channel === 'email' ? formData.email : formData.phone) : formData.identifier;
            const res = await api['request-password-reset'].$post({ json: { identifier, channel } });
            if (!res.ok) throw new HTTPException(res.status, { res });
            return channel;
        },
        onSuccess: (channel) => {
            setVerificationChannel(channel);
            setMessage(`A verification code has been sent to your ${channel}.`);
            setStep('VERIFY_CODE');
        },
        onError: async (err) => setError(await getErrorMessage(err)),
    });

    const verifyCodeMutation = useMutation({
        mutationFn: (code: string) => {
            const identifier = flowContext === 'SIGNUP' ? (verificationChannel === 'email' ? formData.email : formData.phone) : formData.identifier;
            return api['verify-reset-code'].$post({ json: { identifier, code } });
        },
        onSuccess: async (res) => {
            if (!res.ok) throw new HTTPException(res.status, { res });
            const data = await res.json();
            if (data.passwordSetToken) {
                setPasswordSetToken(data.passwordSetToken);
                setStep('SET_PASSWORD');
            } else {
                throw new Error('Verification failed to return a token.');
            }
        },
        onError: async (err) => setError(await getErrorMessage(err)),
    });

    const setPasswordMutation = useMutation({
        mutationFn: () => api['set-password'].$post({ json: { password: formData.password } }, { headers: { Authorization: `Bearer ${passwordSetToken}` } }),
        onSuccess: async (res) => {
            if (!res.ok) throw new HTTPException(res.status, { res });
            const data = await res.json();
            if (data.token) setToken(data.token);
            else throw new Error('Authentication failed: No token received.');
        },
        onError: async (err) => setError(await getErrorMessage(err)),
    });

    // --- Event Handlers ---
	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setError(null);
		setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
	};

	const clearMessages = () => {
		setError(null);
		setMessage(null);
	};

    const handleIdentify = (e: React.FormEvent) => {
        e.preventDefault();
        clearMessages();
        const isEmail = formData.identifier.includes('@');
        const finalIdentifier = isEmail ? formData.identifier : formData.identifier.replace(/\D/g, '');
        checkUserMutation.mutate(finalIdentifier);
    };

    const handleSetPassword = (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match.');
            return;
        }
        clearMessages();
        setPasswordMutation.mutate();
    };

    const isSubmitting =
        checkUserMutation.isPending ||
        loginMutation.isPending ||
        signupInitMutation.isPending ||
        requestCodeMutation.isPending ||
        verifyCodeMutation.isPending ||
        setPasswordMutation.isPending;

	// --- Render Functions (JSX remains largely the same, only disabled/loading states change) ---
	const renderIdentify = () => (
		<form onSubmit={handleIdentify} className="space-y-6">
			<div className="text-center">
				<h3 className="card-title">Sign In or Sign Up</h3>
				<p className="mt-2 text-sm text-base-content/70">Enter your email or phone number to begin.</p>
			</div>
			<div>
				<label htmlFor="identifier" className="label"><span className="label-text">Email or Phone Number</span></label>
				<input type="text" id="identifier" name="identifier" value={formData.identifier} onChange={handleChange} className="input input-bordered w-full" required autoFocus />
			</div>
			<div>
				<button type="submit" className="w-full btn btn-primary" disabled={isSubmitting}>
					{isSubmitting ? <span className="loading loading-spinner"></span> : 'Continue'}
				</button>
			</div>
		</form>
	);

	const renderLoginPassword = () => (
		<form onSubmit={(e) => { e.preventDefault(); loginMutation.mutate() }} className="space-y-6">
			<div className="text-center">
				<h3 className="card-title">Welcome Back!</h3>
				<p className="mt-2 text-sm text-base-content/70">Enter your password to sign in.</p>
			</div>
			<div>
				<label className="label" htmlFor="password"><span className="label-text">Password</span></label>
				<input type="password" id="password" name="password" value={formData.password} onChange={handleChange} className="input input-bordered w-full" required autoComplete="current-password" autoFocus />
			</div>
			<div>
				<button type="submit" className="w-full btn btn-primary" disabled={isSubmitting}>
					{isSubmitting ? <span className="loading loading-spinner"></span> : 'Sign In'}
				</button>
			</div>
			<div className="text-sm text-center flex justify-between">
				<button type="button" className="btn btn-link" onClick={() => { clearMessages(); setFlowContext('PASSWORD_RESET'); setStep('CHOOSE_VERIFY_METHOD'); }}>
					Forgot Password?
				</button>
			</div>
		</form>
	);

    const renderSignupDetails = () => (
		<form onSubmit={(e) => { e.preventDefault(); signupInitMutation.mutate(); }} className="space-y-6">
			<div className="text-center">
				<h3 className="card-title">Complete Your Profile</h3>
				<p className="mt-2 text-sm text-base-content/70">Just a few more details to create your account.</p>
			</div>
			<div>
				<label htmlFor="name" className="label"><span className="label-text">Full Name</span></label>
				<input type="text" id="name" name="name" value={formData.name} onChange={handleChange} className="input input-bordered w-full" autoFocus />
			</div>
			<div>
				<label htmlFor="company_name" className="label"><span className="label-text">Company or Community Name</span></label>
				<input type="text" id="company_name" name="company_name" value={formData.company_name} onChange={handleChange} className="input input-bordered w-full" />
				<p className="mt-2 text-xs text-base-content/70">Please provide at least a name or a company name.</p>
			</div>
			<div>
				<StyledDigitInput id="phone" label="Phone Number" value={formData.phone} onChange={(value) => setFormData((prev) => ({ ...prev, phone: value }))} digitCount={10} format="phone" autoComplete="tel" />
			</div>
			<div>
				<label htmlFor="email" className="label"><span className="label-text">Email Address</span></label>
				<input type="email" id="email" name="email" value={formData.email} onChange={handleChange} className="input input-bordered w-full" />
			</div>
			<div>
				<button type="submit" className="w-full btn btn-primary" disabled={isSubmitting || (!formData.name && !formData.company_name)}>
					{isSubmitting ? <span className="loading loading-spinner"></span> : 'Continue'}
				</button>
			</div>
		</form>
	);

	const renderChooseVerifyMethod = () => {
		const methods = flowContext === 'SIGNUP' ? { email: formData.email, phone: formData.phone } : contactInfo;
		return (
			<div className="space-y-4">
				<div className="text-center">
					<h3 className="card-title">Verify Your Identity</h3>
					<p className="mt-2 text-sm text-base-content/70">How would you like to receive your one-time code?</p>
				</div>
				<div className="flex flex-col space-y-3">
					{methods.email && (
						<button onClick={() => requestCodeMutation.mutate('email')} className="w-full btn btn-secondary" disabled={isSubmitting}>
							{isSubmitting ? <span className="loading loading-spinner"></span> : `Email code to ${methods.email}`}
						</button>
					)}
					{methods.phone && (
						<button onClick={() => requestCodeMutation.mutate('sms')} className="w-full btn btn-secondary" disabled={isSubmitting}>
							{isSubmitting ? <span className="loading loading-spinner"></span> : `Text code to ${methods.phone}`}
						</button>
					)}
				</div>
			</div>
		);
	};

	const renderVerifyCode = () => (
        <form onSubmit={(e) => { e.preventDefault(); verifyCodeMutation.mutate(formData.code); }} className="space-y-6">
            <div className="text-center">
                <h3 className="card-title">Enter Verification Code</h3>
                {message && <div className="alert alert-info mt-4">{message}</div>}
            </div>
            <StyledDigitInput id="code" label="6-Digit Code" value={formData.code} onChange={(value) => setFormData((prev) => ({ ...prev, code: value }))} onComplete={(code) => verifyCodeMutation.mutate(code)} digitCount={6} autoComplete="one-time-code" format="code" />
            <div>
                <button type="submit" className="w-full btn btn-primary" disabled={isSubmitting}>
                    {isSubmitting ? <span className="loading loading-spinner"></span> : 'Verify and Continue'}
                </button>
            </div>
        </form>
    );

	const renderSetPassword = () => (
		<form onSubmit={handleSetPassword} className="space-y-6">
			<div className="text-center">
				<h3 className="card-title">Create a Secure Password</h3>
				<p className="mt-2 text-sm text-base-content/70">This will be used to access your account.</p>
			</div>
			<div>
				<label className="label" htmlFor="password"><span className="label-text">Password (min. 8 characters)</span></label>
				<input type="password" id="password" name="password" value={formData.password} onChange={handleChange} className="input input-bordered w-full" required minLength={8} autoComplete="new-password" autoFocus />
			</div>
			<div>
				<label className="label" htmlFor="confirmPassword"><span className="label-text">Confirm Password</span></label>
				<input type="password" id="confirmPassword" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} className="input input-bordered w-full" required autoComplete="new-password" />
			</div>
			<div>
				<button type="submit" className="w-full btn btn-primary" disabled={isSubmitting}>
					{isSubmitting ? <span className="loading loading-spinner"></span> : 'Complete and Sign In'}
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
			<div className="sm:mx-auto sm:w-full sm:max-w-xl">
				<div className="card bg-base-100 shadow-xl">
					<div className="card-body">
						{error && <div className="alert alert-error" role="alert">{error}</div>}
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
