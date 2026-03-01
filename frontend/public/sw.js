self.addEventListener('push', function(event) {
  let data = { 
    title: '🚚 Novo Pedido!', 
    body: 'Você tem uma nova entrega disponível.',
    url: '/entregador' 
  };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/logo.png',
    badge: '/logo.png',
    vibrate: [500, 110, 500, 110, 450, 110, 200, 110, 170, 40, 450, 110, 200, 110, 170, 40], // Padrão de vibração forte
    data: { url: data.url || '/entregador' },
    actions: [{ action: 'open', title: 'Ver Pedido' }],
    requireInteraction: true,
    tag: 'novo-pedido',
    renotify: true,
    // O som é controlado pelo sistema operacional com base na importância da notificação
    silent: false 
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (let i = 0; i < clientList.length; i++) {
        let client = clientList[i];
        if (client.url.includes('/entregador') && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(event.notification.data.url);
    })
  );
});
