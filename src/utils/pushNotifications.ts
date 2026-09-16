export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  tag?: string;
  data?: any;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  requireInteraction?: boolean;
  silent?: boolean;
  vibrate?: number[];
  timestamp?: number;
}

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || 
  'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.warn('Notificaciones no soportadas');
    return 'denied';
  }

  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';

  const permission = await Notification.requestPermission();
  return permission;
}

export async function subscribeToPush(): Promise<PushSubscriptionData | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push no soportado');
    return null;
  }

  const permission = await requestNotificationPermission();
  if (permission !== 'granted') {
    console.warn('Permiso denegado para notificaciones');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    
    let subscription = await registration.pushManager.getSubscription();
    
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as BufferSource
      });
    }

    const subData: PushSubscriptionData = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')!))),
        auth: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth')!)))
      }
    };

    console.log('[Push] Suscrito:', subData.endpoint);
    return subData;
  } catch (error) {
    console.error('[Push] Error suscribiendo:', error);
    return null;
  }
}

export async function unsubscribeFromPush(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      await subscription.unsubscribe();
      console.log('[Push] Desuscrito');
      return true;
    }
    return false;
  } catch (error) {
    console.error('[Push] Error desuscribiendo:', error);
    return false;
  }
}

export function showLocalNotification(payload: NotificationPayload): void {
  if (Notification.permission !== 'granted') return;

  const notification = new Notification(payload.title, {
    body: payload.body,
    icon: payload.icon || '/favicon.svg',
    badge: payload.badge || '/favicon.svg',
    tag: payload.tag,
    data: payload.data,
    requireInteraction: payload.requireInteraction ?? true,
    silent: payload.silent ?? false
  });

  notification.onclick = (event) => {
    event.preventDefault();
    window.focus();
    if (payload.data?.url) {
      window.location.href = payload.data.url;
    }
    notification.close();
  };

  if (payload.actions && payload.actions.length > 0) {
    // Las actions se manejan en el Service Worker
  }
}

export const NotificationTemplates = {
  serviceAssigned: (professionalName: string, serviceType: string): NotificationPayload => ({
    title: '🎉 Profesional asignado',
    body: `${professionalName} viene para tu ${serviceType}`,
    tag: 'service-assigned',
    data: { type: 'service_assigned', url: '/cliente' },
    actions: [
      { action: 'view', title: 'Ver detalles' },
      { action: 'chat', title: 'Chatear' }
    ]
  }),

  proEnRoute: (professionalName: string, etaMinutes: number): NotificationPayload => ({
    title: '🚗 Profesional en ruta',
    body: `${professionalName} llega en ~${etaMinutes} min`,
    tag: 'pro-en-route',
    data: { type: 'pro_en_route', url: '/cliente' },
    requireInteraction: false
  }),

  serviceStarted: (serviceType: string): NotificationPayload => ({
    title: '🔧 Servicio iniciado',
    body: `Tu ${serviceType} ha comenzado`,
    tag: 'service-started',
    data: { type: 'service_started', url: '/cliente' }
  }),

  serviceCompleted: (professionalName: string, amount: number): NotificationPayload => ({
    title: '✅ Servicio completado',
    body: `${professionalName} terminó. Paga S/ ${amount.toFixed(2)} con Yape/Plin`,
    tag: 'service-completed',
    data: { type: 'service_completed', url: '/cliente#payment' },
    actions: [
      { action: 'pay', title: 'Pagar ahora' },
      { action: 'rate', title: 'Calificar' }
    ],
    requireInteraction: true
  }),

  paymentConfirmed: (amount: number): NotificationPayload => ({
    title: '💰 Pago confirmado',
    body: `Recibiste S/ ${amount.toFixed(2)} en tu wallet`,
    tag: 'payment-confirmed',
    data: { type: 'payment_confirmed', url: '/pro' },
    requireInteraction: false
  }),

  membershipDue: (daysLeft: number, amount: number): NotificationPayload => ({
    title: '⚠️ Membresía por vencer',
    body: `Quedan ${daysLeft} días. Recarga S/ ${amount.toFixed(2)} para evitar suspensión`,
    tag: 'membership-due',
    data: { type: 'membership_due', url: '/pro#wallet' },
    actions: [
      { action: 'recharge', title: 'Recargar ahora' }
    ],
    requireInteraction: true
  }),

  membershipSuspended: (): NotificationPayload => ({
    title: '🔴 Cuenta suspendida',
    body: 'Tu membresía venció. Recarga para reactivar servicios',
    tag: 'membership-suspended',
    data: { type: 'membership_suspended', url: '/pro#wallet' },
    actions: [
      { action: 'recharge', title: 'Recargar y reactivar' }
    ],
    requireInteraction: true
  }),

  newMessage: (fromName: string, preview: string): NotificationPayload => ({
    title: `💬 ${fromName}`,
    body: preview.length > 50 ? preview.slice(0, 50) + '...' : preview,
    tag: 'new-message',
    data: { type: 'new_message', url: '/chat' },
    requireInteraction: false
  }),

  emergencyAlert: (serviceType: string, address: string): NotificationPayload => ({
    title: '🚨 EMERGENCIA',
    body: `${serviceType} en ${address}. Profesional certificado en camino`,
    tag: 'emergency-alert',
    data: { type: 'emergency', url: '/cliente' },
    requireInteraction: true,
    vibrate: [500, 200, 500, 200, 500]
  }),

  weeklyReport: (stats: { services: number; earnings: number; rating: number }): NotificationPayload => ({
    title: '📊 Resumen semanal',
    body: `${stats.services} servicios • S/ ${stats.earnings.toFixed(2)} • ${stats.rating}★`,
    tag: 'weekly-report',
    data: { type: 'weekly_report', url: '/pro#stats' }
  })
};

export async function initPushNotifications(): Promise<boolean> {
  const permission = await requestNotificationPermission();
  if (permission !== 'granted') return false;

  const subscription = await subscribeToPush();
  if (!subscription) return false;

  // En producción: enviar subscription al backend
  try {
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription)
    });
    return true;
  } catch {
    console.warn('[Push] No se pudo registrar suscripción en servidor');
    return true; // Local funciona igual
  }
}