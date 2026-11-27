import { expect, test } from '@playwright/test';
import { identidades, tokenDeApi } from '../apoio/keycloak';
import { publicarPelaApi } from '../apoio/registro';

const HOST = process.env.HOST_URL ?? 'http://localhost:5300';

declare global {
  interface Window {
    __REPORTLENZ_TOKEN__?: string;
  }
}

/**
 * Aplicação hospedeira de teste (ADR-025, change componente-embutivel/3.3):
 * exemplos/host-react instala os TARBALLS dos pacotes (pnpm pack) com npm e
 * fala com o render-service em OUTRA origem (CORS). Scenarios "Aplicação
 * hospedeira de teste", "Duas instâncias na mesma página", "Token da
 * aplicação", "Modo registro", "Modo controlado", "Preview avulso" e
 * "Serviço em outra origem".
 */
test.describe('pacotes publicados numa aplicação hospedeira', () => {
  test.beforeAll(async () => {
    await publicarPelaApi('formulario'); // o designer B e o preview abrem o formulário publicado
  });

  test.beforeEach(async ({ page }) => {
    const token = await tokenDeApi(identidades().publicador);
    // A "sessão" da aplicação hospedeira — o componente pede o token via getAccessToken.
    await page.addInitScript((t) => {
      window.__REPORTLENZ_TOKEN__ = t;
    }, token);
  });

  test('dois designers e um preview na mesma página, falando com o serviço em outra origem', async ({ page }) => {
    const chamadasCruzadas: string[] = [];
    page.on('request', (r) => {
      if (r.url().startsWith(process.env.DESIGNER_URL ?? 'http://localhost:8080')) chamadasCruzadas.push(r.headers()['authorization'] ?? 'sem-token');
    });
    await page.goto(HOST);

    const a = page.getByTestId('host-a');
    const b = page.getByTestId('host-b');
    // A: modo controlado com a fatura da aplicação; B: modo registro (CORS + Bearer).
    await expect(a.getByTestId('nome-do-template')).toHaveText('fatura_completa');
    await expect(b.getByTestId('nome-do-template')).toHaveText('formulario_cadastro');
    await expect(b.getByTestId('salvar')).toBeVisible();
    await expect(a.getByTestId('salvar')).toHaveCount(0);

    // Preview avulso: versão publicada com o payload da aplicação.
    await expect(page.getByTestId('host-preview').getByTestId('preview-img')).toBeVisible();

    // Toda chamada cruzada levou o Bearer da aplicação.
    expect(chamadasCruzadas.length).toBeGreaterThan(0);
    expect(chamadasCruzadas.every((h) => /^Bearer [\w-]+\.[\w-]+\.[\w-]+$/.test(h))).toBe(true);
  });

  test('editar o designer A emite onChange para a aplicação e não mexe no designer B', async ({ page }) => {
    await page.goto(HOST);
    const a = page.getByTestId('host-a');
    const b = page.getByTestId('host-b');
    await expect(b.getByTestId('nome-do-template')).toHaveText('formulario_cadastro');
    await expect(page.getByTestId('mudancas-a')).toHaveText(/^0 mudança/);

    await a.getByTestId('el-title/0').click();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');

    await expect(page.getByTestId('mudancas-a')).toHaveText(/^2 mudança/);
    await expect(a.getByRole('button', { name: 'desfazer' })).toBeEnabled();
    await expect(b.getByRole('button', { name: 'desfazer' })).toBeDisabled();
  });

  test('render real pelo designer embutido e Salvar no registro com evento para a aplicação', async ({ page }) => {
    await page.goto(HOST);
    const a = page.getByTestId('host-a');
    await a.getByRole('button', { name: 'Renderizar (Jasper)' }).click();
    await expect(a.getByTestId('preview-img')).toBeVisible();
    await expect(a.getByTestId('preview-erro')).toHaveCount(0);

    const b = page.getByTestId('host-b');
    await expect(b.getByTestId('nome-do-template')).toHaveText('formulario_cadastro');
    await b.getByTestId('salvar').click();
    await expect(b.getByTestId('estado-do-salvamento')).toHaveText(/salvo · v\d+/);
    await expect(page.getByTestId('eventos')).toHaveText(/salvo v\d+/);
  });
});
