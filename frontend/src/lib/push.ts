// 777lotto/portal/portal-bet/frontend/src/lib/push.ts
import { apiGet, apiPost } from './api';

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

  const vapidPublicKey = await apiGet<string>('/api/notifications/vapid-key');
  const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

  const newSubscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: convertedVapidKey
  });

  await apiPost('/api/notifications/subscribe', newSubscription);
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
