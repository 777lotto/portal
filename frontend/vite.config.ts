import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { cloudflareDevProxy } from '@cloudflare/vite-plugin'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    react(),
    cloudflareDevProxy({
      // This tells the plugin to proxy API requests to your worker
      configPath: './wrangler.jsonc',
      persistState: false,
      // Ensure your worker runs on a different port
      port: 8788,
    })
  ],
  resolve: {
    alias: {
      '@portal/shared': resolve(__dirname, '../packages/shared/src/index.ts')
    }
  },
  server: {
    port: 5173,
  },
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify(
      process.env.NODE_ENV === 'production' 
        ? 'https://portal.777.foo/api'
        : '' // Empty string - the proxy will handle /api routes
    ),
    'import.meta.env.VITE_TURNSTILE_SITE_KEY': JSON.stringify(
      process.env.VITE_TURNSTILE_SITE_KEY || '0x4AAAAAABcgNHsEZnTPqdEV'
    ),
    'import.meta.env.VITE_STRIPE_PK': JSON.stringify(
      process.env.VITE_STRIPE_PK || 'pk_test_placeholder'
    ),
  }
})
