// 777lotto/portal/portal-bet/frontend/public/sw.js

self.addEventListener('push', event => {
  const data = event.data.json();
  console.log('New push notification received', data);
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/777-triangle.svg' // Your app's icon
    })
  );
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow('https://portal.777.foo/dashboard') // URL to open on click
    );
});
