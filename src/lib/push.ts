import webPush from "web-push";
import { getSupabaseAdmin } from "@/lib/supabase";

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY!;

if (vapidPublicKey && vapidPrivateKey) {
  webPush.setVapidDetails(
    "mailto:admin@findash.local",
    vapidPublicKey,
    vapidPrivateKey
  );
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

export async function sendPushNotification(payload: PushPayload) {
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn("VAPID keys not configured, skipping push notification.");
    return;
  }

  const supabase = getSupabaseAdmin();
  
  // Get all active subscriptions
  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("*");

  if (error || !subs || subs.length === 0) return;

  const payloadString = JSON.stringify(payload);

  const promises = subs.map(async (sub) => {
    const pushSubscription = {
      endpoint: sub.endpoint,
      keys: {
        auth: sub.auth,
        p256dh: sub.p256dh,
      },
    };

    try {
      await webPush.sendNotification(pushSubscription, payloadString);
    } catch (err: any) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        // Subscription expired or unsubscribed, clean it up
        await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      } else {
        console.error("Failed to send push notification", err);
      }
    }
  });

  await Promise.allSettled(promises);
}
