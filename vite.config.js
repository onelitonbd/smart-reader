import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'Smart Reader — Read beautifully',
        short_name: 'Smart Reader',
        description: 'A private, offline-first home for PDF reading, highlights, and notes.',
        theme_color: '#315c4c',
        background_color: '#f4f5f1',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        navigateFallback: '/index.html',
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        globPatterns: ['**/*.{js,mjs,css,html,svg,webp,pdf,png,woff2}'],
      },
    }),
  ],
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('pdfjs-dist')) return 'pdf-engine';
          if (id.includes('node_modules/react')) return 'react-vendor';
          return undefined;
        },
      },
    },
  },
});
