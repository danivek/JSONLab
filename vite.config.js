import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  root: 'src',
  base: './',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    minify: 'terser',
    rollupOptions: {
      output: {
        entryFileNames: 'js/[name]-[hash].js',
        chunkFileNames: 'js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.names?.some((n) => /\.(css)$/.test(n))) return 'css/[name]-[hash][extname]';
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['css/favicon.svg', 'icons/apple-touch-icon.png', 'icons/icon.svg'],
      manifest: {
        name: 'JSONLab',
        short_name: 'JSONLab',
        description:
          'Advanced JSON editor to view, edit, format, validate, repair, query, and compare JSON data.',
        theme_color: '#4f46e5',
        background_color: '#f5f5f5',
        display: 'standalone',
        start_url: './',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: 'icons/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
          },
        ],
      },
      strategies: 'injectManifest',
      srcDir: '.',
      filename: 'sw.js',
    }),
  ],
});
