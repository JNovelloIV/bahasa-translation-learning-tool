import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev, the frontend talks to the Worker (wrangler dev on :8787) via the
// /api proxy below — so client code never needs the Worker's absolute URL and
// CORS is a non-issue locally. In production set VITE_API_BASE to your Worker URL.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
