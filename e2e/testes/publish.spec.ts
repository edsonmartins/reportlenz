import { expect, test } from '@playwright/test';
import { identidades, tokenDeApi } from '../apoio/keycloak';
import { abrirModelo, entrarComo } from '../apoio/sessao';

const API = process.env.DESIGNER_URL ?? 'http://localhost:8080';

/** Publish Wizard (RFC-006 §3) com os papéis do ADR-017 e os gates G1–G8. */
test.describe('publish', () => {
  test('designer vê os gates verdes, mas o serviço recusa o publish (403)', async ({ page }) => {
    await entrarComo(page, 'designer');
    await abrirModelo(page, 'formulario');
    await page.getByRole('button', { name: 'Publicar…' }).click();
    for (const g of ['G1', 'G2', 'G7', 'G8']) {
      await expect(page.getByTestId(`gate-${g}`)).toHaveAttribute('data-verde', 'true');
    }
    await page.getByTestId('publish-confirmar').click();
    await expect(page.getByTestId('publish-sem-autoridade')).toContainText('HTTP 403');
  });

  test('publicador publica o formulário e a auditoria registra o usuário do token', async ({ page }) => {
    const usuario = await entrarComo(page, 'publicador');
    await abrirModelo(page, 'formulario');
    await page.getByRole('button', { name: 'Publicar…' }).click();
    await expect(page.getByTestId('gate-G1')).toHaveAttribute('data-verde', 'true');
    await page.getByTestId('publish-confirmar').click();
    await expect(page.getByTestId('publish-ok')).toBeVisible();

    const token = await tokenDeApi(identidades().publicador);
    const r = await fetch(`${API}/templates/formulario_cadastro`, { headers: { Authorization: `Bearer ${token}` } });
    expect(r.status).toBe(200);
    const versoes = (await r.json()) as Array<{ status: string; criadoPor: string }>;
    expect(versoes.find((v) => v.status === 'published')?.criadoPor).toBe(usuario);
  });

  test('fatura: G8 bloqueia enquanto o subreport fatura_entregas não estiver publicado (ADR-020)', async ({ page }) => {
    const token = await tokenDeApi(identidades().publicador);
    const filho = await fetch(`${API}/templates/fatura_entregas`, { headers: { Authorization: `Bearer ${token}` } });
    test.skip(filho.status === 200, 'fatura_entregas já publicado neste ambiente — cenário só vale em ambiente limpo');

    await entrarComo(page, 'publicador');
    await abrirModelo(page, 'fatura');
    await page.getByRole('button', { name: 'Publicar…' }).click();
    const g8 = page.getByTestId('gate-G8');
    await expect(g8).not.toHaveAttribute('data-verde', 'true');
    await expect(g8).toContainText('fatura_entregas');
    await expect(page.getByTestId('publish-confirmar')).toBeDisabled();
  });
});
