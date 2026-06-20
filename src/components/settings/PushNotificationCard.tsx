"use client";

import { useState, useEffect } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";

const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function PushNotificationCard() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator && "PushManager" in window) {
      setIsSupported(true);
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => {
          setIsSubscribed(!!sub);
        });
      });
    }
  }, []);

  async function handleSubscribe() {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicVapidKey),
      });

      const res = await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub),
      });

      if (res.ok) {
        setIsSubscribed(true);
      } else {
        console.error("Failed to save subscription on server");
      }
    } catch (err) {
      console.error("Push subscription failed", err);
    }
    setLoading(false);
  }

  async function handleUnsubscribe() {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        
        await fetch("/api/notifications/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
      }
      setIsSubscribed(false);
    } catch (err) {
      console.error("Push unsubscription failed", err);
    }
    setLoading(false);
  }

  if (!isSupported) {
    return (
      <div className="card p-6 opacity-50">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-surface-overlay rounded-xl text-text-muted">
            <BellOff size={24} />
          </div>
          <div>
            <h3 className="text-text-primary font-display font-medium text-lg">Push Notifications</h3>
            <p className="text-text-muted text-sm mt-1">Not supported on this device or browser. To receive notifications on iOS, add FinDash to your Home Screen.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-6 relative overflow-hidden group">
      <div className="flex items-start gap-4">
        <div className="p-3 bg-violet/10 rounded-xl text-violet-light group-hover:scale-110 transition-transform duration-300">
          <Bell size={24} />
        </div>
        <div className="flex-1">
          <h3 className="text-text-primary font-display font-medium text-lg">Push Notifications</h3>
          <p className="text-text-secondary text-sm mt-1">
            Receive native alerts for budget thresholds, reminders, and daily summaries.
          </p>

          <div className="mt-4">
            {isSubscribed ? (
              <button
                onClick={handleUnsubscribe}
                disabled={loading}
                className="btn-danger w-full sm:w-auto flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <BellOff size={16} />}
                Disable Notifications
              </button>
            ) : (
              <button
                onClick={handleSubscribe}
                disabled={loading}
                className="btn-primary w-full sm:w-auto flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Bell size={16} />}
                Enable Notifications
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
