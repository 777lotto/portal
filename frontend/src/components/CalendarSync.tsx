import { useState } from 'react';
import { getCalendarFeed } from '../lib/api';

export default function CalendarSync() {
  const [copying, setCopying] = useState(false);
  const token = localStorage.getItem('token')!;

  // Generate the calendar feed URL
  const baseUrl = window.location.origin;
  const feedUrl = `${baseUrl}/api/calendar-feed?token=${token}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopying(true);
      setTimeout(() => setCopying(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const handleDownloadCalendar = async () => {
    window.open(feedUrl, '_blank');
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Sync with Your Calendar</h2>

      <div style={{ marginTop: '1rem' }}>
        <p>
          You can add your gutter service appointments to your favorite calendar app by
          subscribing to the calendar feed.
        </p>

        <h3 style={{ marginTop: '1rem' }}>Instructions:</h3>

        <h4>Google Calendar</h4>
        <ol>
          <li>In Google Calendar, click the "+" next to "Other calendars"</li>
          <li>Select "From URL"</li>
          <li>Paste the calendar URL below</li>
          <li>Click "Add calendar"</li>
        </ol>

        <h4>Apple Calendar</h4>
        <ol>
          <li>In Calendar, select File → New Calendar Subscription</li>
          <li>Paste the calendar URL below</li>
          <li>Click "Subscribe"</li>
        </ol>

        <h4>Outlook</h4>
        <ol>
          <li>In Outlook calendar, click "Add calendar"</li>
          <li>Select "From Internet"</li>
          <li>Paste the calendar URL below</li>
          <li>Click "OK"</li>
        </ol>

        <div style={{
          marginTop: '1rem',
          padding: '1rem',
          backgroundColor: '#f5f5f5',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
            marginRight: '1rem'
          }}>
            {feedUrl}
          </div>
          <button
            onClick={handleCopyLink}
            style={{ padding: '0.5rem 1rem' }}
          >
            {copying ? 'Copied!' : 'Copy URL'}
          </button>
        </div>

        <div style={{ marginTop: '1rem' }}>
          <button
            onClick={handleDownloadCalendar}
            style={{ padding: '0.5rem 1rem' }}
          >
            Download Calendar File
          </button>
        </div>
      </div>
    </div>
  );
}
