import { api } from '../lib/api';
import { HTTPException } from 'hono/http-exception';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Helper to convert VAPID key
function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Helper to get a user-friendly error message
async function getErrorMessage(err: unknown): Promise<string> {
    let errorMessage = 'An unknown error occurred.';
    if (err instanceof HTTPException) {
        try {
            const errorJson = await err.response.json();
            errorMessage = errorJson.error || `Server responded with ${err.response.status}`;
        } catch {
            errorMessage = `Server responded with ${err.response.status}`;
        }
    } else if (err instanceof Error) {
        errorMessage = err.message;
    }
    return errorMessage;
}

export function usePushNotifications() {
    const queryClient = useQueryClient();

    // Query to get the current subscription state
    const { data: subscription, isLoading: isSubscriptionLoading } = useQuery({
        queryKey: ['push-subscription'],
        queryFn: async () => {
            if (!('serviceWorker' in navigator)) return null;
            const registration = await navigator.serviceWorker.ready;
            return registration.pushManager.getSubscription();
        },
        staleTime: Infinity, // The subscription rarely changes without user action
    });

    // Mutation to subscribe the user
    const { mutate: subscribe, isPending: isSubscribing, error: subscribeError } = useMutation<void, Error>({
        mutationFn: async () => {
            if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
                throw new Error("Push notifications are not supported by this browser.");
            }
            if (subscription) {
                console.log('User is already subscribed.');
                return;
            }

            const registration = await navigator.serviceWorker.ready;

            const vapidRes = await api.notifications['vapid-key'].$get();
            if(!vapidRes.ok) throw new HTTPException(vapidRes.status, { res: vapidRes });
            const vapidPublicKey = await vapidRes.text();

            const newSubscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
            });

            const subscribeRes = await api.notifications.subscribe.$post({ json: newSubscription });
            if (!subscribeRes.ok) throw new HTTPException(subscribeRes.status, { res: subscribeRes });
        },
        onSuccess: () => {
            // When subscription is successful, invalidate the query to refetch the state
            queryClient.invalidateQueries({ queryKey: ['push-subscription'] });
        },
    });

    // Mutation to unsubscribe the user
    const { mutate: unsubscribe, isPending: isUnsubscribing, error: unsubscribeError } = useMutation<void, Error>({
        mutationFn: async () => {
            if (!subscription) {
                console.log('User is not subscribed.');
                return;
            }
            const unsubscribed = await subscription.unsubscribe();
            if (unsubscribed) {
                // Optionally notify the backend. It's often good practice.
                await api.notifications.unsubscribe.$post({ json: { endpoint: subscription.endpoint } });
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['push-subscription'] });
        },
    });

    return {
        subscribe,
        unsubscribe,
        isSubscribed: !!subscription,
        isSubscriptionLoading,
        isSubscribing,
        isUnsubscribing,
        error: subscribeError || unsubscribeError,
        getErrorMessage,
    };
}
