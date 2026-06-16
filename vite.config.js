import { defineConfig } from 'vite';

// base: './' makes asset paths relative so they work in Capacitor WebView
// (Android serves from https://localhost/ or file:// where absolute /assets fails)
export default defineConfig({
  base: './',
  build: {
    chunkSizeWarningLimit: 3000
  },
  server: { host: true }
});