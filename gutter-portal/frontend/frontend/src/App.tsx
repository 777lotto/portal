import { useState } from 'react';

function App() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage]   = useState<string>();

  const handleLogin = async () => {
    const res = await fetch('https://worker.mwb-67d.workers.dev/api/login', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      setMessage('Login failed');
      return;
    }
    const { token } = await res.json();
    localStorage.setItem('jwt', token);
    setMessage('Login successful!');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50 p-4">
      <input
        className="border p-2 rounded"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        type="password"
        className="border p-2 rounded"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button
        onClick={handleLogin}
        className="px-4 py-2 bg-blue-600 text-white rounded"
      >
        Log In
      </button>
      {message && <p>{message}</p>}
    </div>
  );
}

export default App;
