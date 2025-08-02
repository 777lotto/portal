// frontend/src/components/forms/AuthForm.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { HTTPException } from 'hono/http-exception';
import StyledDigitInput from './StyledDigitInput';

interface Props {
	setToken: (token: string) => void;
}

type Step = 'IDENTIFY' | 'LOGIN_PASSWORD' | 'SIGNUP_DETAILS' | 'CHOOSE_VERIFY_METHOD' | 'VERIFY_CODE' | 'SET_PASSWORD';

type FlowContext = 'LOGIN' | 'SIGNUP' | 'PASSWORD_RESET';

function AuthForm({ setToken }: Props) {
	const [step, setStep] = useState<Step>('IDENTIFY');
	const [flowContext, setFlowContext] = useState<FlowContext>('LOGIN');
	const [verificationChannel, setVerificationChannel] = useState<'email' | 'sms' | null>(null);

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
	const [error, setError] = useState<React.ReactNode>(null);
	const [message, setMessage] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const navigate = useNavigate();

	/**
	 * REFACTORED: Handles API errors more gracefully.
	 * It now attempts to parse structured validation errors from zValidator
	 * and displays them to the user for better feedback.
	 */
	const handleApiError = async (err: unknown, defaultMessage: string) => {
		if (err instanceof HTTPException) {
			try {
				const errorJson = await err.response.json();
				// Check for zValidator error structure
				if (errorJson.error?.issues) {
					const errorMessages = errorJson.error.issues.map((issue: any) => issue.message).join(' ');
					setError(errorMessages);
				} else {
					setError(errorJson.message || errorJson.error || defaultMessage);
				}
			} catch {
				setError(defaultMessage);
			}
		} else {
			setError((err as Error).message || defaultMessage);
		}
	};

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setError(null);
		setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
	};

	const clearMessages = () => {
		setError(null);
		setMessage(null);
	};

	const handleIdentify = async (e: React.FormEvent) => {
		e.preventDefault();
		clearMessages();
		setIsLoading(true);
		try {
			const isEmail = formData.identifier.includes('@');
			const finalIdentifier = isEmail ? formData.identifier : formData.identifier.replace(/\D/g, '');

			// CORRECT: Correctly awaits the JSON response
			const response = await api['check-user'].$post({ json: { identifier: finalIdentifier } });
			const data = await response.json();

			setContactInfo({ email: data.email, phone: data.phone });

			if (data.status === 'EXISTING_WITH_PASSWORD') {
				setFlowContext('LOGIN');
				setFormData((prev) => ({ ...prev, identifier: finalIdentifier }));
				setStep('LOGIN_PASSWORD');
			} else if (data.status === 'EXISTING_NO_PASSWORD') {
				setFlowContext('PASSWORD_RESET');
				setFormData((prev) => ({ ...prev, identifier: finalIdentifier }));
				setStep('CHOOSE_VERIFY_METHOD');
			} else {
				// 'NEW'
				setFlowContext('SIGNUP');
				setFormData((prev) => ({
					...prev,
					identifier: finalIdentifier,
					email: isEmail ? finalIdentifier : '',
					phone: !isEmail ? finalIdentifier : '',
				}));
				setStep('SIGNUP_DETAILS');
			}
		} catch (err) {
			handleApiError(err, 'An error occurred while checking your account.');
		} finally {
			setIsLoading(false);
		}
	};

	const handleLogin = async (e: React.FormEvent) => {
		e.preventDefault();
		clearMessages();
		setIsLoading(true);
		try {
			// REFACTORED: Now correctly awaits the json() and accesses the token from the data envelope
			const response = await api.login.$post({
				json: {
					email: formData.identifier,
					password: formData.password,
				},
			});
			const data = await response.json();

			if (data.token) {
				setToken(data.token);
				navigate('/dashboard');
			} else {
				throw new Error('Login failed: No token received.');
			}
		} catch (err) {
			handleApiError(err, 'Login failed. Please check your email and password.');
		} finally {
			setIsLoading(false);
		}
	};

	const handleDetailsSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		clearMessages();
		setIsLoading(true);
		try {
			// REFACTORED: Correctly awaits the json() from the response
			const res = await api.signup.initialize.$post({
				json: {
					name: formData.name,
					company_name: formData.company_name,
					email: formData.email,
					phone: formData.phone,
				},
			});
			const initData = await res.json();

			const channel = formData.email ? 'email' : 'sms';
			const identifier = channel === 'email' ? initData.email : initData.phone;

			if (identifier) {
				await api['request-password-reset'].$post({ json: { identifier, channel } });
				setVerificationChannel(channel);
				setMessage(`A verification code has been sent to your ${channel}.`);
				setStep('VERIFY_CODE');
			} else {
				throw new Error('Could not determine where to send verification code.');
			}
		} catch (err) {
			handleApiError(err, 'An error occurred during signup.');
		} finally {
			setIsLoading(false);
		}
	};

	const handleRequestCode = async (channel: 'email' | 'sms') => {
		clearMessages();
		setIsLoading(true);
		try {
			const identifier = flowContext === 'SIGNUP' ? (channel === 'email' ? formData.email : formData.phone) : formData.identifier;
			await api['request-password-reset'].$post({ json: { identifier, channel } });
			setVerificationChannel(channel);
			setMessage(`A verification code has been sent to your ${channel}.`);
			setStep('VERIFY_CODE');
		} catch (err) {
			handleApiError(err, 'Failed to request code');
		} finally {
			setIsLoading(false);
		}
	};

	const handleVerifyCode = async (code: string) => {
		clearMessages();
		setIsLoading(true);
		try {
			const identifier = flowContext === 'SIGNUP' ? (verificationChannel === 'email' ? formData.email : formData.phone) : formData.identifier;

			// REFACTORED: Correctly awaits the json() from the response
			const res = await api['verify-reset-code'].$post({ json: { identifier, code } });
			const data = await res.json();

			if (data.passwordSetToken) {
				if (flowContext === 'LOGIN') {
					// And again here...
					const sessionRes = await api['login-with-token'].$post(
						{},
						{
							headers: { Authorization: `Bearer ${data.passwordSetToken}` },
						}
					);
					const sessionData = await sessionRes.json();
					setToken(sessionData.token);
					navigate('/dashboard', { replace: true });
				} else {
					setPasswordSetToken(data.passwordSetToken);
					setStep('SET_PASSWORD');
				}
			} else {
				throw new Error('Verification failed to return a token.');
			}
		} catch (err) {
			handleApiError(err, 'An unexpected error occurred.');
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
		clearMessages();
		setIsLoading(true);
		try {
			// REFACTORED: Final fix, correctly awaiting json() and accessing the enveloped data
			const response = await api['set-password'].$post(
				{ json: { password: formData.password } },
				{
					headers: { Authorization: `Bearer ${passwordSetToken}` },
				}
			);
			const data = await response.json();

			if (data.token) {
				setToken(data.token);
				navigate('/dashboard', { replace: true });
			} else {
				throw new Error('Authentication failed: No token received.');
			}
		} catch (err) {
			handleApiError(err, 'An unexpected error occurred.');
		} finally {
			setIsLoading(false);
		}
	};

	// --- No changes needed to any of the render functions below this line ---
	const renderIdentify = () => (
		<form onSubmit={handleIdentify} className="space-y-6">
			<div className="text-center">
				<h3 className="card-title">Sign In or Sign Up</h3>
				<p className="mt-2 text-sm text-text-secondary-light dark:text-text-secondary-dark">Enter your email or phone number to begin.</p>
			</div>
			<div>
				<label htmlFor="identifier" className="block text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
					Email or Phone Number
				</label>
				<div className="mt-1">
					<input type="text" id="identifier" name="identifier" value={formData.identifier} onChange={handleChange} className="form-control" required autoFocus />
				</div>
			</div>
			<div>
				<button type="submit" className="w-full btn btn-primary" disabled={isLoading}>
					{isLoading ? 'Continuing...' : 'Continue'}
				</button>
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
				<input
					type="password"
					id="password"
					name="password"
					value={formData.password}
					onChange={handleChange}
					className="form-control"
					required
					autoComplete="current-password"
					autoFocus
				/>
			</div>
			<div>
				<button type="submit" className="w-full btn btn-primary" disabled={isLoading}>
					{isLoading ? 'Signing In...' : 'Sign In'}
				</button>
			</div>
			<div className="text-sm text-center flex justify-between">
				<button
					type="button"
					className="btn btn-link"
					onClick={() => {
						clearMessages();
						setFlowContext('PASSWORD_RESET');
						setStep('CHOOSE_VERIFY_METHOD');
					}}
				>
					Forgot Password?
				</button>
				<button
					type="button"
					className="btn btn-link"
					onClick={() => {
						clearMessages();
						setFlowContext('LOGIN');
						setStep('CHOOSE_VERIFY_METHOD');
					}}
				>
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
				<label htmlFor="name" className="block text-sm font-medium">
					Full Name
				</label>
				<input type="text" id="name" name="name" value={formData.name} onChange={handleChange} className="form-control mt-1" autoFocus />
			</div>
			<div>
				<label htmlFor="company_name" className="block text-sm font-medium">
					Company or Community Name
				</label>
				<input type="text" id="company_name" name="company_name" value={formData.company_name} onChange={handleChange} className="form-control mt-1" />
				<p className="mt-2 text-xs text-text-secondary-light dark:text-text-secondary-dark">Please provide at least a name or a company name.</p>
			</div>
			<div>
				<StyledDigitInput
					id="phone"
					label="Phone Number"
					value={formData.phone}
					onChange={(value) => setFormData((prev) => ({ ...prev, phone: value }))}
					digitCount={10}
					format="phone"
					autoComplete="tel"
				/>
			</div>
			<div>
				<label htmlFor="email" className="block text-sm font-medium">
					Email Address
				</label>
				<input type="email" id="email" name="email" value={formData.email} onChange={handleChange} className="form-control mt-1" />
			</div>
			<div>
				<button type="submit" className="w-full btn btn-primary" disabled={isLoading || (!formData.name && !formData.company_name)}>
					{isLoading ? 'Initializing...' : 'Continue'}
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

	const renderVerifyCode = () => {
		const availableMethods = flowContext === 'SIGNUP' ? { email: formData.email, phone: formData.phone } : contactInfo;

		const otherChannel = verificationChannel === 'email' ? 'sms' : 'email';
		const canSwitch = !!(availableMethods.email && availableMethods.phone);

		return (
			<form
				onSubmit={(e) => {
					e.preventDefault();
					handleVerifyCode(formData.code);
				}}
				className="space-y-6"
			>
				<div className="text-center">
					<h3 className="card-title">Enter Verification Code</h3>
					{message && <div className="alert alert-info mt-4">{message}</div>}
				</div>
				<StyledDigitInput
					id="code"
					label="6-Digit Code"
					value={formData.code}
					onChange={(value) => setFormData((prev) => ({ ...prev, code: value }))}
					onComplete={handleVerifyCode}
					digitCount={6}
					autoComplete="one-time-code"
					format="code"
				/>
				<div>
					<button type="submit" className="w-full btn btn-primary" disabled={isLoading}>
						{isLoading ? 'Verifying...' : 'Verify and Continue'}
					</button>
				</div>
				{canSwitch && (
					<div className="text-center mt-2">
						<button type="button" className="btn btn-link" onClick={() => handleRequestCode(otherChannel)} disabled={isLoading}>
							{isLoading ? 'Sending...' : `Get ${otherChannel === 'sms' ? 'SMS' : 'Email'} Code Instead`}
						</button>
					</div>
				)}
			</form>
		);
	};

	const renderSetPassword = () => (
		<form onSubmit={handleSetPassword} className="space-y-6">
			<div className="text-center">
				<h3 className="card-title">Create a Secure Password</h3>
				<p className="mt-2 text-sm text-text-secondary-light dark:text-text-secondary-dark">This will be used to access your account.</p>
			</div>
			<div>
				<label htmlFor="password">Password (min. 8 characters)</label>
				<input
					type="password"
					id="password"
					name="password"
					value={formData.password}
					onChange={handleChange}
					className="form-control mt-1"
					required
					minLength={8}
					autoComplete="new-password"
					autoFocus
				/>
			</div>
			<div>
				<label htmlFor="confirmPassword">Confirm Password</label>
				<input
					type="password"
					id="confirmPassword"
					name="confirmPassword"
					value={formData.confirmPassword}
					onChange={handleChange}
					className="form-control mt-1"
					required
					autoComplete="new-password"
				/>
			</div>
			<div>
				<button type="submit" className="w-full btn btn-primary" disabled={isLoading}>
					{isLoading ? 'Saving...' : 'Complete and Sign In'}
				</button>
			</div>
		</form>
	);

	const renderStep = () => {
		switch (step) {
			case 'IDENTIFY':
				return renderIdentify();
			case 'LOGIN_PASSWORD':
				return renderLoginPassword();
			case 'SIGNUP_DETAILS':
				return renderSignupDetails();
			case 'CHOOSE_VERIFY_METHOD':
				return renderChooseVerifyMethod();
			case 'VERIFY_CODE':
				return renderVerifyCode();
			case 'SET_PASSWORD':
				return renderSetPassword();
			default:
				return renderIdentify();
		}
	};

	return (
		<div className="min-h-full flex flex-col justify-center py-12 sm:px-6 lg:px-8">
			<div className="sm:mx-auto sm:w-full sm:max-w-xl">
				<div className="card">
					<div className="card-body">
						{error && (
							<div className="alert alert-danger" role="alert">
								{error}
							</div>
						)}
						{renderStep()}
						{step !== 'IDENTIFY' && (
							<div className="text-center mt-4">
								<button
									className="btn btn-link"
									onClick={() => {
										clearMessages();
										setStep('IDENTIFY');
									}}
								>
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
