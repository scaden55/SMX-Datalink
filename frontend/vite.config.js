import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
export default defineConfig({
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
                target: 'http://localhost:3001',
                changeOrigin: true,
            },
            '/socket.io': {
                target: 'http://localhost:3001',
                changeOrigin: true,
                ws: true,
            },
        },
    },
});
