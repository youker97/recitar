import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['iconos/*.png'],
      workbox: {
        // Todo el bundle queda precacheado: la app abre y funciona sin señal.
        globPatterns: ['**/*.{js,mjs,css,html,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: 'index.html',
      },
      manifest: {
        name: 'Recitar',
        short_name: 'Recitar',
        description: 'Estudiar produciendo de memoria, no releyendo.',
        lang: 'es-CL',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f5f2ea',
        theme_color: '#f5f2ea',
        icons: [
          { src: 'iconos/icono-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'iconos/icono-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'iconos/icono-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  build: { target: 'es2022' },
  test: {
    environment: 'node',
    include: ['pruebas/**/*.prueba.ts'],
  },
} as Parameters<typeof defineConfig>[0])
