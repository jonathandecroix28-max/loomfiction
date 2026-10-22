import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'LoomFiction',
        short_name: 'LoomFiction',
        description: 'Écris tes livres, chapitres et idées, même sans connexion.',
        lang: 'fr',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        theme_color: '#b45309',
        background_color: '#ffffff',
        icons: [
          { src: 'public/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'public/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'public/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // tout le "shell" de l'app est mis en cache pour fonctionner sans internet
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // les routes React retombent sur index.html hors-ligne
        navigateFallback: '/index.html',
        // par défaut, tout fichier > 2 Mo est ignoré du cache (passé ici à 5 Mo)
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // supprime les anciens caches à chaque nouveau déploiement
        cleanupOutdatedCaches: true,
      },
      // pour tester le service worker pendant le dev, passe à true
      devOptions: { enabled: false },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'vendor-react'
            }
            if (id.includes('@tiptap')) {
              return 'vendor-tiptap'
            }
            if (
              id.includes('jszip') ||
              id.includes('dompurify') ||
              id.includes('idb') ||
              id.includes('axios')
            ) {
              return 'vendor-utils'
            }
          }
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
    allowedHosts: true,
  },
})