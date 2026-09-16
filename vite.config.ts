import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'path';

const apps = {
  client: {
    appId: 'com.handy.man.client',
    appName: 'Handyman Cliente',
    shortName: 'Cliente',
    description: 'Solicita servicios para tu hogar y negocio',
    themeColor: '#1e3a5f',
    backgroundColor: '#f7f5ef',
    startUrl: '/cliente',
    scope: '/cliente/',
    icons: [
      { src: '/icons/client-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: '/icons/client-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
    shortcuts: [
      { name: 'Solicitar servicio', short_name: 'Solicitar', description: 'Crear nueva solicitud', url: '/cliente#request', icons: [{ src: '/icons/client-96.png', sizes: '96x96' }] },
      { name: 'Mis solicitudes', short_name: 'Mis pedidos', description: 'Ver estado de mis servicios', url: '/cliente#requests', icons: [{ src: '/icons/client-96.png', sizes: '96x96' }] },
    ],
  },
  pro: {
    appId: 'com.handy.man.pro',
    appName: 'Handyman Pro',
    shortName: 'Pro',
    description: 'Gestiona tus servicios como profesional verificado',
    themeColor: '#0d4d2e',
    backgroundColor: '#f0fdf4',
    startUrl: '/pro',
    scope: '/pro/',
    icons: [
      { src: '/icons/pro-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: '/icons/pro-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
    shortcuts: [
      { name: 'Solicitudes disponibles', short_name: 'Disponibles', description: 'Ver trabajos cerca de ti', url: '/pro/solicitudes', icons: [{ src: '/icons/pro-96.png', sizes: '96x96' }] },
      { name: 'Mi protección', short_name: 'Protección', description: 'Ver cobertura y aportes', url: '/pro/proteccion', icons: [{ src: '/icons/pro-96.png', sizes: '96x96' }] },
    ],
  },
  staff: {
    appId: 'com.handy.man.staff',
    appName: 'Handyman Staff',
    shortName: 'Staff',
    description: 'Gestión operativa para equipos de campo',
    themeColor: '#7c2d12',
    backgroundColor: '#fdf4ed',
    startUrl: '/staff',
    scope: '/staff/',
    icons: [
      { src: '/icons/staff-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: '/icons/staff-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
    shortcuts: [
      { name: 'Asignaciones', short_name: 'Asignaciones', description: 'Ver tareas asignadas', url: '/staff/asignaciones', icons: [{ src: '/icons/staff-96.png', sizes: '96x96' }] },
      { name: 'Equipos', short_name: 'Equipos', description: 'Gestionar equipo de campo', url: '/staff/equipos', icons: [{ src: '/icons/staff-96.png', sizes: '96x96' }] },
    ],
  },
};

function createAppConfig(appKey: keyof typeof apps) {
  const app = apps[appKey];
  return defineConfig({
    base: `/${appKey}/`,
    build: {
      outDir: `dist/${appKey}`,
      emptyOutDir: true,
      minify: 'esbuild',
      cssMinify: true,
      rollupOptions: {
        input: {
          main: resolve(__dirname, `src/entries/${appKey}.ts`),
        },
      },
    },
    plugins: [
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg'],
        manifest: {
          name: app.appName,
          short_name: app.shortName,
          description: app.description,
          theme_color: app.themeColor,
          background_color: app.backgroundColor,
          display: 'standalone',
          orientation: 'portrait-primary',
          scope: app.scope,
          start_url: app.startUrl,
          icons: app.icons,
          categories: ['business', 'productivity', 'utilities'],
          shortcuts: app.shortcuts,
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
      }),
    ],
  });
}

export default {
  client: createAppConfig('client'),
  pro: createAppConfig('pro'),
  staff: createAppConfig('staff'),
  admin: defineConfig({
    base: '/admin/',
    build: {
      outDir: 'dist/admin',
      emptyOutDir: true,
      minify: 'esbuild',
      cssMinify: true,
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'src/entries/admin.ts'),
        },
      },
    },
  }),
};