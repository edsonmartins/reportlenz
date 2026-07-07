import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Núcleo headless (I-7): os testes rodam em Node puro, sem ambiente de DOM.
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
