/* Service worker do Atlas VIP — usado apenas para notificações push. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

const recentTags = new Map();

function isDuplicateTag(tag) {
  if (!tag) return false;
  const now = Date.now();
  for (const [key, ts] of recentTags.entries()) {
    if (now - ts > 30000) recentTags.delete(key);
  }
  if (recentTags.has(tag)) return true;
  recentTags.set(tag, now);
  return false;
}

function isSupportChatVisible(clients, data) {
  const kind = data.kind || "";
  const isUserSupport = kind === "reply" || (data.url && data.url.includes("suporte=1"));
  const isAdminSupport = kind === "message" || kind === "receipt" || (data.url && data.url.includes("tab=support"));
  if (!isUserSupport && !isAdminSupport) return false;

  for (const client of clients) {
    if (client.visibilityState !== "visible") continue;
    try {
      const u = new URL(client.url);
      if (isUserSupport && u.pathname.startsWith("/painel") && u.searchParams.get("suporte") === "1") {
        return true;
      }
      if (isAdminSupport && u.pathname.startsWith("/admin") && u.searchParams.get("tab") === "support") {
        const openThread = u.searchParams.get("thread");
        if (!data.threadId || !openThread || openThread === data.threadId) return true;
      }
    } catch (_) {
      // Ignora URL malformada
    }
  }
  return false;
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = { body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Atlas VIP";
  const tag = data.tag || "atlas";
  const options = {
    body: data.body || "Você recebeu uma nova notificação.",
    icon: "/pwa-192.png",
    badge: "/pwa-192.png",
    tag,
    renotify: !data.messageId,
    data: { url: data.url || "/admin" },
  };

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      if (isSupportChatVisible(clients, data)) return;
      if (data.messageId && isDuplicateTag(tag)) return;
      return self.registration.showNotification(title, options);
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/admin";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const targetUrl = new URL(target, self.location.origin);
      for (const client of list) {
        if ("focus" in client) {
          try {
            const currentUrl = new URL(client.url);
            if (currentUrl.pathname === targetUrl.pathname) {
              client.postMessage({ type: "ATLAS_OPEN_URL", url: target });
              return client.focus();
            }
          } catch (_) {
            // Fallback para navigate
          }
          return client.navigate(target).then((navigated) => (navigated || client).focus()).catch(() => client.focus());
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
