// frontend/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
// CORRECTED: Import 'cloudflare' instead of 'cloudflareDevProxy'
import { cloudflare } from '@cloudflare/vite-plugin'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    // CORRECTED: Call the cloudflare() plugin directly
    cloudflare(),
    react()
  ],
  server: {
    port: 5173,
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      }
    }
  },
  worker: {
    format: 'es',
  },
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify(
      process.env.NODE_ENV === 'production'
        ? 'https://portal.777.foo/api'
        : ''
    ),
    'import.meta.env.VITE_TURNSTILE_SITE_KEY': JSON.stringify(
      process.env.VITE_TURNSTILE_SITE_KEY || '0x4AAAAAABcgNHsEZnTPqdEV'
    ),
    'import.meta.env.VITE_STRIPE_PK': JSON.stringify(
      process.env.VITE_STRIPE_PK || 'pk_test_placeholder'
    ),
  }
})
