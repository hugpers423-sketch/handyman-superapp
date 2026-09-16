import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Keyboard, KeyboardResize, KeyboardStyle } from '@capacitor/keyboard';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Geolocation } from '@capacitor/geolocation';
import { App } from '@capacitor/app';
import { Device } from '@capacitor/device';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Share } from '@capacitor/share';

export interface MobileAppConfig {
  apiUrl: string;
  wsUrl: string;
  vapidPublicKey: string;
}

class MobileApp {
  private initialized = false;
  private config: MobileAppConfig | null = null;

  async initialize(config: MobileAppConfig): Promise<void> {
    if (this.initialized) return;
    
    this.config = config;
    this.initialized = true;

    console.log('[MobileApp] Initializing Capacitor app...');
    
    await this.setupSplashScreen();
    await this.setupStatusBar();
    await this.setupKeyboard();
    await this.setupPushNotifications();
    await this.setupLocalNotifications();
    await this.setupGeolocation();
    await this.setupAppListeners();
    await this.setupDeepLinks();
    await this.setupHaptics();
    
    console.log('[MobileApp] Initialization complete');
  }

  private async setupSplashScreen(): Promise<void> {
    try {
      await SplashScreen.hide();
      console.log('[MobileApp] Splash screen hidden');
    } catch (error) {
      console.warn('[MobileApp] Splash screen setup failed:', error);
    }
  }

  private async setupStatusBar(): Promise<void> {
    try {
      await StatusBar.setBackgroundColor({ color: '#1e3a5f' });
      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.setOverlaysWebView({ overlay: false });
      console.log('[MobileApp] Status bar configured');
    } catch (error) {
      console.warn('[MobileApp] Status bar setup failed:', error);
    }
  }

  private async setupKeyboard(): Promise<void> {
    try {
      await Keyboard.setResizeMode({ mode: KeyboardResize.Body });
      await Keyboard.setStyle({ style: KeyboardStyle.Dark });
      
      Keyboard.addListener('keyboardWillShow', (info) => {
        document.body.style.setProperty('--keyboard-height', `${info.keyboardHeight}px`);
      });
      
      Keyboard.addListener('keyboardWillHide', () => {
        document.body.style.setProperty('--keyboard-height', '0px');
      });
      
      console.log('[MobileApp] Keyboard configured');
    } catch (error) {
      console.warn('[MobileApp] Keyboard setup failed:', error);
    }
  }

  private async setupPushNotifications(): Promise<void> {
    try {
      if (!this.config?.vapidPublicKey) return;

      const permResult = await PushNotifications.requestPermissions();
      if (permResult.receive === 'granted') {
        await PushNotifications.register();
        console.log('[MobileApp] Push notifications registered');
      }

      PushNotifications.addListener('registration', (token) => {
        console.log('[MobileApp] Push registration token:', token.value);
        this.sendTokenToBackend(token.value);
      });

      PushNotifications.addListener('registrationError', (error) => {
        console.error('[MobileApp] Push registration error:', error);
      });

      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('[MobileApp] Push received:', notification);
        this.handlePushNotification(notification);
      });

      PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        console.log('[MobileApp] Push action performed:', action);
        this.handlePushAction(action);
      });
    } catch (error) {
      console.warn('[MobileApp] Push notifications setup failed:', error);
    }
  }

  private async setupLocalNotifications(): Promise<void> {
    try {
      await LocalNotifications.requestPermissions();
      console.log('[MobileApp] Local notifications permission requested');
    } catch (error) {
      console.warn('[MobileApp] Local notifications setup failed:', error);
    }
  }

  private async setupGeolocation(): Promise<void> {
    try {
      const permResult = await Geolocation.requestPermissions();
      if (permResult.location === 'granted') {
        console.log('[MobileApp] Geolocation permission granted');
      }
    } catch (error) {
      console.warn('[MobileApp] Geolocation setup failed:', error);
    }
  }

  private async setupAppListeners(): Promise<void> {
    App.addListener('appStateChange', ({ isActive }) => {
      console.log('[MobileApp] App state changed:', isActive ? 'active' : 'background');
      if (isActive) {
        this.onAppResume();
      } else {
        this.onAppPause();
      }
    });

    App.addListener('backButton', ({ canGoBack }) => {
      if (!canGoBack) {
        App.exitApp();
      }
    });

    App.addListener('pause', () => {
      console.log('[MobileApp] App paused');
      this.onAppPause();
    });

    App.addListener('resume', () => {
      console.log('[MobileApp] App resumed');
      this.onAppResume();
    });
  }

  private async setupDeepLinks(): Promise<void> {
    App.addListener('appUrlOpen', (data) => {
      console.log('[MobileApp] Deep link opened:', data.url);
      this.handleDeepLink(data.url);
    });

    App.addListener('appRestoredResult', (data) => {
      console.log('[MobileApp] App restored result:', data);
    });
  }

  private async setupHaptics(): Promise<void> {
    try {
      await Haptics.vibrate();
      console.log('[MobileApp] Haptics initialized');
    } catch (error) {
      console.warn('[MobileApp] Haptics setup failed:', error);
    }
  }

  private async sendTokenToBackend(token: string): Promise<void> {
    if (!this.config?.apiUrl) return;
    
    try {
      await fetch(`${this.config.apiUrl}/api/push/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, platform: Capacitor.getPlatform() }),
      });
    } catch (error) {
      console.warn('[MobileApp] Failed to send push token:', error);
    }
  }

  private handlePushNotification(notification: any): void {
    if (notification.data?.type === 'service_update') {
      window.dispatchEvent(new CustomEvent('push:service-update', { detail: notification.data }));
    } else if (notification.data?.type === 'chat_message') {
      window.dispatchEvent(new CustomEvent('push:chat-message', { detail: notification.data }));
    } else if (notification.data?.type === 'verification') {
      window.dispatchEvent(new CustomEvent('push:verification', { detail: notification.data }));
    }
  }

  private handlePushAction(action: any): void {
    const { actionId, notification } = action;
    
    if (actionId === 'view_service') {
      const serviceId = notification.data?.serviceId;
      if (serviceId) {
        window.location.href = `/services/${serviceId}`;
      }
    } else if (actionId === 'accept_service') {
      window.dispatchEvent(new CustomEvent('push:accept-service', { detail: notification.data }));
    }
  }

  private handleDeepLink(url: string): void {
    try {
      const parsed = new URL(url);
      const path = parsed.pathname;
      const params = Object.fromEntries(parsed.searchParams);
      
      if (path.startsWith('/service/')) {
        const serviceId = path.split('/service/')[1];
        window.location.href = `/services/${serviceId}`;
      } else if (path.startsWith('/pro/')) {
        window.location.href = path;
      } else if (path === '/verify') {
        const code = params.code;
        if (code) {
          window.location.href = `/verify?code=${code}`;
        }
      }
    } catch (error) {
      console.warn('[MobileApp] Failed to parse deep link:', error);
    }
  }

  private onAppPause(): void {
    document.body.classList.add('app-background');
    window.dispatchEvent(new CustomEvent('app:pause'));
  }

  private onAppResume(): void {
    document.body.classList.remove('app-background');
    window.dispatchEvent(new CustomEvent('app:resume'));
    this.refreshAuthToken();
  }

  private async refreshAuthToken(): Promise<void> {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken && this.config?.apiUrl) {
        const response = await fetch(`${this.config.apiUrl}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        
        if (response.ok) {
          const data = await response.json();
          localStorage.setItem('accessToken', data.accessToken);
          localStorage.setItem('refreshToken', data.refreshToken);
        }
      }
    } catch (error) {
      console.warn('[MobileApp] Token refresh failed:', error);
    }
  }

  async shareService(serviceId: string, title: string, description: string): Promise<void> {
    try {
      await Share.share({
        title,
        text: description,
        url: `https://handy.man/services/${serviceId}`,
        dialogTitle: 'Compartir servicio',
      });
    } catch (error) {
      console.warn('[MobileApp] Share failed:', error);
    }
  }

  async getCurrentLocation(): Promise<{ latitude: number; longitude: number } | null> {
    try {
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
      });
      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
    } catch (error) {
      console.warn('[MobileApp] Get location failed:', error);
      return null;
    }
  }

  async scheduleLocalNotification(
    title: string,
    body: string,
    at: Date,
    data?: Record<string, any>
  ): Promise<void> {
    try {
      await LocalNotifications.schedule({
        notifications: [{
          title,
          body,
          id: Date.now(),
          schedule: { at },
          extra: data,
          sound: 'default',
          smallIcon: 'ic_stat_icon_config_sample',
          iconColor: '#1e3a5f',
        }],
      });
    } catch (error) {
      console.warn('[MobileApp] Schedule notification failed:', error);
    }
  }

  async cancelAllLocalNotifications(): Promise<void> {
    try {
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length > 0) {
        await LocalNotifications.cancel({ notifications: pending.notifications });
      }
    } catch (error) {
      console.warn('[MobileApp] Cancel notifications failed:', error);
    }
  }

  getPlatform(): string {
    return Capacitor.getPlatform();
  }

  isNative(): boolean {
    return Capacitor.isNativePlatform();
  }

  async getDeviceInfo(): Promise<any> {
    return await Device.getInfo();
  }

  async hapticImpact(style: ImpactStyle = ImpactStyle.Light): Promise<void> {
    try {
      await Haptics.impact({ style });
    } catch (error) {
      console.warn('[MobileApp] Haptic failed:', error);
    }
  }
}

export const mobileApp = new MobileApp();

export async function initializeMobileApp(config: MobileAppConfig): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await mobileApp.initialize(config);
  }
}