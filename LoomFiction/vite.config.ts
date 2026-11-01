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
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        theme_color: '#221510',
        background_color: '#221510',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          {
            name: 'Nouveau livre',
            short_name: 'Nouveau livre',
            description: 'Créer un nouveau livre',
            url: '/books?action=new',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
          }
        ],
        screenshots: [
          { src: '/screenshot-mobile.png', sizes: '1080x1920', type: 'image/png' },
          { src: '/screenshot-desktop.png', sizes: '1920x1080', type: 'image/png', form_factor: 'wide' }
        ]
      },
      workbox: {
        // tout le "shell" de l'app est mis en cache pour fonctionner sans internet
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // les polices ne sont pas toutes utiles : on ignore les alphabets que l'app n'emploie pas
        // (vérifier les noms réels dans dist/assets après un `npm run build`)
        globIgnores: ['**/*{cyrillic,greek,vietnamese}*.woff2'],
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
          if (!id.includes('node_modules')) return

          if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) {
            return 'vendor-react'
          }
          if (id.includes('@tiptap') || id.includes('prosemirror')) {
            return 'vendor-tiptap'
          }
          if (id.includes('lucide-react')) {
            return 'vendor-icons'
          }
          if (/[\\/]node_modules[\\/](jszip|dompurify|idb|axios)[\\/]/.test(id)) {
            return 'vendor-utils'
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