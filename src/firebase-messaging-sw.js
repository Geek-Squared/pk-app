/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/9.0.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyAyQhv2xlj15JF7_o7DbBLRSB4XTXQL1FQ',
  authDomain: 'positive-konnections-42d8a.firebaseapp.com',
  projectId: 'positive-konnections-42d8a',
  storageBucket: 'positive-konnections-42d8a.appspot.com',
  messagingSenderId: '803337097020',
  appId: '1:803337097020:web:ba78819354d9754930d839',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload?.notification?.title || 'Positive Konnections';
  const options = {
    body: payload?.notification?.body || 'You have a new notification.',
    data: payload?.data || {},
  };

  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification?.data || {};

  let targetUrl = data?.url || '';
  if (!targetUrl && data?.landing_page) {
    targetUrl = data.landing_page;
    if (data?.chatId) {
      targetUrl = `${targetUrl}/${data.chatId}`;
    }
  }

  if (targetUrl && !targetUrl.startsWith('/')) {
    targetUrl = `/${targetUrl}`;
  }

  if (!targetUrl) {
    return;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
