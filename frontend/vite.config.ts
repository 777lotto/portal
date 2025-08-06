// In: 777lotto/portal/portal-bet/frontend/vite.config.ts

import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc'; // Using your preferred swc plugin
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load environment variables from .env files
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],

    // PRESERVED: Your original server configuration for local development is kept intact.
    server: {
      port: 5173,
      proxy: {
        // Proxy API requests to the local worker running on port 8787
        '/api': {
          target: 'http://localhost:8787',
          changeOrigin: true,
        },
      },
    },

    // Build configuration (`pnpm build`)
    build: {
      sourcemap: true,
      outDir: 'dist',
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
        },
        // ADDED: The manualChunks logic to split large vendor libraries
        output: {
          manualChunks(id: string) {
            // Isolate large libraries into their own chunks
            if (id.includes('@cloudflare/realtimekit-react-ui')) {
              return 'vendor-realtimekit-ui';
            }
            if (id.includes('react-big-calendar')) {
              return 'vendor-calendar';
            }
            if (id.includes('node_modules')) {
              return 'vendor';
            }
          }
        }
      },
    },
  };
});
