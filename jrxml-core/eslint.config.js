// ESLint (flat config) do jrxml-core — tarefa phase-0/1.2.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/'] },
  js.configs.recommended,
  // Regras type-checked apenas sobre o código do pacote (src/test).
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // I-7 (núcleo headless): nenhum import de framework de UI, em nenhuma hipótese.
      // O tsconfig sem lib "dom" já barra APIs de DOM; isto barra as dependências.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['vue', 'vue/*', '@vue/*'], message: 'I-7: jrxml-core é headless — sem Vue.' },
            { group: ['react', 'react/*', 'react-dom', 'react-dom/*'], message: 'I-7: jrxml-core é headless — sem React.' },
          ],
        },
      ],
    },
  },
  // Arquivos de configuração: sem type-checking (fora do tsconfig).
  {
    files: ['*.config.ts', '*.config.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  // Scripts Node utilitários (ESM puro, sem type-checking).
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: { console: 'readonly', process: 'readonly' },
    },
  },
);
