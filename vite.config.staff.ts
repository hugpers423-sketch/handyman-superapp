import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'path';

export default defineConfig({
  base: '/staff/',
  build: {
    outDir: 'dist/staff',
    emptyOutDir: true,
    minify: 'esbuild',
    cssMinify: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/entries/staff.ts'),
      },
    },
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Handyman Staff',
        short_name: 'Staff',
        description: 'Gestión operativa para equipos de campo',
        theme_color: '#7c2d12',
        background_color: '#fdf4ed',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/staff/',
        start_url: '/staff/',
        icons: [
          { src: '/icons/staff-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/icons/staff-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
        categories: ['business', 'productivity', 'utilities'],
        shortcuts: [
          { name: 'Asignaciones', short_name: 'Asignaciones', description: 'Ver tareas asignadas', url: '/staff/asignaciones', icons: [{ src: '/icons/staff-96.png', sizes: '96x96' }] },
          { name: 'Equipos', short_name: 'Equipos', description: 'Gestionar equipo de campo', url: '/staff/equipos', icons: [{ src: '/icons/staff-96.png', sizes: '96x96' }] },
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