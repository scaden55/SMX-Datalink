import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, 'VITE_');
  // When VITE_API_BASE is set (e.g. --mode vps), proxy to that server
  // Otherwise default to local backend
  const backendTarget = env.VITE_API_BASE || 'http://localhost:3001';

  return {
    // Relative paths so Electron can load via file:// protocol in production
    base: './',
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    // node-simconnect is transitively imported by @acars/shared (simvars.ts)
    // but never used in the browser — exclude it from bundling
    optimizeDeps: {
      exclude: ['node-simconnect'],
    },
    build: {
      rollupOptions: {
        external: ['node-simconnect'],
      },
    },
    server: {
      host: true,
      port: 5173,
      proxy: {
        '/api': {
          target: backendTarget,
          changeOrigin: true,
        },
        '/socket.io': {
          target: backendTarget,
          changeOrigin: true,
          ws: true,
        },
      },
    },
  };
});
