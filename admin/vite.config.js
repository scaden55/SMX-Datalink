import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, __dirname, 'VITE_');
    const backendTarget = env.VITE_API_BASE || 'http://localhost:3001';
    return {
        base: '/admin/',
        plugins: [react()],
        resolve: {
            alias: {
                '@': path.resolve(__dirname, './src'),
                '@aircraft-shapes': path.resolve(__dirname, '../assets/aircraft-shapes'),
            },
        },
        build: {
            outDir: 'dist',
            rollupOptions: {
                output: {
                    manualChunks: {
                        'vendor-three': ['three', '@react-three/fiber', '@react-three/drei'],
                        'vendor-leaflet': ['leaflet', 'react-leaflet'],
                        'vendor-recharts': ['recharts'],
                        'vendor-motion': ['motion'],
                    },
                },
            },
        },
        server: {
            host: true,
            port: 5174,
            proxy: {
                '/api': { target: backendTarget, changeOrigin: true },
                '/socket.io': { target: backendTarget, changeOrigin: true, ws: true },
            },
        },
    };
});
