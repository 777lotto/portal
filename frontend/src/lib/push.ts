// frontend/src/lib/push.ts - Updated for Hono RPC Client
import { api } from './api';

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

  // Updated: Use the Hono RPC client to get the VAPID key
  const vapidRes = await api.notifications['vapid-key'].$get();
  if (!vapidRes.ok) {
    throw new Error('Failed to fetch VAPID key from server.');
  }
  // The VAPID key is returned as plain text
  const vapidPublicKey = await vapidRes.text();
  const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

  const newSubscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: convertedVapidKey
  });

  // Updated: Use the Hono RPC client to send the subscription to the server
  const subRes = await api.notifications.subscribe.$post({ json: newSubscription });
  if (!subRes.ok) {
      throw new Error('Failed to send subscription to server.');
  }

  console.log('User subscribed successfully.');
}

export async function unsubscribeUser() {
    if (!('serviceWorker' in navigator)) return;

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
        await subscription.unsubscribe();
        // We can also send a request to the backend to delete the subscription
        // but the backend will handle expired subscriptions automatically.
        console.log('User unsubscribed successfully.');
    }
}
