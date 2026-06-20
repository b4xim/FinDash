/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

// To allow Next-PWA to do its default caching, we simply export an empty module,
// but we intercept push events.

self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  
  const title = data.title || "FinDash Alert";
  const body = data.body || "You have a new notification.";
  const icon = data.icon || "/icon-192x192.png";
  const url = data.url || "/";

  const options: NotificationOptions = {
    body,
    icon,
    data: { url },
    badge: "/icon-192x192.png", // Optional tiny monochrome icon
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const urlToOpen = new URL(event.notification.data?.url || "/", self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window/tab open with the target URL
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === urlToOpen && "focus" in client) {
          return client.focus();
        }
      }
      // If not, open a new one
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});

export {};
