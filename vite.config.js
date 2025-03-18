import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), vueDevTools()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '0.0.0.0', // Écoute sur toutes les interfaces réseau
    port: 5173, // Port par défaut de Vite
    strictPort: true, // Échoue si le port est déjà utilisé
    hmr: {
      clientPort: 5173, // Force le port client pour HMR
    },
  },
})
