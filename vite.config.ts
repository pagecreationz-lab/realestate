import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: { '/api': 'http://localhost:4000' },
  },
  preview: { host: '0.0.0.0', port: 3000 },
});
