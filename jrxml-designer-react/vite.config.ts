import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    // Duas páginas: o designer e o retorno do OIDC (popup/iframe, ADR-017 §6).
    rollupOptions: {
      input: {
        main: 'index.html',
        oidcCallback: 'oidc-callback.html',
      },
    },
  },
  server: {
    port: 5187,
    // Preview real (RFC-004 §7): encaminha para o render-service local.
    proxy: {
      '/render': 'http://localhost:8087',
      '/assist': 'http://localhost:8087',
      '/publish': 'http://localhost:8087',
      '/templates': 'http://localhost:8087',
    },
  },
});
