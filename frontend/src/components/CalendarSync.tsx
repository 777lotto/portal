// frontend/src/components/CalendarSync.tsx - CORRECTED
import { useState, useEffect } from 'react';
import { getCalendarFeed, syncCalendar } from '../lib/api';

function CalendarSync() {
  const [feedUrl, setFeedUrl] = useState('');
  const [syncUrl, setSyncUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'danger', text: string} | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      setFeedUrl(getCalendarFeed(token));
    }
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
    <div className="container mt-4">
      <h2>Calendar Sync</h2>
      <div className="card">
        <div className="card-body">
          <h5 className="card-title">Your Personal Calendar Feed</h5>
          <p>Add this URL to your calendar application to see your jobs.</p>
          <input type="text" readOnly className="form-control" value={feedUrl} />
          <button className="btn btn-secondary mt-2" onClick={() => navigator.clipboard.writeText(feedUrl)}>
            Copy URL
          </button>
        </div>
      </div>

      <div className="card mt-4">
        <div className="card-body">
          <h5 className="card-title">Sync External Calendar</h5>
          <p>Paste the URL of an external iCal feed to sync it with your portal.</p>
          <form onSubmit={handleSync}>
            <div className="mb-3">
              <input
                type="url"
                className="form-control"
                value={syncUrl}
                onChange={(e) => setSyncUrl(e.target.value)}
                placeholder="https://example.com/feed.ics"
                required
              />
            </div>
            {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}
            <button type="submit" className="btn btn-primary" disabled={isLoading}>
              {isLoading ? 'Syncing...' : 'Sync Now'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default CalendarSync;
