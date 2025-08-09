import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from 'tailwindcss';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), tailwindcss()],

    // This block tells Vite that '@' is an alias for the '/src' directory.
    // This is the main fix for the build error.
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
      },
    },

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
      outDir: 'dist',
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
        },
        output: {
          manualChunks(id) {
            // Creates a separate 'vendor' chunk for packages from node_modules
            if (id.includes('node_modules')) {
              return 'vendor';
            }
          }
        }
      },
    },
  };
});
