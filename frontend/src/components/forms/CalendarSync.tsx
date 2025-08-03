import { useState } from 'react';
import { api } from '../../lib/api';
import { HTTPException } from 'hono/http-exception';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Helper to get a user-friendly error message
const getErrorMessage = async (err: unknown): Promise<string> => {
    if (err instanceof HTTPException) {
        try {
            const errorJson = await err.response.json();
            return errorJson.error || 'An unexpected server error occurred.';
        } catch {
            return 'Failed to parse server error response.';
        }
    } else if (err instanceof Error) {
        return err.message;
    }
    return 'An unknown error occurred.';
};


function CalendarSync() {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<{type: 'success' | 'danger', text: string} | null>(null);

  const { data, error, isLoading } = useQuery({
    queryKey: ['calendar', 'secret-url'],
    queryFn: async () => {
        const res = await api.calendar['secret-url'].$get();
        if (!res.ok) throw new HTTPException(res.status, { res });
        return res.json();
    }
  });

  const regenerateMutation = useMutation({
    mutationFn: () => api.calendar['regenerate-url'].$post({}),
    onSuccess: async (res) => {
        if (!res.ok) throw new HTTPException(res.status, { res });
        const newData = await res.json();
        // Update the query cache with the new data without a refetch
        queryClient.setQueryData(['calendar', 'secret-url'], newData);
        setMessage({ type: 'success', text: 'New URL generated successfully!' });
    },
    onError: async (err) => {
        const text = await getErrorMessage(err);
        setMessage({ type: 'danger', text });
    }
  });

  const handleCopy = () => {
    if (!data?.url) return;
    navigator.clipboard.writeText(data.url)
        .then(() => {
            setMessage({ type: 'success', text: 'URL copied to clipboard!' });
            setTimeout(() => setMessage(null), 3000);
        })
        .catch(() => {
            setMessage({ type: 'danger', text: 'Failed to copy URL.' });
        });
  };

  const handleRegenerate = () => {
    if (window.confirm("Are you sure? This will invalidate your old URL and you will need to update your calendar application.")) {
      regenerateMutation.mutate();
    }
  };

  const renderContent = () => {
    if (isLoading) return <div className="flex justify-center p-4"><span className="loading loading-spinner"></span></div>;
    if (error) return <div className="alert alert-error">Error: {error.message}</div>;
    if (!data?.url) return <p>Could not load your calendar URL.</p>;

    return (
      <>
        <div className="mt-4 relative">
          <input
            type="text"
            readOnly
            className="input input-bordered w-full"
            value={data.url}
            onFocus={(e) => e.target.select()}
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-4">
           <button onClick={handleCopy} className="btn btn-primary">
            Copy URL
          </button>
           <button onClick={handleRegenerate} className="btn btn-error" disabled={regenerateMutation.isPending}>
            {regenerateMutation.isPending && <span className="loading loading-spinner"></span>}
            Regenerate URL
          </button>
        </div>
      </>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
            <h2 className="card-title text-2xl">Calendar Sync</h2>
            <p className="text-base-content/70">
                Copy this secret URL and paste it into your calendar application (e.g., Google Calendar, Apple Calendar) under "Add from URL" or "Subscribe to Calendar" to see your upcoming jobs.
            </p>
            <div className="alert alert-warning mt-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                <span><strong>Warning:</strong> Treat this URL like a password. Anyone with this link can see your job schedule. If you think it has been compromised, regenerate it immediately.</span>
            </div>
            {message && <div className={`alert alert-${message.type === 'success' ? 'success' : 'error'} mt-4`}><div><span>{message.text}</span></div></div>}
            {renderContent()}
        </div>
      </div>
    </div>
  );
}

export default CalendarSync;
