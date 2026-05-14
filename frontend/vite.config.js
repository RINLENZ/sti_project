import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        // Exclure les gros modèles ML du cache SW (trop lourds)
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
          globIgnores: ['**/models/**', '**/ort-wasm**', '**/vision_bundle**'],
          runtimeCaching: [
            // API : stale-while-revalidate — affiche le cache, met à jour en arrière-plan
            {
              urlPattern: /\/api\//,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'sensia-api',
                expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 }, // 24h
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            // Auth : NetworkFirst — toujours vérifier l'identité en ligne
            {
              urlPattern: /\/auth\//,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'sensia-auth',
                networkTimeoutSeconds: 5,
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            // Google Fonts
            {
              urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts',
                expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              },
            },
          ],
        },
        manifest: {
          name: 'SenSia — Tutorat Intelligent',
          short_name: 'SenSia',
          description: 'Plateforme de tutorat IA adaptative pour le programme camerounais',
          theme_color: '#6B3A2A',
          background_color: '#FAF6F3',
          display: 'standalone',
          orientation: 'portrait-primary',
          start_url: '/',
          scope: '/',
          lang: 'fr',
          icons: [
            { src: '/logo.png', sizes: '192x192', type: 'image/png' },
            { src: '/logo.png', sizes: '512x512', type: 'image/png' },
            { src: '/logo.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
      }),
    ],

    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(
        env.VITE_API_URL || 'http://localhost:8000'
      ),
    },

    build: {
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/react/') ||
                id.includes('node_modules/react-dom/') ||
                id.includes('node_modules/react-router-dom/') ||
                id.includes('node_modules/scheduler/')) {
              return 'vendor-react'
            }
            if (id.includes('node_modules/@reduxjs/') ||
                id.includes('node_modules/react-redux/') ||
                id.includes('node_modules/redux/')) {
              return 'vendor-redux'
            }
            if (id.includes('node_modules/recharts') ||
                id.includes('node_modules/d3-') ||
                id.includes('node_modules/victory-')) {
              return 'vendor-recharts'
            }
            if (id.includes('node_modules/lucide-react')) {
              return 'vendor-lucide'
            }
            if (id.includes('node_modules/onnxruntime') ||
                id.includes('node_modules/@mediapipe')) {
              return 'vendor-ml'
            }
          },
        },
      },
    },
  }
})
