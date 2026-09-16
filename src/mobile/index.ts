import { mobileApp, initializeMobileApp } from './app';

declare global {
  interface Window {
    MOBILE_CONFIG: {
      apiUrl: string;
      wsUrl: string;
      vapidPublicKey: string;
    };
  }
}

async function bootstrapMobile(): Promise<void> {
  const config = window.MOBILE_CONFIG || {
    apiUrl: import.meta.env.VITE_API_URL || 'https://api.handy.man',
    wsUrl: import.meta.env.VITE_WS_URL || 'wss://api.handy.man',
    vapidPublicKey: import.meta.env.VITE_VAPID_PUBLIC_KEY || '',
  };

  await initializeMobileApp(config);
}

if (typeof window !== 'undefined') {
  bootstrapMobile().catch(console.error);
}

export { mobileApp };