import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.handy.man.pro',
  appName: 'Handyman Pro',
  webDir: 'dist/pro',
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
      backgroundColor: '#0d4d2e',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#0d4d2e',
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
      iconColor: '#0d4d2e',
    },
    Geolocation: {
      iosLocationWhenInUseDescription: 'Necesitamos tu ubicación para mostrar servicios cercanos y navegación',
      androidLocationPermission: 'ACCESS_FINE_LOCATION',
    },
    Camera: {
      iosCameraUsageDescription: 'Necesitamos acceso a la cámara para escanear códigos QR de verificación y subir evidencia de servicios',
      iosPhotoLibraryUsageDescription: 'Necesitamos acceso a la galería para subir evidencia de servicios completados',
    },
    FilePicker: {
      iosFilePickerUsageDescription: 'Necesitamos acceso a archivos para subir documentos y evidencia',
    },
    Share: {
      iosShareUsageDescription: 'Compartir perfil profesional y servicios',
    },
    Haptics: {},
    Device: {},
    App: {
      launchUrl: '/pro',
    },
    DeepLinks: {
      enabled: true,
      customScheme: 'handyman-pro',
      host: 'handy.man',
    },
  },
};

export default config;