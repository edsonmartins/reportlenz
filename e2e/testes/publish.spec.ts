import { expect, test } from '@playwright/test';
import { identidades, tokenDeApi } from '../apoio/keycloak';
import { abrirModelo, entrarComo } from '../apoio/sessao';

const API = process.env.DESIGNER_URL ?? 'http://localhost:8080';

/**
 * Publish Wizard (RFC-006 §3) com os papéis do ADR-017. O G8 (subreport da
 * fatura) é coberto nos dois sentidos em catalogo.spec.ts.
 */
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
});
