import {
  RealtimeKitProvider,
  useRealtimeKitClient,
} from '@cloudflare/realtimekit-react';
import {
  RtkMeeting,
  RtkUiProvider,
} from '@cloudflare/realtimekit-react-ui';

// This function is now much simpler!
async function getChatToken() {
  // The request now goes to our main worker, which will proxy it.
  const res = await fetch('/api/chat/token', {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
   });
  if (!res.ok) throw new Error('Failed to get chat token');
  const data = await res.json();
  return data.token;
}

// The rest of the ChatWidget component remains the same as before...
export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [meeting, initMeeting] = useRealtimeKitClient(); // Correct hook

  useEffect(() => {
    if (isOpen && !meeting) {
      getChatToken()
        .then((token) => {
          initMeeting({
            authToken: token,
            defaults: { audio: false, video: false },
          });
        })
        .catch(console.error);
    }
  }, [isOpen, meeting, initMeeting]);

  const handleClose = () => {
    if (meeting?.leaveRoom) {
      meeting.leaveRoom();
    }
    setIsOpen(false);
  }

  // ... (rest of the JSX is the same) ...
  return (
    <>
      {/* The floating chat button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-event-blue text-white rounded-full p-4 shadow-lg hover:bg-event-blue/90 z-40"
      >
        Chat With Us
      </button>

      {/* The Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-3/4 flex flex-col">
            {/* ... (header) */}
            <div className="flex-grow">
              {meeting ? (
                // Use the correct RealtimeKit and Rtk components
                <RealtimeKitProvider value={meeting}>
                  <RtkUiProvider>
                    <RtkMeeting meeting={meeting} showSetupScreen={false} />
                  </RtkUiProvider>
                </RealtimeKitProvider>
              ) : (
                <div>Loading...</div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
