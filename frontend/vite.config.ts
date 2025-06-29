import { defineConfig } from 'vite';
// Using the SWC version of the React plugin from your original file
import react from '@vitejs/plugin-react-swc';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  // Kept your original plugins array
  plugins: [react()],

  // Kept your original server port and added the proxy for local dev
  server: {
    port: 5173,
    proxy: {
      // Proxy any request starting with /api to the Worker's dev server
      '/api': {
        target: 'http://localhost:8787', // Default wrangler dev port
        changeOrigin: true,
      },
    },
  },

  // Kept your original build configuration
  build: {
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
    },
  },

  // Kept your original 'define' block for injecting environment variables
  // and public keys into the frontend code.
  define: {
    // NOTE: This VITE_API_URL is no longer needed. The proxy handles it for local
    // development, and in production, the API is on the same domain ("/api").
    // 'import.meta.env.VITE_API_URL': JSON.stringify(process.env.NODE_ENV === 'production' ? 'https://portal.777.foo' : ''),

    'import.meta.env.VITE_TURNSTILE_SITE_KEY': JSON.stringify(
      process.env.VITE_TURNSTILE_SITE_KEY || '0x4AAAAAABcgNHsEZnTPqdEV'
    ),
    'import.meta.env.VITE_STRIPE_PK': JSON.stringify(
      process.env.VITE_STRIPE_PK || 'pk_live_51MBf4rHNec9XrT0Fy63H12UL5Vxkcw5GNVmyuXS8b3DdYbBAQVVtd1wpshGBgwZtz8NkCHz7ZhExYDDt0fn9RTGd009jbyk3Gj'
    ),
  },

  // REMOVED the 'worker' block and the 'cloudflare()' plugin as they
  // were part of the old two-worker architecture and are no longer needed.
});
