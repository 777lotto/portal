import { useState } from 'react';

const WORKER_BASE = 'https://worker.mwb-67d.workers.dev';

function App() {
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [user, setUser]           = useState<{ email: string; name: string } | null>(null);
  const [message, setMessage]     = useState<string>();

  const handleLogin = async () => {
    setMessage('Logging in…');
    try {
      const res = await fetch(`${WORKER_BASE}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new Error('Invalid credentials');
      const { token } = await res.json();
      localStorage.setItem('jwt', token);
      setMessage('Fetching profile…');
      // Now fetch profile
      const profileRes = await fetch(`${WORKER_BASE}/api/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!profileRes.ok) throw new Error('Failed to load profile');
      const profile = await profileRes.json();
      setUser(profile);
      setMessage('');
    } catch (err) {
      setMessage((err as Error).message);
      setUser(null);
    }
  };

  if (user) {
    // Logged-in view
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
        <h1 className="text-2xl font-bold mb-2">Welcome, {user.name}!</h1>
        <p className="text-gray-700">Your email: {user.email}</p>
      </div>
    );
  }

  // Login form view
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50 p-4">
      <input
        type="email"
        placeholder="Email"
        className="border p-2 rounded w-64"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        type="password"
        placeholder="Password"
        className="border p-2 rounded w-64"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button
        onClick={handleLogin}
        className="px-4 py-2 bg-blue-600 text-white rounded w-32"
      >
        Log In
      </button>
      {message && <p className="text-red-600">{message}</p>}
    </div>
  );
}

export default App;
