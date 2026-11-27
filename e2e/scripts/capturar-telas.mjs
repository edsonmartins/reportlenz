/**
 * Capturas de tela do README (docs/imagens/), a partir da aplicação REAL.
 *
 * Pré-requisitos (modo desenvolvimento, sem login):
 *   - render-service com REPORTLENZ_SEGURANCA_HABILITADA=false na porta 8087;
 *   - designer em `pnpm ui:dev` (porta 5187, public/config.json = {"oidc": null}).
 *
 * Uso:  pnpm --dir e2e capturas            (DESIGNER_DEV_URL para outra porta)
 *
 * As miniaturas dos modelos vêm das imagens de referência da regressão visual
 * (e2e/testes/__referencias__), que são renders reais do engine.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(aqui, '../..');
const saida = join(raiz, 'docs/imagens');
const URL_DESIGNER = process.env.DESIGNER_DEV_URL ?? 'http://localhost:5187';
mkdirSync(join(saida, 'modelos'), { recursive: true });

const navegador = await chromium.launch();
const pagina = await navegador.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale: 'pt-BR' });

async function abrir(chave) {
  await pagina.goto(URL_DESIGNER);
  await pagina.getByTestId(`modelo-${chave}`).getByRole('button', { name: 'Usar' }).click();
  await pagina.getByTestId('canvas').waitFor();
}

async function renderizar() {
  await pagina.getByRole('button', { name: 'Renderizar (Jasper)' }).click();
  const img = pagina.getByTestId('preview-img');
  await img.waitFor();
  await pagina.waitForFunction(() => {
    const i = document.querySelector('[data-testid="preview-img"]');
    return i instanceof HTMLImageElement && i.complete && i.naturalWidth > 0;
  });
  await pagina.mouse.move(0, 0); // sem tooltip por cima
  await pagina.waitForTimeout(300);
}

async function capturar(nome, opcoes = {}) {
  await pagina.screenshot({ path: join(saida, `${nome}.png`), ...opcoes });
  console.log(`docs/imagens/${nome}.png`);
}

// 1. Galeria de modelos
await pagina.goto(URL_DESIGNER);
await pagina.getByTestId('galeria').waitFor();
await capturar('galeria', { fullPage: true });

// 2. Editor: DANFE aberto, código de barras selecionado (painel de propriedades)
await abrir('danfe');
const indice = await pagina.evaluate(() =>
  [...document.querySelectorAll('[data-testid^="el-pageHeader/"]')].findIndex((e) => e.textContent?.includes('barcode')),
);
const alvo = pagina.getByTestId(`el-pageHeader/${Math.max(indice, 0)}`);
await alvo.dispatchEvent('pointerdown', { pointerId: 1 });
await alvo.dispatchEvent('pointerup', { pointerId: 1 });
await pagina.mouse.move(0, 0);
await capturar('editor');

// 3. Preview do engine em tela cheia (mesmo DANFE)
await renderizar();
await capturar('preview-danfe');

// 4. Preview de um relatório em paisagem
await abrir('listagem_vendas');
await renderizar();
await capturar('preview-listagem');

// 5. Publish Wizard com os gates G1–G8
await abrir('formulario');
await pagina.getByRole('button', { name: 'Publicar…' }).click();
await pagina.getByTestId('gate-G8').waitFor();
await pagina.waitForFunction(() => document.querySelectorAll('[data-testid^="gate-"][data-verde="true"]').length >= 8, null, { timeout: 30_000 });
await pagina.waitForTimeout(300);
await capturar('publicacao');

await navegador.close();

// 6. Miniaturas dos modelos (renders reais do engine, 360px de largura)
const referencias = join(raiz, 'e2e/testes/__referencias__');
for (const arquivo of readdirSync(referencias).filter((f) => f.endsWith('.png'))) {
  execFileSync('sips', ['-Z', '480', join(referencias, arquivo), '--out', join(saida, 'modelos', arquivo)], { stdio: 'ignore' });
}
console.log(`docs/imagens/modelos/ (${readdirSync(join(saida, 'modelos')).length} miniaturas)`);
