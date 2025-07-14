// 777lotto/portal/portal-bet/notification/src/push.ts
import webpush from 'web-push';
import type { Env, PushSubscription } from '@portal/shared';

export async function sendPushNotification(env: Env, subscription: PushSubscription, payload: string): Promise<boolean> {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    console.error("VAPID keys are not configured.");
    return false;
  }

  webpush.setVapidDetails(
    'mailto:your-email@example.com', // Replace with your email
    env.VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY
  );

  try {
    await webpush.sendNotification(subscription as any, payload);
    console.log("Successfully sent push notification.");
    return true;
  } catch (error: any) {
    console.error("Failed to send push notification:", error.body || error.message);
    // If the subscription is gone (410), we should remove it from our DB.
    // This would be handled in the calling function.
    if (error.statusCode === 410) {
        throw error; // Re-throw to signal deletion
    }
    return false;
  }
}
