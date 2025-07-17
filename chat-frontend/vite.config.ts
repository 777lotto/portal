import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  server: {
    // Run the chat-frontend on a different port
    port: 5174,
    proxy: {
      // Proxy API requests to the local chat-worker
      '/api': {
        target: 'http://localhost:8788',
        changeOrigin: true,
      },
    },
  },
});
