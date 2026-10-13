import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // le service worker se met à jour tout seul à chaque nouveau déploiement
      registerType: 'autoUpdate',
      manifest: {
        name: 'Plotweaver',
        short_name: 'Plotweaver',
        description: 'Écris tes livres, chapitres et idées, même sans connexion.',
        lang: 'fr',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        theme_color: '#b45309',
        background_color: '#ffffff',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // tout le "shell" de l'app est mis en cache pour fonctionner sans internet
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // les routes React (ex. /chapters/3/versions) retombent sur index.html hors-ligne
        navigateFallback: '/index.html',
        // par défaut, tout fichier > 2 Mo est ignoré du cache (et l'app ne se charge plus hors-ligne)
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // supprime les anciens caches à chaque nouveau déploiement
        cleanupOutdatedCaches: true,
      },
      // pour tester le service worker pendant le dev, passe à true
      devOptions: { enabled: false },
    }),
  ],
  server: {
    host: true,
    port: 5173,
    allowedHosts: true,
  },
})