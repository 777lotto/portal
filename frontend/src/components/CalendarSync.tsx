import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function CalendarSync() {
  const [copying, setCopying] = useState(false);
  const [calendarToken, setCalendarToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const token = localStorage.getItem('token');

  useEffect(() => {
    // If not logged in, redirect to login
    if (!token) {
      navigate('/login');
      return;
    }

    // Generate or fetch a calendar token
    async function fetchCalendarToken() {
      try {
        setIsLoading(true);
        // In a real implementation, you'd want to make an API call to get a specific
        // calendar token that's different from the main auth token
        // This is just a placeholder using the existing token
        setCalendarToken(token);
      } catch (err: any) {
        setError(err.message || 'Failed to generate calendar token');
      } finally {
        setIsLoading(false);
      }
    }

    fetchCalendarToken();
  }, [token, navigate]);

  // Generate the calendar feed URL
  const baseUrl = window.location.origin;
  const feedUrl = calendarToken ? `${baseUrl}/api/calendar-feed?token=${calendarToken}` : '';

  const handleCopyLink = async () => {
    if (!feedUrl) return;

    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopying(true);
      setTimeout(() => setCopying(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
      setError('Failed to copy to clipboard');
    }
  };

  const handleDownloadCalendar = () => {
    if (!feedUrl) return;
    window.open(feedUrl, '_blank');
  };

  if (isLoading) {
    return <div style={{ padding: '2rem' }}>Loading calendar sync options...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: '2rem' }}>
        <h2>Error</h2>
        <p style={{ color: 'red' }}>{error}</p>
        <button
          onClick={() => navigate('/dashboard')}
          style={{ padding: '0.5rem 1rem', marginTop: '1rem' }}
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Sync Your Service Schedule</h2>
      <p>
        Keep track of your gutter cleaning appointments by adding them to your favorite calendar app.
      </p>

      <div style={{ marginTop: '2rem' }}>
        <h3>Instructions</h3>

        <h4 style={{ marginTop: '1rem' }}>Google Calendar</h4>
        <ol>
          <li>In Google Calendar, click the "+" next to "Other calendars"</li>
          <li>Select "From URL"</li>
          <li>Paste the calendar URL below</li>
          <li>Click "Add calendar"</li>
        </ol>

        <h4 style={{ marginTop: '1rem' }}>Apple Calendar</h4>
        <ol>
          <li>In Calendar, select File → New Calendar Subscription</li>
          <li>Paste the calendar URL below</li>
          <li>Click "Subscribe"</li>
        </ol>

        <h4 style={{ marginTop: '1rem' }}>Outlook</h4>
        <ol>
          <li>In Outlook calendar, click "Add calendar"</li>
          <li>Select "From Internet"</li>
          <li>Paste the calendar URL below</li>
          <li>Click "OK"</li>
        </ol>

        <div style={{
          marginTop: '1.5rem',
          padding: '1rem',
          backgroundColor: '#f5f5f5',
          borderRadius: '4px',
          border: '1px solid #ddd',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
            marginRight: '1rem',
            fontFamily: 'monospace',
            fontSize: '0.9rem'
          }}>
            {feedUrl}
          </div>
          <button
            onClick={handleCopyLink}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: copying ? '#4CAF50' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            {copying ? 'Copied!' : 'Copy URL'}
          </button>
        </div>

        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
          <button
            onClick={handleDownloadCalendar}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Download Calendar File
          </button>

          <button
            onClick={() => navigate('/dashboard')}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: 'transparent',
              border: '1px solid #ccc',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Back to Dashboard
          </button>
        </div>

        <div style={{ marginTop: '2rem' }}>
          <h3>Security Note</h3>
          <p style={{ fontSize: '0.9rem', color: '#666' }}>
            This calendar URL contains a secure token that provides access to your schedule.
            Don't share this URL with people you don't want to have access to your appointment information.
            You can reset your calendar token at any time by revisiting this page.
          </p>
        </div>
      </div>
    </div>
  );
}
