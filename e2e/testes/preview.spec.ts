import { expect, test } from '@playwright/test';
import { abrirModelo, entrarComo } from '../apoio/sessao';

/** Render REAL pelo engine (I-8) através do nginx, com Bearer. */
test.describe('preview Jasper', () => {
  test('comprovante renderiza e a chamada leva Bearer', async ({ page }) => {
    await entrarComo(page, 'designer');
    await abrirModelo(page, 'comprovante');
    const [pedido] = await Promise.all([
      page.waitForRequest((r) => r.url().endsWith('/render/preview') && r.method() === 'POST'),
      page.getByRole('button', { name: 'Renderizar (Jasper)' }).click(),
    ]);
    expect(pedido.headers()['authorization']).toMatch(/^Bearer [\w-]+\.[\w-]+\.[\w-]+$/);
    await expect(page.getByTestId('preview-img')).toBeVisible();
    await expect(page.getByTestId('preview-erro')).toHaveCount(0);
  });

  test('etiqueta A4 com EAN13 renderiza (dados de exemplo válidos para o código de barras)', async ({ page }) => {
    await entrarComo(page, 'designer');
    await abrirModelo(page, 'etiqueta_a4');
    await page.getByRole('button', { name: 'Renderizar (Jasper)' }).click();
    await expect(page.getByTestId('preview-img')).toBeVisible();
    await expect(page.getByTestId('preview-erro')).toHaveCount(0);
  });
});
