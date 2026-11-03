import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
  return {
    base: './',
    server: {
      port: 3000,
      host: '0.0.0.0',
      // Arena/Cloud IDE previews proxy the dev server under a generated host.
      // Allowing the .e2b.app suffix keeps the live preview working without
      // hard-coding a sandbox id that changes between sessions.
      allowedHosts: ['.e2b.app'],
    },
    preview: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: ['.e2b.app'],
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
