self.addEventListener("install", e => {
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", e => {
  if (e.request.mode !== "navigate" || e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request).catch(() =>
      new Response("Insonea est hors ligne. Reconnectez-vous, puis rechargez la page.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      })
    )
  );
});
