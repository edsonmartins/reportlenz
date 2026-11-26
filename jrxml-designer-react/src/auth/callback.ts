/**
 * Página de retorno do OIDC (ADR-017 §6). Roda DENTRO do popup de login ou do
 * iframe de renovação silenciosa e só repassa a URL de retorno à janela
 * principal (postMessage do oidc-client-ts) — quem valida state/PKCE é o
 * UserManager da janela principal, com o estado em MEMÓRIA.
 */
import { InMemoryWebStorage, UserManager, WebStorageStateStore } from 'oidc-client-ts';

const memoria = new WebStorageStateStore({ store: new InMemoryWebStorage() });
// authority/client_id não são usados nos callbacks de popup/iframe (só repassam a URL).
const gerente = new UserManager({
  authority: window.location.origin,
  client_id: 'reportlenz',
  redirect_uri: window.location.href,
  userStore: memoria,
  stateStore: memoria,
});

if (window.opener && window.opener !== window) {
  void gerente.signinPopupCallback();
} else if (window.parent !== window) {
  void gerente.signinSilentCallback();
} else {
  document.body.textContent = 'Abra o ReportLenz pela página principal para entrar.';
}
