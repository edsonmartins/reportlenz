import { expect, type Page } from '@playwright/test';
import { identidades } from './keycloak';

/** Login REAL: botão "Entrar" → popup do Keycloak (PKCE) → volta ao designer. */
export async function entrarComo(page: Page, quem: 'designer' | 'publicador'): Promise<string> {
  const id = identidades();
  const usuario = quem === 'designer' ? id.designer : id.publicador;
  await page.goto('/');
  const [popup] = await Promise.all([page.waitForEvent('popup'), page.getByTestId('sessao-entrar').click()]);
  await popup.locator('#username').fill(usuario);
  await popup.locator('#password').fill(id.senha);
  // Escuta o 'close' ANTES do clique: o callback fecha o popup sozinho e, com
  // slowMo/máquina lenta, ele pode fechar antes de um waitForEvent posterior.
  const fechou = popup.waitForEvent('close');
  await popup.locator('#kc-login').click();
  await fechou;
  await expect(page.getByTestId('galeria')).toBeVisible();
  return usuario;
}

/** Abre um template de referência da galeria (chave: fatura, comprovante, formulario, etiqueta_a4). */
export async function abrirModelo(page: Page, chave: string): Promise<void> {
  await page.getByTestId(`modelo-${chave}`).getByRole('button', { name: 'Usar' }).click();
  await expect(page.getByTestId('canvas')).toBeVisible();
}
