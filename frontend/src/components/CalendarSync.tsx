import { useState } from 'react';
import useSWR from 'swr';
import { getSecretCalendarUrl, regenerateSecretCalendarUrl } from '../lib/api';

function CalendarSync() {
  const { data, error, isLoading, mutate } = useSWR('/api/calendar/secret-url', getSecretCalendarUrl);
  const [message, setMessage] = useState<{type: 'success' | 'danger', text: string} | null>(null);

  const handleCopy = () => {
    if (!data?.url) return;
    navigator.clipboard.writeText(data.url);
    setMessage({ type: 'success', text: 'URL copied to clipboard!' });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleRegenerate = async () => {
    if (!window.confirm("Are you sure? This will invalidate your old URL and you will need to update your calendar application.")) {
      return;
    }
    try {
      const newData = await regenerateSecretCalendarUrl();
      mutate(newData, false); // Update the local SWR cache with the new URL
      setMessage({ type: 'success', text: 'New URL generated successfully!' });
    } catch (err: any) {
      setMessage({ type: 'danger', text: `Error: ${err.message}` });
    }
  };

  const renderContent = () => {
    if (isLoading) return <p>Loading your secure feed URL...</p>;
    if (error) return <div className="p-3 my-3 rounded-md text-sm bg-red-100 text-red-800">{error.message}</div>;
    if (!data?.url) return <p>Could not load your calendar URL.</p>;

    return (
      <>
        <div className="mt-4 relative">
          <input
            type="text"
            readOnly
            className="w-full px-3 py-2 bg-gray-100 dark:bg-secondary-dark border border-border-light dark:border-border-dark rounded-md focus:outline-none"
            value={data.url}
            onFocus={(e) => e.target.select()}
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-4">
           <button
            onClick={handleCopy}
            className="inline-block px-4 py-2 text-white font-semibold rounded-md transition bg-event-blue hover:bg-event-blue/90"
          >
            Copy URL
          </button>
           <button
            onClick={handleRegenerate}
            className="inline-block px-4 py-2 text-white font-semibold rounded-md transition bg-event-red hover:bg-event-red/90"
          >
            Regenerate URL
          </button>
        </div>
         {message && <div className={`p-3 my-3 rounded-md text-sm ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{message.text}</div>}
      </>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h2 className="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark mb-6">Calendar Sync</h2>
      <div className="space-y-8">
        <div className="bg-white dark:bg-tertiary-dark shadow-md rounded-lg p-6">
          <h5 className="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark">Your Personal Calendar Feed</h5>
          <p className="mt-1 text-sm text-text-secondary-light dark:text-text-secondary-dark">
            Copy this secret URL and paste it into your calendar application (e.g., Google Calendar, Apple Calendar) under "Add from URL" or "Subscribe to Calendar" to keep your jobs in sync.
          </p>
           <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
            <strong>Warning:</strong> Treat this URL like a password. Anyone with this link can see your job schedule. If you think it has been compromised, regenerate it immediately.
          </p>
          {renderContent()}
        </div>
      </div>
    </div>
  );
}

export default CalendarSync;
