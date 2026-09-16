import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'path';

export default defineConfig({
  base: '/client/',
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
    minify: 'esbuild',
    cssMinify: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/entries/client.ts'),
      },
    },
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Handyman Cliente',
        short_name: 'Cliente',
        description: 'Solicita servicios para tu hogar y negocio',
        theme_color: '#1e3a5f',
        background_color: '#f7f5ef',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/client/',
        start_url: '/client/',
        icons: [
          { src: '/icons/client-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/icons/client-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
        categories: ['business', 'productivity', 'utilities'],
        shortcuts: [
          { name: 'Solicitar servicio', short_name: 'Solicitar', description: 'Crear nueva solicitud', url: '/client/#request', icons: [{ src: '/icons/client-96.png', sizes: '96x96' }] },
          { name: 'Mis solicitudes', short_name: 'Mis pedidos', description: 'Ver estado de mis servicios', url: '/client/#requests', icons: [{ src: '/icons/client-96.png', sizes: '96x96' }] },
        ],
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