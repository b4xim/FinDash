import webPush from "web-push";
import { getSupabaseAdmin } from "@/lib/supabase";

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY!;

if (vapidPublicKey && vapidPrivateKey) {
  webPush.setVapidDetails(
    "mailto:basimahmed001@gmail.com",
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
    return { sent: 0, errors: ["VAPID keys missing"] };
  }

  const supabase = getSupabaseAdmin();
  
  // Get all active subscriptions
  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("*");

  if (error) {
    console.error("Supabase error fetching subscriptions:", error);
    return { sent: 0, errors: [error.message] };
  }

  if (!subs || subs.length === 0) {
    console.log("No push subscriptions found in database.");
    return { sent: 0, errors: ["No subscriptions found. Did you enable them in Settings on your phone?"] };
  }

  const payloadString = JSON.stringify(payload);
  let sentCount = 0;
  const pushErrors: any[] = [];

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
      sentCount++;
    } catch (err: any) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      } else {
        console.error("Failed to send push notification", err);
        pushErrors.push({
          message: err.message || "Unknown push error",
          statusCode: err.statusCode,
          body: err.body,
        });
      }
    }
  });

  await Promise.allSettled(promises);
  return { sent: sentCount, errors: pushErrors };
}
