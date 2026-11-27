/**
 * Build da BIBLIOTECA @archbase/reportlenz-designer-react (ADR-025): ESM, sem React,
 * Mantine, zustand nem jrxml-core dentro — peers/dependências resolvidos pela
 * aplicação. O build da SPA continua em vite.config.ts.
 */
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const externos = [/^react($|\/)/, /^react-dom($|\/)/, /^@mantine\//, /^zustand($|\/)/, /^@archbase\/reportlenz-jrxml-core$/];

export default defineConfig({
  plugins: [react()],
  // public/config.json é da SPA — não entra no pacote.
  publicDir: false,
  build: {
    outDir: 'dist-lib',
    emptyOutDir: true,
    sourcemap: true,
    lib: { entry: 'src/index.ts', formats: ['es'], fileName: () => 'index.js' },
    rollupOptions: { external: (id) => externos.some((e) => e.test(id)) },
  },
});
