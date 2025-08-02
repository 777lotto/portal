import { api } from './api';
import { HTTPError } from 'hono/client';

// Helper to convert VAPID key (no changes needed here)
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

export async function subscribeUser() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error("Push notifications are not supported by this browser.");
  }

  const registration = await navigator.serviceWorker.ready;
  const existingSubscription = await registration.pushManager.getSubscription();

  if (existingSubscription) {
    console.log('User is already subscribed.');
    return;
  }

  try {
    // The VAPID key is returned as plain text, not JSON.
    const vapidPublicKey = await api.notifications['vapid-key'].$get();
    const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

    const newSubscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: convertedVapidKey
    });

    // Send the new subscription to the server.
    await api.notifications.subscribe.$post({ json: newSubscription });

    console.log('User subscribed successfully.');
  } catch (err) {
    let errorMessage = 'Failed to subscribe user.';
    if (err instanceof HTTPError) {
        // Try to get a more specific error from the response
        const errorJson = await err.response.json().catch(() => ({}));
        errorMessage = errorJson.error || `Server responded with ${err.response.status}`;
    } else if (err instanceof Error) {
        errorMessage = err.message;
    }
    console.error('Subscription Error:', errorMessage);
    throw new Error(errorMessage);
  }
}

export async function unsubscribeUser() {
    if (!('serviceWorker' in navigator)) return;

    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (subscription) {
            await subscription.unsubscribe();
            // Optionally, notify the backend that the subscription was removed.
            // await api.notifications.unsubscribe.$post({ json: { endpoint: subscription.endpoint } });
            console.log('User unsubscribed successfully.');
        }
    } catch (err) {
        console.error('Unsubscription failed:', err);
        throw new Error('Could not unsubscribe.');
    }
}
