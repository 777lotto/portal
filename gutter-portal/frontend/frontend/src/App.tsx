import { useEffect, useState } from 'react';

function App() {
  const [status, setStatus] = useState<string>('Loading…');

  useEffect(() => {
    fetch('https://worker.mwb-67d.workers.dev/api/ping')
      .then((res) => res.json())
      .then((data) => setStatus(data.message))
      .catch(() => setStatus('Error'));
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <h1 className="text-3xl font-semibold">
        API says: <span className="text-blue-600">{status}</span>
      </h1>
    </div>
  );
}

export default App;
