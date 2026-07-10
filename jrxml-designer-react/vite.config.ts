import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5187,
    // Preview real (RFC-004 §7): encaminha para o render-service local.
    proxy: {
      '/render': 'http://localhost:8087',
    },
  },
});
