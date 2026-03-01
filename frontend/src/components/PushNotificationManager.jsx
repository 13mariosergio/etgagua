import { useEffect, useState } from 'react';
import { api } from '../api';

const VAPID_PUBLIC_KEY = 'BCoKN2gFcTM4LSKbNPaDY0Ums-ztCIrUjYPFDYlclKOnso4-AAFBHUJlBzId74eFn9nIUZcnvm2HhMhQRvuodEI';

export default function PushNotificationManager() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkSubscription();
  }, []);

  async function checkSubscription() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setLoading(false);
      return;
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    setIsSubscribed(!!subscription);
    setLoading(false);
  }

  async function subscribeUser() {
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      
      // Solicitar permissão
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        alert('Permissão de notificação negada');
        setLoading(false);
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });

      // Enviar para o backend
      await api.post('/notifications/subscribe', subscription);
      
      setIsSubscribed(true);
      alert('Notificações ativadas com sucesso!');
    } catch (error) {
      console.error('Erro ao assinar:', error);
      alert('Erro ao ativar notificações');
    } finally {
      setLoading(false);
    }
  }

  async function unsubscribeUser() {
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        await api.post('/notifications/unsubscribe', { endpoint: subscription.endpoint });
      }
      setIsSubscribed(false);
      alert('Notificações desativadas');
    } catch (error) {
      console.error('Erro ao cancelar assinatura:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return null;

  return (
    <div style={{ padding: '10px', background: '#f5f5f5', borderRadius: '8px', marginBottom: '15px' }}>
      <p style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 'bold' }}>
        {isSubscribed ? '✅ Notificações Ativas' : '🔔 Notificações Desativadas'}
      </p>
      <button 
        onClick={isSubscribed ? unsubscribeUser : subscribeUser}
        style={{
          background: isSubscribed ? '#ff5252' : '#4caf50',
          color: 'white',
          border: 'none',
          padding: '8px 15px',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        {isSubscribed ? 'Desativar Notificações' : 'Ativar Notificações'}
      </button>
    </div>
  );
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
