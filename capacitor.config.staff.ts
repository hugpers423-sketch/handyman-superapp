import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.handy.man.staff',
  appName: 'Handyman Staff',
  webDir: 'dist/staff',
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
      backgroundColor: '#7c2d12',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#7c2d12',
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
      iconColor: '#7c2d12',
    },
    Geolocation: {
      iosLocationWhenInUseDescription: 'Necesitamos tu ubicación para gestionar equipos en campo',
      androidLocationPermission: 'ACCESS_FINE_LOCATION',
    },
    Camera: {
      iosCameraUsageDescription: 'Necesitamos acceso a la cámara para documentar servicios y equipos',
      iosPhotoLibraryUsageDescription: 'Necesitamos acceso a la galería para subir documentación',
    },
    FilePicker: {
      iosFilePickerUsageDescription: 'Necesitamos acceso a archivos para gestionar documentación',
    },
    Share: {
      iosShareUsageDescription: 'Compartir reportes y asignaciones',
    },
    Haptics: {},
    Device: {},
    App: {
      launchUrl: '/staff',
    },
    DeepLinks: {
      enabled: true,
      customScheme: 'handyman-staff',
      host: 'handy.man',
    },
  },
};

export default config;