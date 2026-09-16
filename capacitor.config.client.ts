import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.handy.man.client',
  appName: 'Handyman Cliente',
  webDir: 'dist/client',
  bundledWebRuntime: false,
  server: {
    url: 'https://handy.man',
    cleartext: false,
    allowNavigation: ['https://handy.man/*', 'https://api.handy.man/*'],
  },
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystorePassword: undefined,
      keystoreAlias: undefined,
      keystoreAliasPassword: undefined,
    },
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  ios: {
    contentInset: 'always',
    scrollEnabled: true,
    limitsNavigationsToAppBoundDomains: true,
    preferredContentMode: 'mobile',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#1e3a5f',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#1e3a5f',
      overlaysWebView: false,
    },
    Keyboard: {
      resize: 'body',
      style: 'dark',
      resizeOnFullScreen: true,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#1e3a5f',
    },
    Geolocation: {
      iosLocationWhenInUseDescription: 'Necesitamos tu ubicación para encontrar profesionales cercanos',
      androidLocationPermission: 'ACCESS_FINE_LOCATION',
    },
    Camera: {
      iosCameraUsageDescription: 'Necesitamos acceso a la cámara para subir fotos de servicios',
      iosPhotoLibraryUsageDescription: 'Necesitamos acceso a la galería para subir fotos',
    },
    Share: {
      iosShareUsageDescription: 'Compartir servicios con otros usuarios',
    },
    Haptics: {},
    Device: {},
    App: {
      launchUrl: '/cliente',
    },
    DeepLinks: {
      enabled: true,
      customScheme: 'handyman-client',
      host: 'handy.man',
    },
  },
};

export default config;