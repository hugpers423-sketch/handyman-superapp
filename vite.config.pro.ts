import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'path';

export default defineConfig({
  base: '/pro/',
  build: {
    outDir: 'dist/pro',
    emptyOutDir: true,
    minify: 'esbuild',
    cssMinify: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/entries/pro.ts'),
      },
    },
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Handyman Pro',
        short_name: 'Pro',
        description: 'Gestiona tus servicios como profesional verificado',
        theme_color: '#0d4d2e',
        background_color: '#f0fdf4',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/pro/',
        start_url: '/pro/',
        icons: [
          { src: '/icons/pro-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/icons/pro-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
        categories: ['business', 'productivity', 'utilities'],
        shortcuts: [
          { name: 'Solicitudes disponibles', short_name: 'Disponibles', description: 'Ver trabajos cerca de ti', url: '/pro/solicitudes', icons: [{ src: '/icons/pro-96.png', sizes: '96x96' }] },
          { name: 'Mi protección', short_name: 'Protección', description: 'Ver cobertura y aportes', url: '/pro/proteccion', icons: [{ src: '/icons/pro-96.png', sizes: '96x96' }] },
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