// frontend/vite.config.ts - Updated with proper environment handling
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@portal/shared': resolve(__dirname, '../packages/shared/src/index.ts')
    }
  },
  server: {
    port: 5173,
    proxy: {
      // Proxy API calls to your worker during development
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:8787',
        changeOrigin: true,
        secure: false, // Set to true in production
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err);
          });
        },
      }
    }
  },
  define: {
    // Make environment variables available to the React app
    'import.meta.env.VITE_API_URL': JSON.stringify(
      process.env.VITE_API_URL || 'http://localhost:8787/api'
    ),
    'import.meta.env.VITE_TURNSTILE_SITE_KEY': JSON.stringify(
      process.env.VITE_TURNSTILE_SITE_KEY || '0x4AAAAAABcgNHsEZnTPqdEV'
    ),
    'import.meta.env.VITE_STRIPE_PK': JSON.stringify(
      process.env.VITE_STRIPE_PK || 'pk_test_placeholder'
    ),
  },
  build: {
    // Ensure environment variables are available during build
    rollupOptions: {
      // Make sure to replace process.env variables during build
      plugins: []
    }
  }
})
