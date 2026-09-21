/* Atlas VIP admin push service worker. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) { data = { body: event.data ? event.data.text() : "" }; }
  event.waitUntil(self.registration.showNotification(data.title || "Atlas VIP", {
    body: data.body || "Você recebeu uma nova notificação.",
    icon: "/pwa-192.png", badge: "/pwa-192.png", tag: data.tag || "atlas", renotify: true,
    data: { url: data.url || "/admin" },
  }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/admin";
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (const client of list) if ("focus" in client) { client.navigate(target).catch(() => {}); return client.focus(); }
    return self.clients.openWindow(target);
  }));
});
