// frontend/src/components/CalendarSync.tsx

import { useState, useEffect } from 'react';
import { getCalendarFeed, syncCalendar } from '../lib/api';

function CalendarSync() {
  const [feedUrl, setFeedUrl] = useState('');
  const [syncUrl, setSyncUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'danger', text: string} | null>(null);

  useEffect(() => {
    // Fetch the calendar feed content securely from our API endpoint
    const fetchFeed = async () => {
        try {
            const icsContent = await getCalendarFeed();
            // Create a downloadable blob URL from the iCal content
            const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
            setFeedUrl(URL.createObjectURL(blob));
        } catch (err: any) {
            setMessage({ type: 'danger', text: `Could not fetch calendar feed: ${err.message}` });
        }
    };

    fetchFeed();

    // Clean up the object URL when the component unmounts to prevent memory leaks
    return () => {
        if (feedUrl) {
            URL.revokeObjectURL(feedUrl);
        }
    };
    // We only want this to run once, so the dependency array is empty.
  }, []);

  const handleSync = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!syncUrl) return;

    try {
        setIsLoading(true);
        setMessage(null);
        await syncCalendar(syncUrl);
        setMessage({ type: 'success', text: 'Calendar sync initiated successfully!' });
    } catch(err: any) {
        setMessage({ type: 'danger', text: err.message });
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h2 className="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark mb-6">Calendar Sync</h2>
      <div className="space-y-8">
        {/* Personal Feed URL Card */}
        <div className="bg-white dark:bg-tertiary-dark shadow-md rounded-lg p-6">
          <h5 className="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark">Your Personal Calendar Feed</h5>
          <p className="mt-1 text-sm text-text-secondary-light dark:text-text-secondary-dark">
            Use this URL to subscribe to your jobs in any calendar application (Google Calendar, Apple Calendar, etc.).
          </p>
          <div className="mt-4">
            <input
              type="text"
              readOnly
              className="w-full px-3 py-2 bg-gray-100 dark:bg-secondary-dark border border-border-light dark:border-border-dark rounded-md focus:outline-none"
              value={feedUrl || "Loading your secure feed URL..."}
              disabled={!feedUrl}
              onFocus={(e) => e.target.select()}
            />
            <a
              href={feedUrl}
              download="my-jobs.ics"
              className={`inline-block mt-3 px-4 py-2 text-white font-semibold rounded-md transition ${!feedUrl ? 'bg-gray-400 cursor-not-allowed' : 'bg-event-blue hover:bg-event-blue/90'}`}
            >
              Download .ics File
            </a>
          </div>
        </div>

        {/* Sync External Calendar Card */}
        <div className="bg-white dark:bg-tertiary-dark shadow-md rounded-lg p-6">
          <h5 className="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark">Sync External Calendar</h5>
          <p className="mt-1 text-sm text-text-secondary-light dark:text-text-secondary-dark">
            Paste the URL of an external iCal feed to sync it with your portal.
          </p>
          <form onSubmit={handleSync} className="mt-4">
            <div className="mb-3">
              <input
                type="url"
                className="w-full px-3 py-2 bg-white dark:bg-secondary-dark border border-border-light dark:border-border-dark rounded-md focus:ring-2 focus:ring-event-blue"
                value={syncUrl}
                onChange={(e) => setSyncUrl(e.target.value)}
                placeholder="https://example.com/feed.ics"
                required
              />
            </div>
            {message && <div className={`p-3 my-3 rounded-md text-sm ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{message.text}</div>}
            <button type="submit" className="px-4 py-2 text-white font-semibold rounded-md bg-event-blue hover:bg-event-blue/90 disabled:bg-gray-400" disabled={isLoading}>
              {isLoading ? 'Syncing...' : 'Sync Now'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default CalendarSync;

