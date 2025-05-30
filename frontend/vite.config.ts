// frontend/vite.config.ts - Fixed with Cloudflare integration
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { cloudflare } from '@cloudflare/vite-plugin'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    react(),
    cloudflare({
      configPath: '../worker/wrangler.jsonc'
    })
  ],
  resolve: {
    alias: {
      '@portal/shared': resolve(__dirname, '../packages/shared/src/index.ts')
    }
  },
  server: {
    port: 5173,
    // REMOVED: proxy since cloudflareDevProxy handles this
  },
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify(
      process.env.NODE_ENV === 'production' 
        ? 'https://portal.777.foo/api'
        : '/api' // Use relative path with cloudflareDevProxy
    ),
    'import.meta.env.VITE_TURNSTILE_SITE_KEY': JSON.stringify(
      process.env.VITE_TURNSTILE_SITE_KEY || '0x4AAAAAABcgNHsEZnTPqdEV'
    ),
    'import.meta.env.VITE_STRIPE_PK': JSON.stringify(
      process.env.VITE_STRIPE_PK || 'pk_test_placeholder'
    ),
  }
})
