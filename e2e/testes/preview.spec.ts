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

  test('ADR-024: preview em aba própria, legível (página na largura da aba) e volta ao editor', async ({ page }) => {
    await entrarComo(page, 'designer');
    await abrirModelo(page, 'danfe');
    await page.getByRole('button', { name: 'Renderizar (Jasper)' }).click();
    await expect(page.getByRole('tab', { name: 'Preview (Jasper)' })).toHaveAttribute('aria-selected', 'true');
    const imagem = page.getByTestId('preview-img');
    await expect(imagem).toBeVisible();
    // Painel lateral antigo: ~350px; a aba ajusta à largura (viewport 1280).
    expect((await imagem.boundingBox())!.width).toBeGreaterThan(900);
    if (process.env.CAPTURAS) await page.screenshot({ path: `${process.env.CAPTURAS}/preview.png` });

    await page.getByRole('tab', { name: 'Editor' }).click();
    await expect(page.getByTestId('canvas')).toBeVisible();
    await expect(page.getByTestId('rotulo-aproximacao')).toBeVisible(); // I-8 no editor
    if (process.env.CAPTURAS) await page.screenshot({ path: `${process.env.CAPTURAS}/editor.png` });
  });
});
