import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { verifyCode } from '../../lib/api'; // Corrected import path
import StyledDigitInput from './StyledDigitInput';

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

function VerifyCodeForm() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const query = useQuery();
  const email = query.get('email');
  const action = query.get('action') || 'login'; // Can be 'login' or 'password_reset'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!email) {
      setError('Email is missing from the request.');
      setIsLoading(false);
      return;
    }

    if (code.length !== 6) {
      setError('Please enter the 6-digit code.');
      setIsLoading(false);
      return;
    }

    try {
      const { token } = await verifyCode({ email, code, action });
      if (action === 'password_reset') {
        navigate(`/set-password?token=${token}`);
      } else {
        // For login, the backend should return a session token.
        // This part depends on how you want to handle the session token on the frontend
        // For now, let's assume it's stored and the user is redirected.
        localStorage.setItem('token', token);
        window.dispatchEvent(new Event('storage')); // Notify other parts of the app
        navigate('/');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
      <div className="p-8 max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-4">Verify Your Identity</h2>
        <p className="text-center text-gray-600 dark:text-gray-300 mb-6">
          A 6-digit code has been sent to {email}.
        </p>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <StyledDigitInput length={6} onComplete={setCode} />
          </div>
          {error && <p className="text-red-500 text-sm mb-4 text-center">{error}</p>}
          <button
            type="submit"
            disabled={isLoading || code.length !== 6}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-md focus:outline-none focus:shadow-outline disabled:bg-gray-400"
          >
            {isLoading ? 'Verifying...' : 'Verify'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default VerifyCodeForm;
