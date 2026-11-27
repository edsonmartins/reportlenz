/**
 * E2E de interface do ReportLenz (Playwright) — roda contra o ambiente de
 * homologação em contêineres (deploy/docker-compose.homologacao.yml), com
 * login REAL no Keycloak (popup PKCE). Variáveis: as do deploy/.env
 * (DESIGNER_URL, KEYCLOAK_URL_PUBLICA, KEYCLOAK_ADMIN_USER/PASSWORD).
 */
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './testes',
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  // Imagens de referência SEM sufixo de plataforma: o PNG vem do engine no
  // contêiner Linux, idêntico no macOS local e no CI (ADR-022).
  snapshotPathTemplate: '{testDir}/__referencias__/{arg}{ext}',
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: process.env.DESIGNER_URL ?? 'http://localhost:8080',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'pt-BR',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Aplicação hospedeira de teste (ADR-025): construída por exemplos/host-react/preparar.sh
  // a partir dos tarballs dos pacotes; aqui só é servida (vite preview, porta 5300).
  webServer: {
    command: 'npm --prefix ../exemplos/host-react run preview',
    url: process.env.HOST_URL ?? 'http://localhost:5300',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
