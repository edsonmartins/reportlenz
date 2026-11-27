import { expect, test } from '@playwright/test';
import { entrarComo } from '../apoio/sessao';

/** Sessão OIDC na SPA (ADR-017 §6) com Keycloak REAL. */
test.describe('sessão', () => {
  test('anônimo vê "Entrar" e a SPA não chama a API', async ({ page }) => {
    const chamadasDeApi: string[] = [];
    page.on('request', (r) => {
      if (/\/(render|assist|publish|templates)(\/|$)/.test(new URL(r.url()).pathname)) chamadasDeApi.push(r.url());
    });
    await page.goto('/');
    await expect(page.getByTestId('sessao-entrar')).toBeVisible();
    await expect(page.getByTestId('galeria')).toHaveCount(0);
    expect(chamadasDeApi).toEqual([]);
  });

  test('login por popup (PKCE) → designer com o usuário; nada em web storage; Sair volta a "Entrar"', async ({ page }) => {
    const usuario = await entrarComo(page, 'designer');
    await page.getByTestId('modelo-em_branco').getByRole('button', { name: 'Usar' }).click();
    await expect(page.getByTestId('sessao-usuario')).toHaveText(usuario);
    const storage = await page.evaluate(() => ({ local: localStorage.length, sessao: sessionStorage.length }));
    expect(storage).toEqual({ local: 0, sessao: 0 });

    await page.getByRole('button', { name: 'Sair' }).click();
    await page.waitForURL(/localhost:8080|\/$/);
    await expect(page.getByTestId('sessao-entrar')).toBeVisible();
  });

  test('recarregar a página reaproveita a sessão SSO (signinSilent, sem clique)', async ({ page }) => {
    await entrarComo(page, 'designer');
    await page.reload();
    await expect(page.getByTestId('galeria')).toBeVisible();
    await expect(page.getByTestId('sessao-entrar')).toHaveCount(0);
  });
});
