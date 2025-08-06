// In: 777lotto/portal/portal-bet/chat-frontend/vite.config.ts

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // This is important for local development of the chat app
    proxy: {
      '/api': 'http://localhost:8788', // Proxies to the chat-worker
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          // Splits the large RealtimeKit UI library into its own file
          if (id.includes('@cloudflare/realtimekit-react-ui')) {
            return 'vendor-realtimekit-ui';
          }
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        }
      }
    }
  }
})
