// ============================================================
// firebase-messaging-sw.js
// Coloque este arquivo em: frontend/public/firebase-messaging-sw.js
// ============================================================

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// ⚠️ SUBSTITUA com suas credenciais do Firebase Console
firebase.initializeApp({
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  projectId: "SEU_PROJETO",
  storageBucket: "SEU_PROJETO.appspot.com",
  messagingSenderId: "SEU_SENDER_ID",
  appId: "SEU_APP_ID"
});

const messaging = firebase.messaging();

// ✅ Esta função é chamada quando o app está em BACKGROUND ou com tela BLOQUEADA
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Notificação em background recebida:', payload);

  const { title, body, icon } = payload.notification || {};

  // Vibração via Service Worker (funciona com tela bloqueada no Android)
  self.registration.showNotification(title || '🚚 Novo Pedido!', {
    body: body || 'Um novo pedido chegou!',
    icon: icon || '/logo.png',
    badge: '/logo.png',
    tag: payload.data?.pedidoId ? `pedido-${payload.data.pedidoId}` : 'novo-pedido',
    requireInteraction: true,       // Mantém a notificação até o usuário tocar
    vibrate: [200, 100, 200, 100, 400], // Padrão de vibração (igual WhatsApp)
    sound: '/notificatio.mp3',      // Toca o som (suporte varia por dispositivo)
    data: payload.data || {},
    actions: [
      { action: 'ver', title: '👀 Ver Pedido' },
      { action: 'ok',  title: '✅ OK'          }
    ]
  });
});

// Ao clicar na notificação, abre o app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
