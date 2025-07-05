import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load environment variables from .env files
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],

    // Server configuration for local development (`pnpm dev`)
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
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
        },
      },
    },
  };
});
