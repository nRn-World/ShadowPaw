import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
  return {
    base: './',
    server: {
      port: 3000,
      host: '0.0.0.0',
      // Remote dev previews (CI sandboxes, phone testing on the LAN, tunnels)
      // use a generated hostname. Vite otherwise rejects those requests.
      allowedHosts: true as const,
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
