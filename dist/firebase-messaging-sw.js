// public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/9.1.3/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.1.3/firebase-messaging-compat.js');
firebase.initializeApp({
apiKey: self.location.search.match(/apiKey=([^&]+)/)?.[1],
authDomain: self.location.search.match(/authDomain=([^&]+)/)?.[1],
projectId: self.location.search.match(/projectId=([^&]+)/)?.[1],
messagingSenderId: self.location.search.match(/messagingSenderId=([^&]+)/)?.[1],
appId: self.location.search.match(/appId=([^&]+)/)?.[1],
});
const messaging = firebase.messaging();
// Optional: background handler
messaging.onBackgroundMessage((payload) => {
self.registration.showNotification(payload.notification?.title, { body: payload.notification?.body });
});