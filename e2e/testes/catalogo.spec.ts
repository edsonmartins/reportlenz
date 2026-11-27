import { expect, test, type Page } from '@playwright/test';
import { REFERENCE_TEMPLATES, buildInputSchema, extractContract, serializeJrxml } from '@reportlenz/jrxml-core';
import { identidades, tokenDeApi } from '../apoio/keycloak';
import { abrirModelo, entrarComo } from '../apoio/sessao';

const API = process.env.DESIGNER_URL ?? 'http://localhost:8080';

/**
 * Matriz de interface do catálogo (ADR-022, change variacoes-de-templates/5.1):
 * para CADA modelo da galeria — abrir, renderizar no engine real, comparar o
 * PNG com a imagem de referência versionada e publicar como publicador.
 * A lista vem do jrxml-core: modelo novo entra sozinho (e sem imagem de
 * referência o teste falha até ela ser gerada com --update-snapshots).
 *
 * Regressão visual: o PNG vem do ENGINE no contêiner Linux (não do navegador),
 * então é o mesmo localmente e no CI; a tolerância cobre só antialiasing.
 */
const MODELOS = Object.entries(REFERENCE_TEMPLATES)
  .filter(([, t]) => t.properties['reportlenz.template.tipo'] !== 'subreport')
  .map(([chave]) => chave);

async function renderizarEComparar(page: Page, chave: string): Promise<void> {
  const [resposta] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/render/preview') && r.request().method() === 'POST'),
    page.getByRole('button', { name: 'Renderizar (Jasper)' }).click(),
  ]);
  expect(resposta.status(), await resposta.text().catch(() => '')).toBe(200);
  await expect(page.getByTestId('preview-img')).toBeVisible();
  await expect(page.getByTestId('preview-erro')).toHaveCount(0);
  expect(await resposta.body()).toMatchSnapshot(`${chave}.png`, { maxDiffPixelRatio: 0.01 });
}

async function publicarPeloWizard(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Publicar…' }).click();
  for (const g of ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8']) {
    await expect(page.getByTestId(`gate-${g}`)).toHaveAttribute('data-verde', 'true');
  }
  await page.getByTestId('publish-confirmar').click();
  await expect(page.getByTestId('publish-ok')).toBeVisible();
}

/** Salva e publica um modelo do catálogo pela API (o que o time faria para uma dependência). */
async function publicarPelaApi(chave: string): Promise<void> {
  const template = REFERENCE_TEMPLATES[chave]!;
  const token = await tokenDeApi(identidades().publicador);
  const cabecalhos = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const salvo = await fetch(`${API}/templates/${template.name}/versoes`, {
    method: 'POST',
    headers: cabecalhos,
    body: JSON.stringify({
      jrxml: serializeJrxml(template),
      inputSchema: buildInputSchema(extractContract(template), { templateName: template.name, version: 1 }),
    }),
  });
  expect(salvo.status).toBe(200);
  const { version } = (await salvo.json()) as { version: number };
  const publicado = await fetch(`${API}/templates/${template.name}/versoes/${version}/publicar`, { method: 'POST', headers: cabecalhos });
  expect(publicado.status).toBe(200);
}

test.describe('catálogo de modelos (ADR-022)', () => {
  test('a galeria mostra os 14 modelos do catálogo', async ({ page }) => {
    expect(MODELOS).toHaveLength(14);
    await entrarComo(page, 'designer');
    for (const chave of MODELOS) {
      await expect(page.getByTestId(`modelo-${chave}`)).toBeVisible();
    }
  });

  for (const chave of MODELOS.filter((c) => c !== 'fatura')) {
    test(`${chave}: preview real igual à referência visual e publish pelo publicador`, async ({ page }) => {
      await entrarComo(page, 'publicador');
      await abrirModelo(page, chave);
      await renderizarEComparar(page, chave);
      await publicarPeloWizard(page);
    });
  }

  /**
   * ADR-020 nos dois sentidos: sem o filho publicado o G8 bloqueia e o
   * preview recusa; publicado o filho, o G8 fica verde, o preview renderiza
   * e a fatura publica.
   */
  test('fatura: G8 bloqueia sem fatura_entregas e libera depois de publicá-lo', async ({ page }) => {
    const token = await tokenDeApi(identidades().publicador);
    const filho = await fetch(`${API}/templates/fatura_entregas`, { headers: { Authorization: `Bearer ${token}` } });

    await entrarComo(page, 'publicador');
    await abrirModelo(page, 'fatura');

    if (filho.status !== 200) {
      await page.getByRole('button', { name: 'Publicar…' }).click();
      const g8 = page.getByTestId('gate-G8');
      await expect(g8).not.toHaveAttribute('data-verde', 'true');
      await expect(g8).toContainText('fatura_entregas');
      await expect(page.getByTestId('publish-confirmar')).toBeDisabled();
      await page.keyboard.press('Escape');
      await publicarPelaApi('fatura_entregas');
    }

    await renderizarEComparar(page, 'fatura');
    await publicarPeloWizard(page);
  });
});
